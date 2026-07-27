const os = require("os");

function isPrivateIpv4(address){
  const parts = String(address || "").split(".").map(Number);
  if(parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function interfaceScore(name, info){
  const label = String(name || "");
  let score = isPrivateIpv4(info.address) ? 30 : 0;
  if(/wi-?fi|wlan|wireless|sem fio/i.test(label)) score += 60;
  if(/ethernet/i.test(label)) score += 20;
  if(/virtual|vmware|vbox|vethernet|hyper-v|loopback|docker|wsl/i.test(label)) score -= 100;
  return score;
}

function selectInterface(networkInterfaces, preferredAddress){
  const candidates = [];
  for(const [name, entries] of Object.entries(networkInterfaces || {})){
    for(const info of entries || []){
      const ipv4 = info.family === "IPv4" || info.family === 4;
      if(!ipv4 || info.internal || !isPrivateIpv4(info.address)) continue;
      candidates.push({name, ...info, score: interfaceScore(name, info)});
    }
  }
  return candidates.find((entry) => entry.address === preferredAddress) ||
    candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function parseDefaultRoute(output){
  for(const line of String(output || "").split(/\r?\n/)){
    const match = line.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})/);
    if(match) return {gateway: match[1], localAddress: match[2]};
  }
  return {gateway: null, localAddress: null};
}

function parseArpTable(output){
  const devices = [];
  for(const line of String(output || "").split(/\r?\n/)){
    const match = line.match(/^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:[-:][0-9a-f]{2}){5})\s+/i);
    if(!match) continue;
    devices.push({address: match[1], mac: match[2].replace(/-/g, ":").toUpperCase()});
  }
  return devices;
}

function sameIpv4Block(address, localAddress){
  const value = String(address || "").split(".");
  const local = String(localAddress || "").split(".");
  return value.length === 4 && local.length === 4 && value.slice(0, 3).join(".") === local.slice(0, 3).join(".");
}

function parseResolvedHostname(output){
  const text = String(output || "");
  const dnsNames = [...text.matchAll(/^\s*(?:Name|Nome)\s*:\s*([^\s.][^\s]*)\s*$/gim)]
    .map((match) => match[1].replace(/\.$/, ""));
  const dnsName = dnsNames.at(-1);
  if(dnsName && !/^(?:localhost|unknown)$/i.test(dnsName)) return dnsName;
  const netbios = text.match(/^\s*([^\s<]{1,32})\s+<00>\s+(?:UNIQUE|ÚNICO)\s+/im);
  return netbios ? netbios[1].trim() : "";
}

function cleanFriendlyName(value){
  return String(value || "")
    .replace(/^::ffff:/i, "")
    .replace(/\.local$/i, "")
    .trim()
    .slice(0, 64);
}

async function runInBatches(items, size, worker){
  for(let index = 0; index < items.length; index += size){
    await Promise.allSettled(items.slice(index, index + size).map(worker));
  }
}

async function scanNetwork({runProcess, networkInterfaces = os.networkInterfaces(), hostname = os.hostname(), knownNames = {}} = {}){
  if(typeof runProcess !== "function") throw new Error("runProcess e obrigatorio");

  let route = {gateway: null, localAddress: null};
  try{
    route = parseDefaultRoute((await runProcess("route.exe", ["print", "-4"], {timeoutMs: 3000})).stdout);
  }catch(err){}

  const active = selectInterface(networkInterfaces, route.localAddress);
  if(!active) return {scannedAt: new Date().toISOString(), interface: null, devices: [], error: "Nenhuma rede local IPv4 ativa"};

  const prefix = active.address.split(".").slice(0, 3).join(".");
  const targets = Array.from({length: 254}, (_, index) => `${prefix}.${index + 1}`)
    .filter((address) => address !== active.address);

  // O ping popula a tabela ARP mesmo quando o dispositivo não oferece outros serviços.
  await runInBatches(targets, 96, (address) =>
    runProcess("ping.exe", ["-n", "1", "-w", "220", address], {timeoutMs: 800})
  );

  let arpEntries = [];
  try{
    arpEntries = parseArpTable((await runProcess("arp.exe", ["-a"], {timeoutMs: 3000})).stdout)
      .filter((entry) => sameIpv4Block(entry.address, active.address));
  }catch(err){}

  const byAddress = new Map();
  byAddress.set(active.address, {
    address: active.address,
    mac: active.mac && active.mac !== "00:00:00:00:00:00" ? active.mac.toUpperCase() : null,
    name: hostname || "Este computador",
    kind: "computer",
    isLocal: true,
    isGateway: false
  });
  for(const entry of arpEntries){
    const lastOctet = Number(entry.address.split(".")[3]);
    if(lastOctet === 0 || lastOctet === 255 || entry.mac === "FF:FF:FF:FF:FF:FF") continue;
    const isGateway = entry.address === route.gateway;
    byAddress.set(entry.address, {
      ...entry,
      name: isGateway ? "Roteador / Gateway" : `Dispositivo ${entry.address}`,
      kind: isGateway ? "router" : "device",
      isLocal: false,
      isGateway
    });
  }

  // Resolve nomes depois da descoberta para não atrasar o preenchimento da ARP.
  // Maia Connect tem prioridade; depois vêm DNS reverso e NetBIOS do Windows.
  const resolvable = [...byAddress.values()].filter((device) => !device.isLocal && !device.isGateway);
  await runInBatches(resolvable, 12, async (device) => {
    const pairedName = cleanFriendlyName(knownNames[device.address]);
    if(pairedName){
      device.name = pairedName;
      device.nameSource = "maia-connect";
      return;
    }
    const lookups = await Promise.allSettled([
      runProcess("nslookup.exe", [device.address], {timeoutMs: 1400}),
      runProcess("nbtstat.exe", ["-A", device.address], {timeoutMs: 1400})
    ]);
    for(const lookup of lookups){
      if(lookup.status !== "fulfilled") continue;
      const resolved = cleanFriendlyName(parseResolvedHostname(lookup.value.stdout));
      if(!resolved || resolved === device.address) continue;
      device.name = resolved;
      device.nameSource = lookup.value.stdout.match(/<00>/i) ? "netbios" : "dns";
      break;
    }
  });

  const devices = [...byAddress.values()].sort((a, b) => {
    if(a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    if(a.isGateway !== b.isGateway) return a.isGateway ? -1 : 1;
    return Number(a.address.split(".")[3]) - Number(b.address.split(".")[3]);
  });

  return {
    scannedAt: new Date().toISOString(),
    interface: {name: active.name, address: active.address, netmask: active.netmask, gateway: route.gateway},
    devices
  };
}

module.exports = {isPrivateIpv4, selectInterface, parseDefaultRoute, parseArpTable, parseResolvedHostname, sameIpv4Block, scanNetwork};
