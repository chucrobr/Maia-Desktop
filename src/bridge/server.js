const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const QRCode = require("qrcode");
const {spawn, spawnSync} = require("child_process");
const {MegaBrain} = require("../brain/mega-brain.js");
const {scanNetwork} = require("./network-scanner.js");
const extensionManifests = require("../config/maia-extensions.json");

const HOST = "127.0.0.1";
const PORT = 17778;
const CONNECT_PORT = Number(process.env.MAIA_CONNECT_PORT) || 17780;
const CONNECT_HOST = "0.0.0.0";
const CONNECT_UI_PATH = path.join(__dirname, "..", "ui", "maia-connect.html");
const AUTH_TOKEN = crypto.randomBytes(32).toString("hex");
const MAX_BODY_BYTES = 256 * 1024;
const SPOTIFY_CLIENT_ID = "6e2ea29b40cc410fb5d94e8ecdad6916";
const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:17779/spotify/callback";
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-library-modify"
].join(" ");
const voiceClients = new Set();
const processedSales = new Map();
let voiceProcess = null;
let speechProcess = null;
let speechReady = false;
let speechBuffer = "";
const speechQueue = [];
let spotifyAuthServer = null;
let spotifyAuthSession = null;
let speechHelperPid = null;
let speechHelperProfile = null;
let speechHelperMinimizeProcess = null;
let lastCpuSample = cpuSnapshot();
let netlifySalesTimer = null;
let netlifySalesPolling = false;
let networkScanCache = null;
let networkScanPromise = null;
let networkStatusPromise = null;
let connectServer = null;
let connectEnabled = false;
let connectPairCode = "";
let connectGuestCode = "";
let connectPairExpiresAt = 0;
const connectDevices = new Map();
const connectPairAttempts = new Map();
const connectActionRates = new Map();
const connectAudit = [];
const CONNECT_DATA_PATH = path.join(os.homedir(), ".maia", "connect-devices.json");
let connectSnapshotCache = null;
let connectSnapshotAt = 0;
let connectDesktopHandlers = {};
const networkHealth = {
  online:null,
  consecutiveFailures:0,
  lastSuccessAt:0,
  avgMs:null,
  checkedAt:0
};
const UPDATE_CONFIG_PATH = path.join(__dirname, "..", "config", "update.json");

function compareVersions(left, right){
  const a = String(left || "0").split(".").map(Number);
  const b = String(right || "0").split(".").map(Number);
  for(let i = 0; i < Math.max(a.length, b.length); i++){
    const diff = (a[i] || 0) - (b[i] || 0);
    if(diff) return diff;
  }
  return 0;
}

async function updateStatus(){
  let config = {};
  try{ config = JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, "utf8")); }catch(err){}
  const currentVersion = require("../../package.json").version;
  if(!config.enabled || !/^https:\/\//i.test(config.manifestUrl || "")){
    return {configured:false, currentVersion, message:"Canal oficial de atualizacao ainda nao configurado"};
  }
  const response = await fetch(config.manifestUrl, {signal:AbortSignal.timeout(8000), headers:{"Cache-Control":"no-cache"}});
  if(!response.ok) throw new Error("canal de atualizacao respondeu " + response.status);
  const manifest = await response.json();
  const latestVersion = String(manifest.version || "");
  const installerUrl = String(manifest.installerUrl || "");
  const sha256 = String(manifest.sha256 || "").toUpperCase();
  if(!/^\d+\.\d+\.\d+$/.test(latestVersion) || !/^https:\/\//i.test(installerUrl) || !/^[A-F0-9]{64}$/.test(sha256)) throw new Error("manifesto de atualizacao invalido");
  return {configured:true,currentVersion,latestVersion,available:compareVersions(latestVersion,currentVersion)>0,installerUrl,sha256};
}
const megaBrain = new MegaBrain();

function cpuSnapshot(){
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for(const cpu of cpus){
    const times = cpu.times || {};
    idle += times.idle || 0;
    total += (times.user || 0) + (times.nice || 0) + (times.sys || 0) + (times.irq || 0) + (times.idle || 0);
  }
  return {idle, total};
}

async function telemetrySnapshot(){
  const networkPromise = networkStatus();
  const current = cpuSnapshot();
  let cpuPercent = 0;
  if(lastCpuSample && current.total > lastCpuSample.total){
    const idleDelta = current.idle - lastCpuSample.idle;
    const totalDelta = current.total - lastCpuSample.total;
    cpuPercent = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
  }
  lastCpuSample = current;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramPercent = totalMem ? ((totalMem - freeMem) / totalMem) * 100 : null;
  const snapshot = {
    ok: true,
    hostname: os.hostname(),
    os_name: os.version ? os.version() : `${os.type()} ${os.release()}`,
    cpu_model: (os.cpus()[0] && os.cpus()[0].model || "").trim(),
    logical_processors: os.cpus().length,
    uptime_seconds: Math.round(os.uptime()),
    cpu_percent: Math.round(cpuPercent * 10) / 10,
    ram_percent: ramPercent == null ? null : Math.round(ramPercent * 10) / 10,
    ram_used_gb: Math.round(((totalMem - freeMem) / (1024 ** 3)) * 10) / 10,
    ram_total_gb: Math.round((totalMem / (1024 ** 3)) * 10) / 10,
    cpu_temp_c: null,
    battery_percent: null,
    battery_charging: null,
    net_recv_mb: null,
    disk_percent: null,
    disk_total_gb: null,
    disk_free_gb: null,
    gpu_name: null,
    internet_online: null,
    internet_latency_ms: null,
    integrity_percent: null
  };
  try{
    const extra = await ps(`
$battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
$disk = [System.IO.DriveInfo]::new('C')
$net = Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Measure-Object -Property ReceivedBytes -Sum
$gpu = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video\\*\\0000' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc } | Select-Object -First 1
$batteryPercent = $null
$batteryCharging = $null
$diskPercent = $null
$netRecvMb = $null
if($battery){
  $batteryPercent = [double]$battery.EstimatedChargeRemaining
  $batteryCharging = [bool]($battery.BatteryStatus -eq 2)
}
if($disk -and $disk.TotalSize){
  $diskPercent = [math]::Round((($disk.TotalSize - $disk.AvailableFreeSpace) / $disk.TotalSize) * 100, 1)
}
if($net -and $net.Sum){
  $netRecvMb = [math]::Round($net.Sum / 1MB, 1)
}
$data = [ordered]@{
  battery_percent = $batteryPercent
  battery_charging = $batteryCharging
  disk_percent = $diskPercent
  disk_total_gb = $(if($disk -and $disk.TotalSize){ [math]::Round($disk.TotalSize / 1GB, 1) }else{ $null })
  disk_free_gb = $(if($disk){ [math]::Round($disk.AvailableFreeSpace / 1GB, 1) }else{ $null })
  gpu_name = $(if($gpu){ [string]$gpu.DriverDesc }else{ $null })
  net_recv_mb = $netRecvMb
}
$data | ConvertTo-Json -Compress
`);
    const parsed = JSON.parse(String(extra.stdout || "{}"));
    snapshot.battery_percent = parsed.battery_percent;
    snapshot.battery_charging = parsed.battery_charging;
    snapshot.disk_percent = parsed.disk_percent;
    snapshot.disk_total_gb = parsed.disk_total_gb;
    snapshot.disk_free_gb = parsed.disk_free_gb;
    snapshot.gpu_name = parsed.gpu_name;
    snapshot.net_recv_mb = parsed.net_recv_mb;
  }catch(err){}
  try{
    const network = await networkPromise;
    snapshot.internet_online = Boolean(network.online);
    snapshot.internet_latency_ms = network.avgMs;
  }catch(err){
    snapshot.internet_online = false;
  }
  const cpuPenalty = Math.max(0, Number(snapshot.cpu_percent || 0) - 70) * 0.35;
  const ramPenalty = Math.max(0, Number(snapshot.ram_percent || 0) - 75) * 0.45;
  const diskPenalty = Math.max(0, Number(snapshot.disk_percent || 0) - 85) * 0.35;
  const offlinePenalty = snapshot.internet_online === false ? 20 : 0;
  snapshot.integrity_percent = Math.round(Math.max(0, Math.min(100, 100 - cpuPenalty - ramPenalty - diskPenalty - offlinePenalty)) * 10) / 10;
  return snapshot;
}

function allowedOrigin(req){
  const origin = String(req.headers.origin || "");
  if(!origin || origin === "null") return "null";
  try{
    const parsed = new URL(origin);
    if(["127.0.0.1", "localhost"].includes(parsed.hostname)) return origin;
  }catch(err){}
  return "";
}

function hasValidToken(value){
  const supplied = Buffer.from(String(value || ""), "utf8");
  const expected = Buffer.from(AUTH_TOKEN, "utf8");
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function secretMatches(value, expected){
  const supplied = Buffer.from(String(value || ""), "utf8");
  const target = Buffer.from(String(expected || ""), "utf8");
  return supplied.length === target.length && crypto.timingSafeEqual(supplied, target);
}

function connectAddresses(){
  const addresses = [];
  for(const entries of Object.values(os.networkInterfaces())){
    for(const entry of entries || []){
      if(entry && entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.")) addresses.push(`http://${entry.address}:${CONNECT_PORT}`);
    }
  }
  const priority=value=>/\/\/192\.168\./.test(value)?0:/\/\/10\./.test(value)?1:/\/\/172\.(1[6-9]|2\d|3[01])\./.test(value)?2:/\/\/100\./.test(value)?4:3;
  return [...new Set(addresses)].sort((a,b)=>priority(a)-priority(b));
}

function refreshConnectPairCode(){
  connectPairCode = String(crypto.randomInt(100000, 1000000));
  connectGuestCode = String(crypto.randomInt(100000, 1000000));
  connectPairExpiresAt = Date.now() + 10 * 60 * 1000;
  return connectPairCode;
}

function loadConnectDevices(){
  try{
    const parsed = JSON.parse(fs.readFileSync(CONNECT_DATA_PATH, "utf8"));
    for(const item of Array.isArray(parsed) ? parsed : []) if(item && /^[a-f0-9]{64}$/i.test(item.hash || "")) connectDevices.set(item.hash, item.device || {});
  }catch(err){}
}

function saveConnectDevices(){
  try{
    fs.mkdirSync(path.dirname(CONNECT_DATA_PATH), {recursive:true});
    const data = [...connectDevices].map(([hash,device]) => ({hash,device}));
    fs.writeFileSync(CONNECT_DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  }catch(err){}
}
loadConnectDevices();

function auditConnect(type, detail, req){
  connectAudit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),type,detail:String(detail || "").slice(0,120),address:req && String(req.socket.remoteAddress || "")});
  connectAudit.splice(100);
}

function connectStatus(includeSecret = false){
  const result = {
    enabled:connectEnabled,
    port:CONNECT_PORT,
    addresses:connectEnabled ? connectAddresses() : [],
    pairedDevices:connectDevices.size,
    secure:"Pareamento local com token por dispositivo"
  };
  if(includeSecret && connectEnabled){
    if(Date.now() >= connectPairExpiresAt) refreshConnectPairCode();
    result.pairCode = connectPairCode;
    result.guestCode = connectGuestCode;
    result.pairExpiresAt = connectPairExpiresAt;
  }
  return result;
}

function connectAuthorized(req, requestUrl){
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : requestUrl.searchParams.get("token") || "";
  if(!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const device=connectDevices.get(hash);
  return device ? {...device,hash} : null;
}

function sendConnect(res, status, data){
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY",
    "Content-Length":Buffer.byteLength(body)
  });
  res.end(body);
}

async function connectSnapshot(){
  if(connectSnapshotCache && Date.now() - connectSnapshotAt < 8000) return connectSnapshotCache;
  const [telemetry, spotify] = await Promise.all([
    telemetrySnapshot().catch(() => ({ok:false})),
    runAction("spotify.current", {}).catch(() => null)
  ]);
  connectSnapshotCache = {
    ok:true,
    version:require("../../package.json").version,
    hostname:os.hostname(),
    telemetry,
    spotify,
    extensions:extensionManifests.map(item => ({id:item.id,name:item.name,version:item.version,category:item.category,summary:item.summary}))
  };
  connectSnapshotAt = Date.now();
  return connectSnapshotCache;
}

async function connectQrCode(){
  const status = connectStatus(true);
  const address = status.addresses[0];
  if(!address) throw new Error("nenhum endereço de rede disponível");
  const url = `${address}/?code=${encodeURIComponent(status.pairCode)}`;
  return {url, dataUrl:await QRCode.toDataURL(url, {width:320,margin:2,color:{dark:"#07141d",light:"#ffffff"}})};
}

const CONNECT_ALLOWED_ACTIONS = new Set([
  "volume.up","volume.down","volume.set","volume.mute",
  "media.playpause","media.next","media.previous",
  "spotify.open","spotify.current","spotify.pause","spotify.resume","spotify.next","spotify.previous","spotify.volume","spotify.playSearch","spotify.shuffle","spotify.repeat","spotify.saveCurrent",
  "youtube.open","youtube.search","youtube.play",
  "streaming.open","system.openProgram","system.lock",
  "system.sleep","network.status","downloads.list","news.today","speech.speak",
  "clipboard.read","clipboard.write","screenshot.capture"
  ,"connect.theme","connect.clock.list","connect.clock.add","connect.clock.remove","connect.routine.run"
]);
const CONNECT_CONFIRMATIONS = { "system.sleep":"SUSPENDER", "clipboard.read":"LER CLIPBOARD", "screenshot.capture":"CAPTURAR TELA" };
const CONNECT_GUEST_ACTIONS = new Set(["volume.up","volume.down","volume.set","volume.mute","media.playpause","media.next","media.previous","spotify.current","spotify.pause","spotify.resume","spotify.next","spotify.previous","spotify.volume","spotify.playSearch","youtube.open","youtube.search","youtube.play"]);

function setConnectDesktopHandlers(handlers){
  connectDesktopHandlers = handlers && typeof handlers === "object" ? handlers : {};
}

async function connectNaturalCommand(text){
  const value = String(text || "").trim().slice(0, 180);
  const normalized = value.toLowerCase();
  if(!value) throw new Error("comando vazio");
  if(/^(pausar|continuar|play|pause)( musica| música)?$/.test(normalized)) return runAction("media.playpause", {});
  if(/pr[oó]xima( m[uú]sica)?/.test(normalized)) return runAction("media.next", {});
  if(/m[uú]sica anterior|voltar m[uú]sica/.test(normalized)) return runAction("media.previous", {});
  if(/silenciar|mudo|mutar/.test(normalized)) return runAction("volume.mute", {});
  const volume = normalized.match(/volume\s*(?:em|para)?\s*(\d{1,3})/);
  if(volume) return runAction("volume.set", {level:Math.min(100, Number(volume[1]))});
  const youtube = value.match(/(?:buscar|procurar|tocar)\s+(.+?)\s+(?:no|na)\s+youtube/i);
  if(youtube) return runAction("youtube.search", {query:youtube[1]});
  const spotify = value.match(/(?:tocar|ouvir)\s+(.+?)(?:\s+no spotify)?$/i);
  if(spotify) return runAction("spotify.playSearch", {query:spotify[1]});
  const open = value.match(/^abrir\s+(.+)$/i);
  if(open) return runAction("system.openProgram", {program:open[1]});
  if(/bloquear (o )?(pc|computador)/i.test(value)) return runAction("system.lock", {});
  return runAction("speech.speak", {text:`Recebi pelo Maia Connect: ${value}`});
}

function startConnectServer(){
  if(connectServer && connectServer.listening) return connectStatus(true);
  refreshConnectPairCode();
  connectServer = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${CONNECT_PORT}`}`);
    const remoteAddress = String(req.socket.remoteAddress || "");
    if(req.method === "GET" && requestUrl.pathname === "/"){
      try{
        const html = fs.readFileSync(CONNECT_UI_PATH, "utf8");
        res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff"});
        res.end(html);
      }catch(err){ sendConnect(res, 500, {ok:false,error:"interface móvel indisponível"}); }
      return;
    }
    if(req.method === "GET" && requestUrl.pathname === "/manifest.webmanifest"){
      const manifest = {name:"Maia Connect",short_name:"Maia",start_url:"/",display:"standalone",background_color:"#03090e",theme_color:"#06141d",icons:[{src:"/icon.png",sizes:"512x512",type:"image/png"}]};
      const body=JSON.stringify(manifest);
      res.writeHead(200,{"Content-Type":"application/manifest+json","Cache-Control":"no-store","Content-Length":Buffer.byteLength(body)});
      res.end(body);
      return;
    }
    if(req.method === "GET" && requestUrl.pathname === "/icon.png"){
      try{
        const icon=fs.readFileSync(path.join(__dirname,"..","..","assets","maia-icon.png"));
        res.writeHead(200,{"Content-Type":"image/png","Cache-Control":"public, max-age=86400","Content-Length":icon.length});
        res.end(icon);
      }catch(err){res.writeHead(404);res.end();}
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/pair"){
      const attempt = connectPairAttempts.get(remoteAddress) || {count:0,resetAt:Date.now()+60000};
      if(Date.now() > attempt.resetAt){ attempt.count = 0; attempt.resetAt = Date.now()+60000; }
      attempt.count += 1; connectPairAttempts.set(remoteAddress, attempt);
      if(attempt.count > 8){ sendConnect(res, 429, {ok:false,error:"muitas tentativas; aguarde um minuto"}); return; }
      try{
        const body = await readBody(req);
        const ownerMatch=secretMatches(body.code,connectPairCode),guestMatch=secretMatches(body.code,connectGuestCode);
        if(Date.now() >= connectPairExpiresAt || (!ownerMatch&&!guestMatch)){ sendConnect(res, 401, {ok:false,error:"código inválido ou expirado"}); return; }
        const token = crypto.randomBytes(32).toString("hex");
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        const role=ownerMatch?"owner":"guest";
        connectDevices.set(hash, {name:String(body.name || "Celular").slice(0,40),pairedAt:new Date().toISOString(),remoteAddress,role});
        saveConnectDevices();
        auditConnect("pair", String(body.name || "Celular"), req);
        refreshConnectPairCode();
        sendConnect(res, 200, {ok:true,token,role,device:String(body.name || "Celular").slice(0,40)});
      }catch(err){ sendConnect(res, 400, {ok:false,error:"dados de pareamento inválidos"}); }
      return;
    }
    const authorizedDevice=connectAuthorized(req,requestUrl);
    if(!authorizedDevice){ sendConnect(res, 401, {ok:false,error:"celular não pareado"}); return; }
    const rate=connectActionRates.get(remoteAddress)||{count:0,resetAt:Date.now()+60000};
    if(Date.now()>rate.resetAt){rate.count=0;rate.resetAt=Date.now()+60000;}
    rate.count+=1;connectActionRates.set(remoteAddress,rate);
    if(rate.count>180){sendConnect(res,429,{ok:false,error:"limite temporário de comandos atingido"});return;}
    if(req.method === "GET" && requestUrl.pathname === "/api/snapshot"){ sendConnect(res, 200, await connectSnapshot()); return; }
    if(req.method === "GET" && requestUrl.pathname === "/api/devices"){
      if(authorizedDevice.role==="guest"){sendConnect(res,403,{ok:false,error:"recurso indisponível no modo convidado"});return;}
      sendConnect(res,200,{ok:true,devices:[...connectDevices].map(([hash,device])=>({id:hash.slice(0,12),name:device.name,pairedAt:device.pairedAt,role:device.role||"owner"})),history:connectAudit.slice(0,30)});
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/revoke"){
      if(authorizedDevice.role==="guest"){sendConnect(res,403,{ok:false,error:"recurso indisponível no modo convidado"});return;}
      try{
        const body=await readBody(req),id=String(body.id||"");
        const match=[...connectDevices.keys()].find(hash=>hash.startsWith(id));
        if(!match) throw new Error("celular não encontrado");
        connectDevices.delete(match);saveConnectDevices();auditConnect("revoke",id,req);sendConnect(res,200,{ok:true});
      }catch(err){sendConnect(res,400,{ok:false,error:err.message});}
      return;
    }
    if(req.method === "GET" && requestUrl.pathname === "/api/file"){
      if(authorizedDevice.role==="guest"){sendConnect(res,403,{ok:false,error:"arquivos indisponíveis no modo convidado"});return;}
      try{
        const name=path.basename(String(requestUrl.searchParams.get("name")||""));
        const filePath=path.join(os.homedir(),"Downloads",name);
        const stat=fs.statSync(filePath);
        if(!stat.isFile()||stat.size>10*1024*1024) throw new Error("arquivo indisponível ou maior que 10 MB");
        res.writeHead(200,{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,"Content-Length":stat.size,"Cache-Control":"no-store"});
        fs.createReadStream(filePath).pipe(res);auditConnect("download",name,req);
      }catch(err){sendConnect(res,404,{ok:false,error:err.message});}
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/upload"){
      if(authorizedDevice.role==="guest"){sendConnect(res,403,{ok:false,error:"arquivos indisponíveis no modo convidado"});return;}
      try{
        const body=await readBody(req),name=path.basename(String(body.name||"arquivo")).replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").slice(0,120);
        const data=Buffer.from(String(body.data||""),"base64");
        if(!data.length||data.length>180*1024) throw new Error("arquivo deve ter no máximo 180 KB");
        const destination=path.join(os.homedir(),"Downloads",name);
        fs.writeFileSync(destination,data,{flag:"wx"});auditConnect("upload",name,req);sendConnect(res,200,{ok:true,name,size:data.length});
      }catch(err){sendConnect(res,400,{ok:false,error:err.code==="EEXIST"?"já existe um arquivo com esse nome":err.message});}
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/action"){
      try{
        const body = await readBody(req);
        if(!CONNECT_ALLOWED_ACTIONS.has(body.action)) throw new Error("ação não autorizada no celular");
        if(authorizedDevice.role==="guest"&&!CONNECT_GUEST_ACTIONS.has(body.action)) throw new Error("ação indisponível no modo convidado");
        if(CONNECT_CONFIRMATIONS[body.action] && body.confirm !== CONNECT_CONFIRMATIONS[body.action]) throw new Error("confirmação obrigatória para esta ação");
        const result = await runAction(body.action, body.payload || {});
        auditConnect("action", body.action, req);
        sendConnect(res, 200, {ok:true,result});
      }catch(err){ sendConnect(res, 400, {ok:false,error:err.message}); }
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/assistant"){
      if(authorizedDevice.role==="guest"){sendConnect(res,403,{ok:false,error:"assistente indisponível no modo convidado"});return;}
      try{ const body=await readBody(req); const result=await connectNaturalCommand(body.text); auditConnect("command",body.text,req); sendConnect(res,200,{ok:true,result}); }
      catch(err){ sendConnect(res,400,{ok:false,error:err.message}); }
      return;
    }
    if(req.method === "POST" && requestUrl.pathname === "/api/unpair"){
      const header=String(req.headers.authorization || "").slice(7);
      connectDevices.delete(crypto.createHash("sha256").update(header).digest("hex"));
      saveConnectDevices();
      auditConnect("unpair","Celular desconectado",req);
      sendConnect(res,200,{ok:true});
      return;
    }
    sendConnect(res,404,{ok:false,error:"rota não encontrada"});
  });
  connectServer.on("error", err => { connectEnabled=false; console.warn("[maia:connect]",err.message); });
  connectServer.listen(CONNECT_PORT, CONNECT_HOST);
  connectEnabled = true;
  return connectStatus(true);
}

function stopConnectServer(){
  connectEnabled = false;
  connectPairCode = "";
  connectGuestCode = "";
  connectPairExpiresAt = 0;
  if(connectServer && connectServer.listening) connectServer.close();
  connectServer = null;
  return connectStatus(false);
}

function send(res, status, data, req){
  const body = JSON.stringify(data);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Maia-Token",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  };
  const origin = req && allowedOrigin(req);
  if(origin) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if(Buffer.byteLength(body) > MAX_BODY_BYTES){
        reject(new Error("corpo da requisicao excede o limite"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try{
        resolve(body ? JSON.parse(body) : {});
      }catch(err){
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function runProcess(file, args, options = {}){
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs || 0;
    const spawnOptions = {...options};
    delete spawnOptions.timeoutMs;
    const child = spawn(file, args, {
      windowsHide: true,
      ...spawnOptions
    });
    let settled = false;
    let timer = null;
    let stdout = "";
    let stderr = "";
    if(timeoutMs > 0){
      timer = setTimeout(() => {
        if(settled) return;
        settled = true;
        try{ child.kill(); }catch(err){}
        reject(new Error("processo demorou demais"));
      }, timeoutMs);
    }
    child.stdout.on("data", (data) => stdout += data.toString("utf8"));
    child.stderr.on("data", (data) => stderr += data.toString("utf8"));
    child.on("error", (err) => {
      if(settled) return;
      settled = true;
      if(timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if(settled) return;
      settled = true;
      if(timer) clearTimeout(timer);
      if(code === 0) resolve({stdout: stdout.trim(), stderr: stderr.trim()});
      else reject(new Error(stderr.trim() || stdout.trim() || `${file} saiu com codigo ${code}`));
    });
  });
}

function sendSse(res, event, data){
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendHtml(res, html){
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(html)
  });
  res.end(html);
}

function broadcastVoice(event, data){
  for(const res of voiceClients){
    try{
      sendSse(res, event, data);
    }catch(err){
      voiceClients.delete(res);
    }
  }
}

function speechHelperHtml(){
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Maia Voz Online</title>
  <style>
    body{margin:0;background:#03070d;color:#dff8ff;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;min-height:100vh}
    main{width:min(560px,92vw);border:1px solid rgba(95,220,255,.32);background:linear-gradient(180deg,rgba(18,42,58,.92),rgba(6,12,20,.95));border-radius:14px;padding:26px;box-shadow:0 0 42px rgba(60,200,255,.18)}
    h1{margin:0 0 12px;font-size:24px;letter-spacing:3px}
    .status{color:#ffcb7a;margin:14px 0;font-weight:600}
    .heard{min-height:72px;border:1px solid rgba(95,220,255,.2);border-radius:10px;padding:14px;background:rgba(0,0,0,.22)}
    button{border:0;border-radius:999px;padding:13px 20px;background:#5fe0ff;color:#031018;font-weight:800;cursor:pointer}
    small{display:block;margin-top:16px;color:#8fb8c7}
  </style>
</head>
<body>
  <main>
    <h1>MAIA VOZ ONLINE</h1>
    <button id="start">Ativar microfone</button>
    <div class="status" id="status">Aguardando ativação.</div>
    <div class="heard" id="heard">Diga: Maia volume médio</div>
    <small>Mantenha esta aba aberta. Ela envia a fala reconhecida para o aplicativo Maia.</small>
  </main>
  <script>
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusEl = document.getElementById('status');
    const heardEl = document.getElementById('heard');
    const startBtn = document.getElementById('start');
    let rec = null;
    let manualStop = false;
    let restartTimer = null;
    const token = new URLSearchParams(location.search).get('token') || '';
    async function send(text, final){
      try{
        await fetch('/voice/browser-result', {
          method:'POST',
          headers:{'Content-Type':'application/json','X-Maia-Token':token},
          body:JSON.stringify({text, final:Boolean(final), source:'browser-web-speech'})
        });
      }catch(err){}
    }
    function start(){
      if(!SR){
        statusEl.textContent = 'Web Speech indisponível neste navegador. Use Chrome ou Edge.';
        return;
      }
      rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.onstart = () => statusEl.textContent = 'Ouvindo. Diga Maia antes do comando.';
      rec.onerror = (event) => {
        if(event.error === 'aborted' || event.error === 'no-speech'){
          statusEl.textContent = 'Aguardando fala. Diga Maia antes do comando.';
          return;
        }
        statusEl.textContent = 'Erro: ' + event.error;
      };
      rec.onend = () => {
        if(manualStop) return;
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { try{ rec.start(); }catch(err){} }, 1200);
      };
      rec.onresult = (event) => {
        for(let i=event.resultIndex;i<event.results.length;i++){
          const text = event.results[i][0].transcript.trim();
          if(!text) continue;
          heardEl.textContent = text;
          statusEl.textContent = event.results[i].isFinal ? 'Enviado à Maia.' : 'Ouvindo...';
          send(text, event.results[i].isFinal);
        }
      };
      try{ rec.start(); }catch(err){}
    }
    startBtn.addEventListener('click', start);
    setTimeout(start, 600);
  </script>
</body>
</html>`;
}

function allowSpeechHelperMicrophone(profileDir){
  const defaultDir = path.join(profileDir, "Default");
  const preferencesPath = path.join(defaultDir, "Preferences");
  fs.mkdirSync(defaultDir, {recursive: true});
  let preferences = {};
  try{ preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8")); }catch(err){}
  if(!preferences.profile || typeof preferences.profile !== "object") preferences.profile = {};
  if(!preferences.profile.content_settings || typeof preferences.profile.content_settings !== "object") preferences.profile.content_settings = {};
  if(!preferences.profile.content_settings.exceptions || typeof preferences.profile.content_settings.exceptions !== "object") preferences.profile.content_settings.exceptions = {};
  if(!preferences.profile.content_settings.exceptions.media_stream_mic || typeof preferences.profile.content_settings.exceptions.media_stream_mic !== "object"){
    preferences.profile.content_settings.exceptions.media_stream_mic = {};
  }
  const permissionKey = `http://${HOST}:${PORT},*`;
  preferences.profile.content_settings.exceptions.media_stream_mic[permissionKey] = {
    last_modified: String((Date.now() + 11644473600000) * 1000),
    setting: 1
  };
  fs.writeFileSync(preferencesPath, JSON.stringify(preferences), "utf8");
}

async function openSpeechHelper(){
  const url = `http://${HOST}:${PORT}/speech-helper?token=${encodeURIComponent(AUTH_TOKEN)}`;
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  const edge = candidates.find((candidate) => fs.existsSync(candidate));
  try{
    if(edge){
      closeSpeechHelper();
      ensureMaiaDataDir();
      const psLiteral = (value) => "'" + String(value).replace(/'/g, "''") + "'";
      const profile = maiaDataPath("edge-voice-profile");
      speechHelperProfile = profile;
      allowSpeechHelperMicrophone(profile);
      const args = [
        `--app=${url}`,
        "--start-minimized",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--autoplay-policy=no-user-gesture-required",
        `--user-data-dir=${profile}`
      ];
      const child = spawn(edge, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      speechHelperPid = child.pid;
      child.unref();

      const escapedProfile = String(profile).replace(/'/g, "''");
      const minimizeScript = `
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class MaiaWindowControl { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam); }'
$profile = '${escapedProfile}'
$maiaPid = ${process.pid}
$minimizedWindows = @{}
while(Get-Process -Id $maiaPid -ErrorAction SilentlyContinue){
  Get-Process msedge -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*Maia Voz Online*' } |
    ForEach-Object {
      $handle = $_.MainWindowHandle.ToInt64()
      if(-not $minimizedWindows.ContainsKey($handle)){
        [MaiaWindowControl]::ShowWindowAsync($_.MainWindowHandle, 6) | Out-Null
        $minimizedWindows[$handle] = $true
      }
    }
  Start-Sleep -Milliseconds 500
}
`;
      speechHelperMinimizeProcess = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        minimizeScript
      ], {
        stdio: "ignore",
        windowsHide: true
      });      return {url, browser: "edge", opened: true, mode: "isolated-forced-minimized"};
    }
    return {url, browser: "edge-unavailable", opened: false};  }catch(err){
    return {url, browser: "edge-error", opened: false, error: err.message};
  }
}

function closeSpeechHelper(){
  if(speechHelperMinimizeProcess){
    try{ speechHelperMinimizeProcess.kill(); }catch(err){}
    speechHelperMinimizeProcess = null;
  }
  const pid = Number(speechHelperPid);
  const profile = speechHelperProfile || maiaDataPath("edge-voice-profile");
  speechHelperPid = null;
  speechHelperProfile = null;
  const escapedProfile = String(profile).replace(/'/g, "''");
  const fallbackPid = pid ? `$processIds += ${pid}` : "";
  const script = `
$profile = '${escapedProfile}'
$processIds = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like ('*--user-data-dir=' + $profile + '*') } |
  Select-Object -ExpandProperty ProcessId)
${fallbackPid}
$processIds | Sort-Object -Unique | ForEach-Object {
  Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
}
`;
  spawnSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 5000
  });
}

function ps(script, options = {}){
  return new Promise((resolve, reject) => {
    let finished = false;
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timeoutMs = Number(options.timeoutMs || 15000);
    const timer = timeoutMs > 0 ? setTimeout(() => {
      if(finished) return;
      finished = true;
      try{
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore"
        }).unref();
      }catch(err){
        try{ child.kill("SIGKILL"); }catch(killErr){}
      }
      reject(new Error("PowerShell excedeu o tempo limite"));
    }, timeoutMs) : null;
    child.stdout.on("data", (data) => stdout += data.toString());
    child.stderr.on("data", (data) => stderr += data.toString());
    child.on("error", (err) => {
      if(finished) return;
      finished = true;
      if(timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if(finished) return;
      finished = true;
      if(timer) clearTimeout(timer);
      if(code === 0) resolve({stdout: stdout.trim(), stderr: stderr.trim()});
      else reject(new Error(stderr.trim() || "PowerShell saiu com codigo " + code));
    });
  });
}

function ensureSpeechWorker(){
  if(speechProcess && !speechProcess.killed) return speechProcess;
  speechReady = false;
  const worker = `
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.Volume = 100
[Console]::WriteLine('READY')
while (($line = [Console]::ReadLine()) -ne $null) {
  try {
    $parts = $line.Split('|', 2)
    $text = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($parts[1]))
    $voice.Speak($text)
    [Console]::WriteLine('DONE')
  } catch { [Console]::WriteLine('ERROR') }
  [Console]::Out.Flush()
}
$voice.Dispose()
`;
  speechProcess = spawn("powershell.exe", ["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",worker], {windowsHide:true});
  speechProcess.stdout.on("data", (chunk) => {
    speechBuffer += chunk.toString("utf8");
    const lines = speechBuffer.split(/\r?\n/);
    speechBuffer = lines.pop() || "";
    for(const line of lines){
      if(line.trim() === "READY") speechReady = true;
      if(line.trim() === "DONE" || line.trim() === "ERROR"){
        const pending = speechQueue.shift();
        if(pending) pending(line.trim() === "DONE");
      }
    }
  });
  speechProcess.on("exit", () => {
    speechProcess = null;
    speechReady = false;
    while(speechQueue.length) speechQueue.shift()(false);
  });
  return speechProcess;
}

function speakWindowsFast(text, voiceEngine){
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 5000);
  if(!clean) return Promise.resolve({spoken:false});
  const worker = ensureSpeechWorker();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("voz excedeu o tempo limite")), Math.max(12000, clean.length * 100));
    speechQueue.push((ok) => {
      clearTimeout(timeout);
      if(ok) resolve({spoken:true, voice:"Microsoft Maria Desktop"});
      else reject(new Error("falha no sintetizador de voz"));
    });
    const send = () => {
      if(!speechReady) return setTimeout(send, 40);
      worker.stdin.write("stable|" + Buffer.from(clean, "utf16le").toString("base64") + "\n");
    };
    send();
  });
}

function appPath(...parts){
  return path.resolve(__dirname, "..", "..", ...parts);
}

function psString(value){
  return String(value || "").replace(/'/g, "''");
}

function maiaDataPath(...parts){
  const currentDir = path.join(os.homedir(), ".maia");
  return path.join(currentDir, ...parts);
}

function arkamaConfigPath(){
  return maiaDataPath("arkama-webhook.json");
}

function arkamaSalesLogPath(){
  return maiaDataPath("arkama-sales.jsonl");
}

function netlifySalesConfigPath(){
  return maiaDataPath("netlify-sales.json");
}

function homeAssistantConfigPath(){
  return maiaDataPath("home-assistant.json");
}

function mobilityConfigPath(){
  return maiaDataPath("mobility.json");
}

function readJsonConfig(file){
  try{
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return value && typeof value === "object" ? value : null;
  }catch(err){
    return null;
  }
}

function writeJsonConfig(file, value){
  ensureMaiaDataDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2), {encoding:"utf8", mode:0o600});
}

async function fetchJson(url, options = {}, timeoutMs = 12000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    const response = await fetch(url, {...options, signal:controller.signal, cache:"no-store"});
    const data = await response.json().catch(() => null);
    if(!response.ok){
      const detail = data && (data.message || data.error || data.error_message);
      throw new Error(detail || `serviço respondeu ${response.status}`);
    }
    return data;
  }catch(err){
    if(err && err.name === "AbortError") throw new Error("tempo de conexão esgotado");
    throw err;
  }finally{
    clearTimeout(timer);
  }
}

function normalizeBaseUrl(value){
  const url = new URL(String(value || "").trim());
  if(!["http:","https:"].includes(url.protocol)) throw new Error("use um endereço HTTP ou HTTPS");
  if(url.username || url.password || url.search || url.hash) throw new Error("endereço inválido");
  return url.origin + url.pathname.replace(/\/+$/, "");
}

function readHomeAssistantConfig(){
  const config = readJsonConfig(homeAssistantConfigPath());
  return config && config.baseUrl && config.token ? config : null;
}

async function homeAssistantRequest(pathname, options = {}){
  const config = readHomeAssistantConfig();
  if(!config) throw new Error("Home Assistant ainda não foi configurado");
  return fetchJson(config.baseUrl + pathname, {
    ...options,
    headers:{Authorization:"Bearer " + config.token, "Content-Type":"application/json", ...(options.headers || {})}
  });
}

async function configureHomeAssistant(baseUrl, token){
  const config = {
    baseUrl:normalizeBaseUrl(baseUrl),
    token:String(token || "").trim(),
    updatedAt:new Date().toISOString()
  };
  if(config.token.length < 20) throw new Error("informe um token de acesso de longa duração válido");
  const previous = readHomeAssistantConfig();
  writeJsonConfig(homeAssistantConfigPath(), config);
  try{
    const details = await homeAssistantRequest("/api/config");
    return {configured:true, connected:true, baseUrl:config.baseUrl, locationName:details.location_name || "Home Assistant", version:details.version || ""};
  }catch(err){
    if(previous) writeJsonConfig(homeAssistantConfigPath(), previous);
    else fs.rmSync(homeAssistantConfigPath(), {force:true});
    throw new Error("não foi possível conectar ao Home Assistant: " + err.message);
  }
}

async function homeAssistantStatus(){
  const config = readHomeAssistantConfig();
  if(!config) return {configured:false, connected:false};
  try{
    const details = await homeAssistantRequest("/api/config");
    return {configured:true, connected:true, baseUrl:config.baseUrl, locationName:details.location_name || "Home Assistant", version:details.version || "", updatedAt:config.updatedAt};
  }catch(err){
    return {configured:true, connected:false, baseUrl:config.baseUrl, error:err.message, updatedAt:config.updatedAt};
  }
}

async function homeAssistantEntities(){
  const states = await homeAssistantRequest("/api/states");
  const allowed = new Set(["light","switch","scene","automation","climate","fan","cover","lock","media_player","sensor","binary_sensor"]);
  return states.filter(item => allowed.has(String(item.entity_id || "").split(".")[0])).map(item => ({
    entityId:item.entity_id,
    domain:String(item.entity_id).split(".")[0],
    name:String(item.attributes && item.attributes.friendly_name || item.entity_id),
    state:item.state,
    unit:item.attributes && item.attributes.unit_of_measurement || "",
    temperature:item.attributes && item.attributes.current_temperature,
    brightness:item.attributes && item.attributes.brightness
  })).sort((a,b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 1000);
}

async function homeAssistantControl(payload){
  const entityId = String(payload && payload.entityId || "").trim();
  const domain = String(payload && payload.domain || entityId.split(".")[0]).trim();
  const service = String(payload && payload.service || "").trim();
  const allowed = {
    light:new Set(["turn_on","turn_off","toggle"]),
    switch:new Set(["turn_on","turn_off","toggle"]),
    fan:new Set(["turn_on","turn_off","toggle"]),
    cover:new Set(["open_cover","close_cover","stop_cover"]),
    lock:new Set(["lock","unlock"]),
    climate:new Set(["turn_on","turn_off","set_temperature"]),
    scene:new Set(["turn_on"]),
    automation:new Set(["trigger","turn_on","turn_off"]),
    media_player:new Set(["turn_on","turn_off","media_play_pause","volume_set"])
  };
  if(!entityId || !/^[a-z_]+\.[a-z0-9_]+$/.test(entityId)) throw new Error("entidade inválida");
  if(!allowed[domain] || !allowed[domain].has(service)) throw new Error("ação não permitida para esta entidade");
  const serviceData = {entity_id:entityId};
  if(service === "set_temperature") serviceData.temperature = Math.max(5, Math.min(35, Number(payload.temperature) || 22));
  if(service === "volume_set") serviceData.volume_level = Math.max(0, Math.min(1, Number(payload.volume) || 0));
  if(service === "turn_on" && domain === "light" && Number.isFinite(Number(payload.brightness))) serviceData.brightness_pct = Math.max(1, Math.min(100, Number(payload.brightness)));
  await homeAssistantRequest(`/api/services/${domain}/${service}`, {method:"POST", body:JSON.stringify(serviceData)});
  return {ok:true, entityId, service};
}

function readMobilityConfig(){
  return readJsonConfig(mobilityConfigPath()) || {};
}

function configureMobility(payload){
  const current = readMobilityConfig();
  const config = {
    city:String(payload && payload.city || current.city || "").trim().slice(0,120),
    origin:String(payload && payload.origin || current.origin || "").trim().slice(0,240),
    googleApiKey:String(payload && payload.googleApiKey || current.googleApiKey || "").trim(),
    updatedAt:new Date().toISOString()
  };
  if(config.googleApiKey && config.googleApiKey.length < 20) throw new Error("chave da API Google Routes inválida");
  writeJsonConfig(mobilityConfigPath(), config);
  return {configured:true, city:config.city, origin:config.origin, trafficConfigured:Boolean(config.googleApiKey), updatedAt:config.updatedAt};
}

function mobilityStatus(){
  const config = readMobilityConfig();
  return {configured:Boolean(config.city || config.origin || config.googleApiKey), city:config.city || "", origin:config.origin || "", trafficConfigured:Boolean(config.googleApiKey), updatedAt:config.updatedAt || null};
}

async function geocodeOpenMeteo(name){
  const query = String(name || "").trim();
  if(query.length < 2) throw new Error("informe uma cidade");
  const data = await fetchJson("https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name=" + encodeURIComponent(query));
  const found = data && data.results && data.results[0];
  if(!found) throw new Error("cidade não encontrada");
  return {latitude:found.latitude, longitude:found.longitude, name:[found.name,found.admin1,found.country].filter(Boolean).join(", "), timezone:found.timezone || "auto"};
}

async function completeWeather(location){
  const config = readMobilityConfig();
  const place = await geocodeOpenMeteo(location || config.city);
  const params = new URLSearchParams({
    latitude:String(place.latitude), longitude:String(place.longitude), timezone:"auto", forecast_days:"7",
    current:"temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m",
    hourly:"temperature_2m,apparent_temperature,precipitation_probability,weather_code,visibility,wind_speed_10m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max"
  });
  const data = await fetchJson("https://api.open-meteo.com/v1/forecast?" + params);
  return {location:place, current:data.current || {}, hourly:data.hourly || {}, daily:data.daily || {}, units:{current:data.current_units || {},hourly:data.hourly_units || {},daily:data.daily_units || {}}};
}

async function trafficRoute(payload){
  const config = readMobilityConfig();
  if(!config.googleApiKey) throw new Error("configure uma chave da API Google Routes");
  const origin = String(payload && payload.origin || config.origin || "").trim();
  const destination = String(payload && payload.destination || "").trim();
  if(!origin || !destination) throw new Error("informe origem e destino");
  const body = {
    origin:{address:origin}, destination:{address:destination}, travelMode:"DRIVE",
    routingPreference:"TRAFFIC_AWARE_OPTIMAL", computeAlternativeRoutes:true,
    languageCode:"pt-BR", units:"METRIC"
  };
  const data = await fetchJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method:"POST",
    headers:{"Content-Type":"application/json","X-Goog-Api-Key":config.googleApiKey,"X-Goog-FieldMask":"routes.duration,routes.staticDuration,routes.distanceMeters,routes.description,routes.routeLabels"},
    body:JSON.stringify(body)
  }, 18000);
  const routes = (data.routes || []).map(route => {
    const seconds = Math.round(Number(String(route.duration || "0s").replace("s","")));
    const staticSeconds = Math.round(Number(String(route.staticDuration || "0s").replace("s","")));
    return {
      durationMinutes:Math.round(seconds / 60),
      normalMinutes:Math.round(staticSeconds / 60),
      delayMinutes:Math.max(0, Math.round((seconds - staticSeconds) / 60)),
      distanceKm:Math.round((Number(route.distanceMeters) / 1000) * 10) / 10,
      description:route.description || "",
      labels:route.routeLabels || []
    };
  });
  if(!routes.length) throw new Error("nenhuma rota encontrada");
  return {origin,destination,routes};
}

function readNetlifySalesConfig(){
  try{
    const parsed = JSON.parse(fs.readFileSync(netlifySalesConfigPath(), "utf8"));
    if(parsed && parsed.baseUrl && parsed.deviceToken) return parsed;
  }catch(err){}
  return null;
}

function configureNetlifySales(baseUrl, deviceToken){
  const url = new URL(String(baseUrl || "").trim());
  if(url.protocol !== "https:") throw new Error("o relay Netlify precisa usar HTTPS");
  const token = String(deviceToken || "").trim();
  if(token.length < 32) throw new Error("MAIA_DEVICE_TOKEN invalido");
  const config = {baseUrl:url.origin, deviceToken:token, updatedAt:new Date().toISOString()};
  ensureMaiaDataDir();
  fs.writeFileSync(netlifySalesConfigPath(), JSON.stringify(config, null, 2), "utf8");
  return {configured:true, baseUrl:config.baseUrl, updatedAt:config.updatedAt};
}

function netlifySalesStatus(){
  const config = readNetlifySalesConfig();
  return config
    ? {configured:true, baseUrl:config.baseUrl, polling:Boolean(netlifySalesTimer), updatedAt:config.updatedAt}
    : {configured:false, polling:false};
}

async function pollNetlifySales(){
  if(netlifySalesPolling) return;
  const config = readNetlifySalesConfig();
  if(!config) return;
  netlifySalesPolling = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try{
    const response = await fetch(config.baseUrl + "/api/maia-sales", {
      headers:{Authorization:"Bearer " + config.deviceToken, "User-Agent":"MaiaDesktop/1.0"},
      cache:"no-store",
      signal:controller.signal
    });
    if(!response.ok) throw new Error("Netlify respondeu " + response.status);
    const data = await response.json();
    const sales = Array.isArray(data.sales) ? data.sales.slice(0, 50) : [];
    const acknowledged = [];
    for(const sale of sales){
      const normalized = normalizeArkamaSale({event:"ORDER_PAID", data:{order:sale}});
      normalized.product = sale.product || normalized.product;
      normalized.customerName = sale.customerName || normalized.customerName;
      normalized.receivedAt = sale.receivedAt || normalized.receivedAt;
      registerApprovedSale(normalized, {source:"netlify-relay"});
      acknowledged.push(normalized.id);
    }
    if(acknowledged.length){
      const ack = await fetch(config.baseUrl + "/api/maia-ack", {
        method:"POST",
        headers:{Authorization:"Bearer " + config.deviceToken, "Content-Type":"application/json", "User-Agent":"MaiaDesktop/1.0"},
        body:JSON.stringify({ids:acknowledged}),
        signal:controller.signal
      });
      if(!ack.ok) throw new Error("falha ao confirmar vendas: " + ack.status);
    }
  }catch(err){
    if(process.env.MAIA_DEBUG) console.warn("[maia:netlify] Relay indisponível:", err.message);
  }finally{
    clearTimeout(timer);
    netlifySalesPolling = false;
  }
}

function startNetlifySalesPolling(){
  if(netlifySalesTimer) return;
  pollNetlifySales();
  netlifySalesTimer = setInterval(pollNetlifySales, 15000);
}

function stopNetlifySalesPolling(){
  if(netlifySalesTimer) clearInterval(netlifySalesTimer);
  netlifySalesTimer = null;
}

function readArkamaConfig(){
  try{
    const parsed = JSON.parse(fs.readFileSync(arkamaConfigPath(), "utf8"));
    if(parsed && parsed.webhookToken) return parsed;
  }catch(err){}
  ensureMaiaDataDir();
  const config = {webhookToken: crypto.randomBytes(24).toString("hex"), createdAt: new Date().toISOString()};
  fs.writeFileSync(arkamaConfigPath(), JSON.stringify(config, null, 2), "utf8");
  return config;
}

function arkamaWebhookStatus(){
  const config = readArkamaConfig();
  return {
    configured: true,
    provider: "arkama",
    localUrl: `http://${HOST}:${PORT}/webhooks/arkama/${config.webhookToken}`,
    route: `/webhooks/arkama/${config.webhookToken}`,
    logFile: arkamaSalesLogPath(),
    acceptedEvents: ["ORDER_PAID", "ORDER_STATUS_CHANGED + PAID"]
  };
}

function firstValue(...values){
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function normalizeArkamaSale(payload){
  const body = payload && typeof payload === "object" ? payload : {};
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const order = data.order && typeof data.order === "object" ? data.order : data;
  const event = String(firstValue(body.event, body.type, body.event_type, "") || "").toUpperCase();
  const status = String(firstValue(order.status, data.status, body.status, "") || "").toUpperCase();
  const approved = event === "ORDER_PAID" || status === "PAID" || status === "APPROVED" || status === "APPROVED_SUCCESS";
  const rawAmount = firstValue(order.total_value, order.value, order.amount, data.total_value, data.value, data.amount, body.amount, body.valor, body.price);
  const amount = Number(String(rawAmount == null ? "0" : rawAmount).replace(/\s/g, "").replace(",", "."));
  const customer = order.customer || data.customer || (data.cart && data.cart.customer) || body.customer || {};
  const items = order.items || data.items || body.items || [];
  const id = String(firstValue(order.id, data.id, body.id, body.order_id, body.transaction_id, crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 20)));
  return {
    approved,
    id,
    event: event || "UNKNOWN",
    status: status || (approved ? "PAID" : "UNKNOWN"),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: String(firstValue(order.currency, data.currency, body.currency, "BRL")),
    paymentMethod: String(firstValue(order.paymentMethod, data.paymentMethod, body.paymentMethod, body.payment_method, "")),
    customerName: String(firstValue(customer.name, customer.full_name, body.customer_name, "")),
    product: String(firstValue(items[0] && (items[0].title || items[0].name), order.product && order.product.name, body.product_name, "Venda Arkama")),
    receivedAt: new Date().toISOString()
  };
}

function registerApprovedSale(sale, rawPayload){
  const now = Date.now();
  for(const [id, timestamp] of processedSales){
    if(now - timestamp > 24 * 60 * 60 * 1000) processedSales.delete(id);
  }
  if(processedSales.has(sale.id)) return false;
  processedSales.set(sale.id, now);
  ensureMaiaDataDir();
  fs.appendFileSync(arkamaSalesLogPath(), JSON.stringify({sale, payload:rawPayload}) + "\n", "utf8");
  broadcastVoice("sale-approved", sale);
  return true;
}

function salesPeriodRange(period, now = new Date()){
  const current = new Date(now);
  let start = null;
  let end = new Date(current.getTime() + 1);
  if(period === "today") start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  if(period === "week"){
    start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
  }
  if(period === "month") start = new Date(current.getFullYear(), current.getMonth(), 1);
  if(period === "previous_month"){
    start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    end = new Date(current.getFullYear(), current.getMonth(), 1);
  }
  return {start, end};
}

function summarizeSales(input, period = "month", now = new Date()){
  const allowedPeriods = new Set(["today", "week", "month", "previous_month", "all"]);
  const selectedPeriod = allowedPeriods.has(period) ? period : "month";
  const {start, end} = salesPeriodRange(selectedPeriod, now);
  const unique = new Map();
  for(const item of Array.isArray(input) ? input : []){
    const sale = item && item.sale ? item.sale : item;
    if(!sale || !sale.id || String(sale.id).startsWith("MAIA-TEST-")) continue;
    const date = new Date(sale.receivedAt || sale.paidAt || sale.createdAt || 0);
    if(!Number.isFinite(date.getTime())) continue;
    if(start && date < start) continue;
    if(end && date >= end) continue;
    unique.set(String(sale.id), sale);
  }
  const sales = [...unique.values()];
  const total = sales.reduce((sum, sale) => sum + Math.max(0, Number(sale.amount) || 0), 0);
  const products = new Map();
  for(const sale of sales){
    const name = String(sale.product || "Produto não informado");
    const entry = products.get(name) || {name, count:0, revenue:0};
    entry.count += 1;
    entry.revenue += Math.max(0, Number(sale.amount) || 0);
    products.set(name, entry);
  }
  const productRanking = [...products.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const largest = sales.reduce((best, sale) => !best || Number(sale.amount) > Number(best.amount) ? sale : best, null);
  return {
    period:selectedPeriod,
    count:sales.length,
    total:Math.round(total * 100) / 100,
    average:sales.length ? Math.round((total / sales.length) * 100) / 100 : 0,
    largest:largest ? {id:largest.id, amount:Number(largest.amount) || 0, product:largest.product || "Produto não informado"} : null,
    topProduct:productRanking[0] || null,
    generatedAt:new Date(now).toISOString()
  };
}

function localSalesSummary(period){
  let entries = [];
  try{
    entries = fs.readFileSync(arkamaSalesLogPath(), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap(line => { try{return [JSON.parse(line)];}catch(err){return [];} });
  }catch(err){}
  return summarizeSales(entries, period || "month");
}

function ensureMaiaDataDir(){
  fs.mkdirSync(maiaDataPath(), {recursive: true});
}

function base64Url(input){
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function spotifyTokenPath(){
  return maiaDataPath("spotify-token.json");
}

function readSpotifyToken(){
  try{
    return JSON.parse(fs.readFileSync(spotifyTokenPath(), "utf8"));
  }catch(err){
    return null;
  }
}

function writeSpotifyToken(token){
  ensureMaiaDataDir();
  fs.writeFileSync(spotifyTokenPath(), JSON.stringify(token, null, 2), "utf8");
}

function spotifyAuthHeaders(){
  return {"Content-Type": "application/x-www-form-urlencoded"};
}

async function requestSpotifyToken(params){
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: spotifyAuthHeaders(),
    body: new URLSearchParams(params)
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(data.error_description || data.error || "falha ao autenticar Spotify");
  return data;
}

async function getSpotifyAccessToken(){
  const token = readSpotifyToken();
  if(!token || !token.refresh_token) throw new Error("Spotify nao conectado. Diga conectar Spotify.");
  if(token.access_token && token.expires_at && Date.now() < token.expires_at - 60000){
    return token.access_token;
  }
  const refreshed = await requestSpotifyToken({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  const next = {
    ...token,
    ...refreshed,
    refresh_token: refreshed.refresh_token || token.refresh_token,
    expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000
  };
  writeSpotifyToken(next);
  return next.access_token;
}

async function spotifyApi(pathname, options = {}){
  const accessToken = await getSpotifyAccessToken();
  const response = await fetch("https://api.spotify.com/v1" + pathname, {
    ...options,
    headers: {
      "Authorization": "Bearer " + accessToken,
      ...(options.headers || {})
    }
  });
  if(response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if(!response.ok){
    const message = data && data.error && data.error.message ? data.error.message : "Spotify respondeu " + response.status;
    const err = new Error(message);
    err.status = response.status;
    err.spotify = data && data.error ? data.error : null;
    throw err;
  }
  return data;
}

function normalizeSpotifyText(value){
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function spotifyTrackScore(track, query){
  const q = normalizeSpotifyText(query);
  const name = normalizeSpotifyText(track && track.name);
  const artists = normalizeSpotifyText((track && track.artists || []).map((artist) => artist.name).join(" "));
  const full = (name + " " + artists).trim();
  let score = 0;
  if(name === q) score += 120;
  if(full === q) score += 135;
  if(name.includes(q)) score += 70;
  if(q.includes(name) && name.length > 2) score += 55;
  const qWords = q.split(/\s+/).filter(Boolean);
  for(const word of qWords){
    if(name.split(/\s+/).includes(word)) score += 16;
    else if(name.includes(word)) score += 8;
    if(artists.split(/\s+/).includes(word)) score += 12;
  }
  if(track && track.popularity) score += Math.min(25, track.popularity / 4);
  return score;
}

function formatSpotifyTrack(track){
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: (track.artists || []).map((artist) => artist.name).join(", "),
    album: track.album && track.album.name || "",
    image: track.album && track.album.images && track.album.images[0] && track.album.images[0].url || "",
    url: track.external_urls && track.external_urls.spotify
  };
}

async function searchSpotifyTracks(query){
  const clean = String(query || "").trim();
  if(!clean) throw new Error("nome da musica ausente");
  const data = await spotifyApi("/search?type=track&limit=8&q=" + encodeURIComponent(clean), {method:"GET"});
  return (data && data.tracks && data.tracks.items || [])
    .filter((item) => item && item.uri)
    .map((item) => ({...formatSpotifyTrack(item), score:spotifyTrackScore(item, clean)}))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function searchSpotifyTrack(query){
  const clean = String(query || "").trim();
  if(!clean) throw new Error("nome da musica ausente");
  const data = await spotifyApi("/search?type=track&limit=8&q=" + encodeURIComponent(clean), {method: "GET"});
  const tracks = data && data.tracks && data.tracks.items ? data.tracks.items : [];
  const track = tracks
    .filter((item) => item && item.uri)
    .sort((a, b) => spotifyTrackScore(b, clean) - spotifyTrackScore(a, clean))[0];
  if(!track || !track.uri) throw new Error("musica nao encontrada no Spotify");
  return formatSpotifyTrack(track);
}

async function spotifyAuthStatus(){
  const token = readSpotifyToken();
  if(!token || !token.refresh_token) return {connected: false};
  try{
    await getSpotifyAccessToken();
    const me = await spotifyApi("/me", {method: "GET"});
    return {connected: true, user: me && (me.display_name || me.id)};
  }catch(err){
    return {connected: false, error: err.message};
  }
}

function startSpotifyLogin(){
  const codeVerifier = base64Url(crypto.randomBytes(64)).slice(0, 96);
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64Url(crypto.randomBytes(24));
  spotifyAuthSession = {codeVerifier, state, createdAt: Date.now()};

  if(!spotifyAuthServer){
    spotifyAuthServer = http.createServer(async (req, res) => {
      try{
        const url = new URL(req.url, SPOTIFY_REDIRECT_URI);
        if(url.pathname !== "/spotify/callback"){
          res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
          res.end("Rota nao encontrada");
          return;
        }
        const code = url.searchParams.get("code");
        const incomingState = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if(error) throw new Error(error);
        if(!spotifyAuthSession || incomingState !== spotifyAuthSession.state) throw new Error("estado OAuth invalido");
        if(!code) throw new Error("codigo OAuth ausente");
        const token = await requestSpotifyToken({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: spotifyAuthSession.codeVerifier
        });
        writeSpotifyToken({
          ...token,
          expires_at: Date.now() + Number(token.expires_in || 3600) * 1000
        });
        spotifyAuthSession = null;
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.end("<h2>Maia conectada ao Spotify.</h2><p>Voce ja pode fechar esta aba.</p>");
      }catch(err){
        res.writeHead(500, {"Content-Type": "text/html; charset=utf-8"});
        res.end("<h2>Falha ao conectar Spotify</h2><p>" + String(err.message || err) + "</p>");
      }
    });
    spotifyAuthServer.listen(17779, HOST);
  }

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  ps(`Start-Process "${authUrl.toString()}"`).catch(() => {});
  return {authUrl: authUrl.toString(), redirectUri: SPOTIFY_REDIRECT_URI};
}

async function spotifyCurrentPlayback(){
  const playback = await spotifyApi("/me/player", {method: "GET"});
  if(!playback || !playback.item) return {playing: false};
  const item = playback.item;
  return {
    playing: Boolean(playback.is_playing),
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists: (item.artists || []).map((artist) => artist.name).join(", "),
    album: item.album && item.album.name || "",
    image: item.album && item.album.images && item.album.images[0] && item.album.images[0].url || "",
    progressMs: playback.progress_ms || 0,
    durationMs: item.duration_ms || 0,
    remainingMs: Math.max(0, (item.duration_ms || 0) - (playback.progress_ms || 0)),
    device: playback.device && playback.device.name,
    volumePercent: playback.device && Number.isFinite(playback.device.volume_percent) ? playback.device.volume_percent : null,
    shuffle: Boolean(playback.shuffle_state),
    repeat: playback.repeat_state || "off"
  };
}

async function spotifyNext(){
  await spotifyApi("/me/player/next", {method:"POST"});
  return {ok:true};
}

async function spotifyPrevious(){
  await spotifyApi("/me/player/previous", {method:"POST"});
  return {ok:true};
}

async function spotifyShuffle(enabled){
  const state = Boolean(enabled);
  await spotifyApi("/me/player/shuffle?state=" + state, {method:"PUT"});
  return {shuffle:state};
}

async function spotifyRepeat(mode){
  const selected = ["off","track","context"].includes(mode) ? mode : "off";
  await spotifyApi("/me/player/repeat?state=" + selected, {method:"PUT"});
  return {repeat:selected};
}

async function spotifySaveCurrent(){
  const current = await spotifyCurrentPlayback();
  if(!current.id) throw new Error("nenhuma musica ativa");
  await spotifyApi("/me/tracks?ids=" + encodeURIComponent(current.id), {method:"PUT"});
  return current;
}

async function spotifySetVolume(level){
  const volume = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
  await spotifyApi("/me/player/volume?volume_percent=" + volume, {method:"PUT"});
  return {volume};
}

async function spotifyFadeVolume(from, to, durationMs = 1500){
  const start = Math.max(0, Math.min(100, Number(from) || 0));
  const end = Math.max(0, Math.min(100, Number(to) || 0));
  const steps = 7;
  const wait = Math.max(90, Math.min(350, Number(durationMs) / steps));
  for(let index = 1; index <= steps; index++){
    const eased = 1 - Math.pow(1 - index / steps, 2);
    await spotifySetVolume(start + (end - start) * eased);
    if(index < steps) await new Promise(resolve => setTimeout(resolve, wait));
  }
  return {volume:Math.round(end)};
}

async function spotifyQueueSearch(query){
  const track = await searchSpotifyTrack(query);
  await spotifyApi("/me/player/queue?uri=" + encodeURIComponent(track.uri), {method: "POST"});
  return track;
}

async function spotifyPlaySearch(query){
  const track = await searchSpotifyTrack(query);
  await spotifyApi("/me/player/play", {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({uris: [track.uri]})
  });
  return {...track, method: "api"};
}

async function spotifyPlayUri(uri){
  const selected = String(uri || "");
  if(!/^spotify:track:[A-Za-z0-9]+$/.test(selected)) throw new Error("faixa Spotify invalida");
  await spotifyApi("/me/player/play", {
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({uris:[selected]})
  });
  return {uri:selected};
}

function spotifyPlaylistScore(playlist, query){
  const wanted = normalizeSpotifyText(query);
  const name = normalizeSpotifyText(playlist && playlist.name);
  if(!wanted || !name) return 0;
  if(name === wanted) return 1000;
  if(name.startsWith(wanted)) return 800 - Math.abs(name.length - wanted.length);
  if(name.includes(wanted)) return 650 - Math.abs(name.length - wanted.length);
  const meaningful = wanted.split(" ").filter((term) => term && !["de","da","do","das","dos","no","na"].includes(term));
  let score = meaningful.reduce((total, term) => total + (name.includes(term) ? 90 : 0), 0);
  if(wanted.includes("mix") && name.includes("mix")) score += 240;
  if(playlist && playlist.owner && /spotify/i.test(String(playlist.owner.display_name || ""))) score += 35;
  return score;
}

async function searchSpotifyPlaylist(query){
  const clean = String(query || "").trim();
  if(!clean) throw new Error("informe o nome da playlist");
  let candidates = [];
  let next = "/me/playlists?limit=50";
  for(let page = 0; next && page < 4; page++){
    const data = await spotifyApi(next, {method:"GET"});
    candidates = candidates.concat(data && data.items || []);
    if(data && data.next){
      const nextUrl = new URL(data.next);
      next = nextUrl.pathname.replace(/^\/v1/, "") + nextUrl.search;
    }else{
      next = "";
    }
  }
  try{
    const global = await spotifyApi("/search?type=playlist&limit=20&q=" + encodeURIComponent(clean), {method:"GET"});
    candidates = candidates.concat(global && global.playlists && global.playlists.items || []);
  }catch(err){}
  const playlist = candidates
    .filter((item) => item && item.uri)
    .sort((a, b) => spotifyPlaylistScore(b, clean) - spotifyPlaylistScore(a, clean))[0];
  if(!playlist || spotifyPlaylistScore(playlist, clean) < 50) throw new Error("playlist nao encontrada no Spotify");
  return {
    name:playlist.name,
    owner:playlist.owner && playlist.owner.display_name || "",
    uri:playlist.uri,
    url:playlist.external_urls && playlist.external_urls.spotify
  };
}

async function spotifyPlayPlaylist(query){
  const playlist = await searchSpotifyPlaylist(query);
  await spotifyApi("/me/player/play", {
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({context_uri:playlist.uri})
  });
  return playlist;
}

async function spotifyPause(){
  const current = await spotifyCurrentPlayback();
  if(!current.playing) return {paused:true, unchanged:true};
  await spotifyApi("/me/player/pause", {method:"PUT"});
  return {paused:true};
}

async function spotifyResume(){
  const current = await spotifyCurrentPlayback();
  if(current.playing) return {playing:true, unchanged:true};
  await spotifyApi("/me/player/play", {method:"PUT"});
  return {playing:true};
}

function keyScript(vk){
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, UInt32 dwFlags, UIntPtr dwExtraInfo);
}
"@
[K]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
[K]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)
`;
}

function mediaNavigationScript(command){
  const keys = {
    forward: "{RIGHT}",
    back: "{LEFT}",
    fullscreen: "{F11}",
    escape: "{ESC}"
  };
  const selected = keys[String(command || "").toLowerCase()];
  if(!selected) throw new Error("comando de mídia inválido");
  const activateStreamingWindow = command === "fullscreen" ? `
$streaming = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Prime Video|Netflix|Disney|Max|Globoplay|Paramount|Crunchyroll|Plex' } |
  Select-Object -First 1
if($streaming){
  $null = $ws.AppActivate($streaming.Id)
  Start-Sleep -Milliseconds 250
}
` : "";
  return `$ws = New-Object -ComObject WScript.Shell
${activateStreamingWindow}
$ws.SendKeys("${selected}")`;
}

function setVolumeScript(level){
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 0));
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr pNotify);
  int UnregisterControlChangeNotify(IntPtr pNotify);
  int GetChannelCount(out uint channelCount);
  int SetMasterVolumeLevel(float levelDB, Guid eventContext);
  int SetMasterVolumeLevelScalar(float level, Guid eventContext);
  int GetMasterVolumeLevel(out float levelDB);
  int GetMasterVolumeLevelScalar(out float level);
  int SetChannelVolumeLevel(uint channelNumber, float levelDB, Guid eventContext);
  int SetChannelVolumeLevelScalar(uint channelNumber, float level, Guid eventContext);
  int GetChannelVolumeLevel(uint channelNumber, out float levelDB);
  int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
  int SetMute(bool isMuted, Guid eventContext);
  int GetMute(out bool isMuted);
  int GetVolumeStepInfo(out uint step, out uint stepCount);
  int VolumeStepUp(Guid eventContext);
  int VolumeStepDown(Guid eventContext);
  int QueryHardwareSupport(out uint hardwareSupportMask);
  int GetVolumeRange(out float volumeMindB, out float volumeMaxdB, out float volumeIncrementdB);
}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
  int NotImpl1();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
  int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IAudioEndpointVolume ppInterface);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject {}

public class AudioVolume {
  public static void Set(int percent) {
    percent = Math.Max(0, Math.Min(100, percent));
    IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
    IMMDevice device;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    IAudioEndpointVolume volume;
    Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out volume));
    Marshal.ThrowExceptionForHR(volume.SetMute(false, Guid.Empty));
    Marshal.ThrowExceptionForHR(volume.SetMasterVolumeLevelScalar(percent / 100f, Guid.Empty));
  }
}
"@
[AudioVolume]::Set(${safeLevel})
`;
}

function nativeVoiceScript(){
  return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$culture = [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR')
$recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($culture)
$recognizer.SetInputToDefaultAudioDevice()
$commands = @(
  'maia tocar spotify','maia toque spotify','maia toca spotify','maia reproduzir spotify',
  'maia aumentar volume','maia diminuir volume','maia abaixar volume',
  'maia pausar','maia pause','maia pausar musica','maia continuar musica','maia despausar musica','maia retomar musica','maia proxima musica','maia avancar','maia pular musica','maia passa essa','maia musica anterior','maia volta uma',
  'maia abrir spotify','maia ajuda','maia que horas sao','maia bloquear o computador','maia bloquear a tela','maia travar o pc',
  'maia modo trabalho','maia modo jogo','maia modo noite',
  'maia me lembre','maia desligar computador',
  'tocar spotify','toque spotify','toca spotify','reproduzir spotify',
  'aumentar volume','aumenta o som','mais alto','diminuir volume','abaixar volume','baixa o som','mais baixo','pausar','pause','pausar musica','continuar musica','despausar musica','retomar musica','dar play','proxima musica','avancar','pular musica','passa essa','trocar musica','musica anterior','volta uma','a de antes',
  'abrir spotify','que horas sao','ajuda','bloquear o computador','bloquear a tela','travar o pc','confirmar','cancelar'
)
$choices = [System.Speech.Recognition.Choices]::new()
$choices.Add([string[]]$commands)
$words = [System.Speech.Recognition.Choices]::new()
$words.Add([string[]]@(
  'maia','jarves','jarviz','jarvys','jervis','dmaia',
  'tocar','toque','toca','reproduzir','colocar','coloca','bota','botar',
  'spotify','abrir spotify','aumentar volume','diminuir volume','abaixar volume',
  'pausar','pause','continuar','despausar','retomar','musica','proxima musica','musica anterior','calcule','calcular','bloquear','bloqueie','travar','computador','tela','pc','confirmar','cancelar',
  'anote','crie uma tarefa','nova tarefa','ajuda','que horas sao'
))
$exactBuilder = [System.Speech.Recognition.GrammarBuilder]::new()
$exactBuilder.Culture = [System.Globalization.CultureInfo]'pt-BR'
$exactBuilder.Append($choices)
$wildBuilder = [System.Speech.Recognition.GrammarBuilder]::new()
$wildBuilder.Culture = [System.Globalization.CultureInfo]'pt-BR'
$wildBuilder.Append($words)
$wildBuilder.AppendWildcard()
$keywordBuilder = [System.Speech.Recognition.GrammarBuilder]::new()
$keywordBuilder.Culture = [System.Globalization.CultureInfo]'pt-BR'
$keywordBuilder.Append($words)
$recognizer.LoadGrammar([System.Speech.Recognition.Grammar]::new($exactBuilder))
$recognizer.LoadGrammar([System.Speech.Recognition.Grammar]::new($wildBuilder))
$recognizer.LoadGrammar([System.Speech.Recognition.Grammar]::new($keywordBuilder))
$recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
$recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)
$recognizer.BabbleTimeout = [TimeSpan]::FromSeconds(3)
$recognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(1250)
$recognizer.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(1650)
$payload = [pscustomobject]@{ type='status'; text='native voice ready'; confidence=1 }
[Console]::WriteLine(($payload | ConvertTo-Json -Compress))
[Console]::Out.Flush()
while($true){
  try{
    $result = $recognizer.Recognize([TimeSpan]::FromSeconds(10))
    if($result -and $result.Text){
      $payload = [pscustomobject]@{ type='result'; text=$result.Text; confidence=$result.Confidence }
      [Console]::WriteLine(($payload | ConvertTo-Json -Compress))
      [Console]::Out.Flush()
    } else {
      $payload = [pscustomobject]@{ type='partial'; text='escutando'; confidence=0 }
      [Console]::WriteLine(($payload | ConvertTo-Json -Compress))
      [Console]::Out.Flush()
    }
  } catch {
    $payload = [pscustomobject]@{ type='error'; text=$_.Exception.Message; confidence=0 }
    [Console]::WriteLine(($payload | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
    Start-Sleep -Milliseconds 500
  }
}
`;
}

function startNativeVoice(){
  if(voiceProcess && !voiceProcess.killed) return {started: false, running: true};

  voiceProcess = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    nativeVoiceScript()
  ], {
    windowsHide: true
  });

  let buffer = "";
  voiceProcess.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for(const line of lines){
      const trimmed = line.trim();
      if(!trimmed) continue;
      try{
        const payload = JSON.parse(trimmed);
        broadcastVoice(payload.type === "error" ? "native-error" : (payload.type || "result"), payload);
      }catch(err){
        broadcastVoice("diagnostic", {message: trimmed});
      }
    }
  });

  voiceProcess.stderr.on("data", (chunk) => {
    broadcastVoice("native-error", {message: chunk.toString("utf8").trim()});
  });

  voiceProcess.on("exit", (code) => {
    broadcastVoice("status", {running: false, code});
    voiceProcess = null;
  });

  broadcastVoice("status", {running: true});
  return {started: true, running: true};
}

function stopNativeVoice(){
  if(voiceProcess && !voiceProcess.killed){
    voiceProcess.kill();
  }
  voiceProcess = null;
  return {running: false};
}

function spotifySearchScript(query){
  const encoded = encodeURIComponent(query || "");
  if(encoded){
    return `Start-Process "spotify:search:${encoded}"`;
  }
  return `Start-Process "spotify:"`;
}

function spotifySearchAndPlayScript(query){
  const safeQuery = String(query || "").replace(/'/g, "''");
  return `
Start-Process "spotify:"
Start-Sleep -Milliseconds 1200
$ws = New-Object -ComObject WScript.Shell
$null = $ws.AppActivate("Spotify")
Start-Sleep -Milliseconds 250
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class U {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(UInt32 dwFlags, UInt32 dx, UInt32 dy, UInt32 dwData, UIntPtr dwExtraInfo);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@
$proc = Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if($proc){
  [U]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 220
  $rect = New-Object RECT
  [U]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  $oldClipboard = $null
  try { $oldClipboard = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch {}
  Set-Clipboard -Value '${safeQuery}'

  function Click-At([int]$x, [int]$y, [int]$times = 1){
    [U]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 120
    for($i = 0; $i -lt $times; $i++){
      [U]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
      [U]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
      Start-Sleep -Milliseconds 120
    }
  }

  # Sempre comeca pela tela inicial: clica na lupa de pesquisa do topo,
  # que fica mais ao centro da janela no layout atual do Spotify.
  $searchIconX = $rect.Left + [Math]::Max(360, [int]($w * 0.42))
  $searchIconY = $rect.Top + [Math]::Max(48, [int]($h * 0.055))
  Click-At $searchIconX $searchIconY
  Start-Sleep -Milliseconds 450

  # Depois da lupa, tenta focar o campo real de busca por UI Automation.
  # Se o Spotify nao expuser o campo, cai no clique por coordenada.
  $focusedSearch = $false
  try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Edit
    )
    $edits = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    for($i = 0; $i -lt $edits.Count; $i++){
      $edit = $edits.Item($i)
      if($edit.Current.IsEnabled -and -not $edit.Current.IsOffscreen){
        $edit.SetFocus()
        $focusedSearch = $true
        break
      }
    }
  } catch {}

  if(-not $focusedSearch){
    $searchInputX = $rect.Left + [Math]::Max(390, [int]($w * 0.45))
    $searchInputY = $rect.Top + [Math]::Max(48, [int]($h * 0.055))
    Click-At $searchInputX $searchInputY
  }
  Start-Sleep -Milliseconds 250
  $ws.SendKeys("^a")
  Start-Sleep -Milliseconds 100
  $ws.SendKeys("^v")
  Start-Sleep -Milliseconds 280
  $ws.SendKeys("{ENTER}")
  Start-Sleep -Milliseconds 1200

  # Clique unico no botao verde de play do primeiro resultado do topo.
  $topResultX = $rect.Left + [Math]::Max(695, [int]($w * 0.715))
  $topResultY = $rect.Top + [Math]::Max(199, [int]($h * 0.216))
  Click-At $topResultX $topResultY 1
  Start-Sleep -Milliseconds 350
  $ws.SendKeys("% ")
  Start-Sleep -Milliseconds 120
  $ws.SendKeys("n")
  if($oldClipboard -ne $null){ Set-Clipboard -Value $oldClipboard }
} else {
  throw "Janela do Spotify nao encontrada"
}
`;
}

function openProgramScript(program){
  const aliases = {
    chrome: "chrome.exe",
    navegador: "chrome.exe",
    edge: "msedge.exe",
    vscode: "code",
    "vs code": "code",
    bloco: "notepad.exe",
    "bloco de notas": "notepad.exe",
    calculadora: "calc.exe",
    camera: "microsoft.windows.camera:",
    "câmera": "microsoft.windows.camera:",
    webcam: "microsoft.windows.camera:",
    spotify: "spotify:",
    "prime video": "shell:AppsFolder\\AmazonVideo.PrimeVideo_pwbj9vvecjh7j!PWA",
    prime: "shell:AppsFolder\\AmazonVideo.PrimeVideo_pwbj9vvecjh7j!PWA",
    explorer: "explorer.exe",
    arquivos: "explorer.exe"
  };
  const key = String(program || "").toLowerCase().trim();
  const target = aliases[key] || key.replace(/[^a-z0-9 ._-]/gi, "");
  return `Start-Process "${target.replace(/"/g, "")}"`;
}

const STREAMING_SERVICES = {
  prime: {
    label: "Prime Video",
    appNames: ["Prime Video"],
    web: "https://www.primevideo.com/",
    search: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase="
  },
  netflix: {
    label: "Netflix",
    appNames: ["Netflix"],
    web: "https://www.netflix.com/browse",
    search: "https://www.netflix.com/search?q="
  },
  disney: {
    label: "Disney Plus",
    appNames: ["Disney+", "Disney Plus"],
    web: "https://www.disneyplus.com/",
    search: "https://www.disneyplus.com/search/"
  },
  max: {
    label: "Max",
    appNames: ["Max", "HBO Max"],
    web: "https://play.max.com/",
    search: "https://play.max.com/search?q="
  },
  globoplay: {
    label: "Globoplay",
    appNames: ["Globoplay"],
    web: "https://globoplay.globo.com/",
    search: "https://globoplay.globo.com/busca/?q="
  },
  paramount: {
    label: "Paramount Plus",
    appNames: ["Paramount+", "Paramount Plus"],
    web: "https://www.paramountplus.com/",
    search: "https://www.paramountplus.com/search/?query="
  },
  crunchyroll: {
    label: "Crunchyroll",
    appNames: ["Crunchyroll"],
    web: "https://www.crunchyroll.com/",
    search: "https://www.crunchyroll.com/search?q="
  },
  plex: {
    label: "Plex",
    appNames: ["Plex"],
    web: "https://app.plex.tv/desktop/",
    search: "https://app.plex.tv/desktop/#!/search?query="
  }
};

function normalizeStreamingService(service){
  const value = String(service || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if(/prime|amazon/.test(value)) return "prime";
  if(/netflix/.test(value)) return "netflix";
  if(/disney/.test(value)) return "disney";
  if(/\bmax\b|hbo/.test(value)) return "max";
  if(/globo/.test(value)) return "globoplay";
  if(/paramount/.test(value)) return "paramount";
  if(/crunchy/.test(value)) return "crunchyroll";
  if(/plex/.test(value)) return "plex";
  return "";
}

function streamingOpenScript(service, query){
  const key = normalizeStreamingService(service);
  const item = STREAMING_SERVICES[key];
  if(!item) throw new Error("servico de streaming nao reconhecido");
  const names = item.appNames.map((name) => `'${name.replace(/'/g, "''")}'`).join(",");
  const cleanQuery = String(query || "").trim().slice(0, 180);
  const fallback = cleanQuery && item.search
    ? item.search + encodeURIComponent(cleanQuery)
    : item.web;
  const safeFallback = fallback.replace(/'/g, "''");
  return `
$names = @(${names})
$installed = Get-StartApps | Where-Object { $names -contains $_.Name } | Select-Object -First 1
if('${cleanQuery.replace(/'/g, "''")}'){
  Start-Process '${safeFallback}'
} elseif($installed){
  Start-Process ('shell:AppsFolder\\' + $installed.AppID)
} else {
  Start-Process '${safeFallback}'
}
`;
}

async function integrationStatus(){
  let installed = [];
  try{
    const result = await ps(`Get-StartApps | Where-Object { $_.Name -match 'Spotify|YouTube|Prime Video|Netflix|Disney|Max|Globoplay|Paramount|Crunchyroll|Plex' } | Select-Object Name,AppID | ConvertTo-Json -Compress`);
    const raw = String(result && result.stdout || "").trim();
    if(raw) installed = [].concat(JSON.parse(raw));
  }catch(err){}
  let spotify = {connected:false};
  try{ spotify = await spotifyAuthStatus(); }catch(err){}
  return {
    spotify,
    installed:installed.map(item => ({name:item.Name, appId:item.AppID})),
    extensions:extensionManifests,
    bridge:true,
    speechHelper:Boolean(voiceProcess && !voiceProcess.killed)
  };
}

function closeProgramScript(program){
  const aliases = {
    chrome: "chrome",
    navegador: "chrome",
    edge: "msedge",
    vscode: "Code",
    "vs code": "Code",
    bloco: "notepad",
    "bloco de notas": "notepad",
    calculadora: "CalculatorApp",
    camera: "WindowsCamera",
    "câmera": "WindowsCamera",
    webcam: "WindowsCamera",
    spotify: "Spotify"
  };
  const key = String(program || "").toLowerCase().trim();
  const processName = aliases[key] || key.replace(/[^a-z0-9 ._-]/gi, "");
  return `Get-Process -Name "${processName.replace(/"/g, "")}" -ErrorAction SilentlyContinue | Stop-Process -Force`;
}

function shutdownScript(seconds){
  const delay = Math.max(0, Math.min(3600, Number(seconds) || 30));
  return `shutdown.exe /s /t ${delay}`;
}

function restartScript(){
  return `shutdown.exe /r /t 5`;
}

function sleepScript(){
  return `rundll32.exe powrprof.dll,SetSuspendState 0,1,0`;
}

function lockScript(){
  return `rundll32.exe user32.dll,LockWorkStation`;
}

function meetingOpenScript(){
  return `
$apps = @("ms-teams:", "zoommtg:", "https://meet.google.com/")
foreach($app in $apps){
  try {
    Start-Process $app
    break
  } catch {}
}
`;
}

function windowOrganizeScript(){
  return `
$shell = New-Object -ComObject Shell.Application
$shell.TileVertically()
`;
}

function youtubePlayScript(query){
  const encoded = encodeURIComponent(query || "");
  return `Start-Process "https://www.youtube.com/results?search_query=${encoded}"`;
}

async function youtubePlay(query){
  const clean = String(query || "").trim();
  if(!clean) throw new Error("informe o que devo reproduzir no YouTube");
  const searchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(clean);
  let targetUrl = searchUrl;
  let direct = false;
  try{
    const response = await fetch(searchUrl, {
      headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"},
      signal:AbortSignal.timeout(7000)
    });
    if(response.ok){
      const html = await response.text();
      const ids = [...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map((match) => match[1]);
      const videoId = ids.find((id, index) => ids.indexOf(id) === index);
      if(videoId){
        targetUrl = "https://www.youtube.com/watch?v=" + videoId + "&autoplay=1";
        direct = true;
      }
    }
  }catch(err){}
  await ps(`Start-Process "${targetUrl}"`);
  return {direct, url:targetUrl, query:clean};
}

async function youtubeSearch(query){
  const clean = String(query || "").trim();
  if(!clean) throw new Error("informe o que devo pesquisar no YouTube");
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(clean);
  await ps(`Start-Process "${url}"`);
  return {url, query:clean};
}

async function youtubeAppStatus(){
  try{
    const result = await ps(`$app = Get-StartApps | Where-Object { $_.Name -match '^YouTube$|YouTube' } | Select-Object -First 1 Name,AppID; if($app){ $app | ConvertTo-Json -Compress }`);
    const raw = String(result && result.stdout || "").trim();
    if(raw){
      const appInfo = JSON.parse(raw);
      return {installed:true, name:appInfo.Name, appId:appInfo.AppID};
    }
  }catch(err){}
  return {installed:false};
}

async function youtubeOpen(){
  const status = await youtubeAppStatus();
  if(status.installed && status.appId){
    try{
      const safeAppId = String(status.appId).replace(/'/g, "''");
      await ps(`Start-Process ('shell:AppsFolder\\' + '${safeAppId}')`);
      return {...status, method:"app"};
    }catch(err){}
  }
  await ps(`Start-Process 'https://www.youtube.com/'`);
  return {installed:Boolean(status.installed), method:"browser"};
}

function recentDownloads(){
  const directory = path.join(os.homedir(), "Downloads");
  try{
    return fs.readdirSync(directory, {withFileTypes:true})
      .filter(entry => entry.isFile() && !/\.(?:crdownload|part|tmp)$/i.test(entry.name))
      .map(entry => {
        const fullPath = path.join(directory, entry.name);
        const stat = fs.statSync(fullPath);
        return {name:entry.name, path:fullPath, size:stat.size, modifiedAt:stat.mtimeMs};
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 12);
  }catch(err){ return []; }
}

function openLatestDownload(){
  const latest = recentDownloads()[0];
  if(!latest) throw new Error("nenhum download concluido encontrado");
  const child = spawn("explorer.exe", [latest.path], {detached:true, stdio:"ignore", windowsHide:true});
  child.unref();
  return latest;
}

function clipboardWriteScript(text){
  const safe = String(text || "").replace(/'/g, "''");
  return `Set-Clipboard -Value '${safe}'`;
}

function fileSearchScript(query){
  const safe = String(query || "").replace(/'/g, "''");
  return `
$roots = @("$env:USERPROFILE\\Desktop", "$env:USERPROFILE\\Documents", "$env:USERPROFILE\\Downloads")
$found = $null
foreach($root in $roots){
  if(Test-Path $root){
    $found = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*${safe}*" } | Select-Object -First 1
    if($found){ break }
  }
}
if($found){
  Start-Process explorer.exe "/select,\`"$($found.FullName)\`""
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $found.FullName
}
`;
}

async function networkStatus(){
  const cacheAge = Date.now() - networkHealth.checkedAt;
  if(networkHealth.online !== null && cacheAge < 12000){
    return {online:networkHealth.online, host:"multi-check", avgMs:networkHealth.avgMs};
  }
  if(networkStatusPromise) return networkStatusPromise;
  networkStatusPromise = (async () => {
    const startedAt = Date.now();
    const endpoints = [
      "https://www.gstatic.com/generate_204",
      "https://www.msftconnecttest.com/connecttest.txt",
      "https://cp.cloudflare.com/generate_204"
    ];
    let success = false;
    await Promise.all(endpoints.map(async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try{
        const response = await fetch(url, {
          method:"GET",
          cache:"no-store",
          redirect:"follow",
          signal:controller.signal,
          headers:{"user-agent":"Maia-Connectivity/1.0"}
        });
        if(response.status >= 200 && response.status < 500) success = true;
      }catch(err){}finally{
        clearTimeout(timeout);
      }
    }));
    networkHealth.checkedAt = Date.now();
    if(success){
      networkHealth.online = true;
      networkHealth.consecutiveFailures = 0;
      networkHealth.lastSuccessAt = Date.now();
      networkHealth.avgMs = Date.now() - startedAt;
    }else{
      networkHealth.consecutiveFailures += 1;
      const recentlyOnline = Date.now() - networkHealth.lastSuccessAt < 90000;
      if(networkHealth.online === null){
        networkHealth.online = false;
      }else if(!recentlyOnline && networkHealth.consecutiveFailures >= 3){
        networkHealth.online = false;
        networkHealth.avgMs = null;
      }
    }
    return {online:networkHealth.online, host:"multi-check", avgMs:networkHealth.avgMs};
  })().finally(() => {
    networkStatusPromise = null;
  });
  return networkStatusPromise;
}

async function networkDevices(){
  const cacheAge = networkScanCache ? Date.now() - networkScanCache.savedAt : Infinity;
  if(cacheAge < 60000) return networkScanCache.result;
  if(networkScanPromise) return networkScanPromise;
  networkScanPromise = scanNetwork({runProcess})
    .then((result) => {
      networkScanCache = {savedAt: Date.now(), result};
      return result;
    })
    .finally(() => {
      networkScanPromise = null;
    });
  return networkScanPromise;
}

function decodeXmlText(text){
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function newsToday(){
  if(typeof fetch !== "function"){
    throw new Error("Fetch nativo indisponivel nesta versao do Node");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try{
    const response = await fetch("https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419", {
      headers: {"User-Agent": "MaiaLocalBridge/1.0"},
      signal: controller.signal
    });
    if(!response.ok) throw new Error("Noticias indisponiveis: HTTP " + response.status);
    const xml = await response.text();
    const items = [];
    const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
    let match;
    while((match = itemRegex.exec(xml)) && items.length < 5){
      const item = match[0];
      const title = decodeXmlText((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
      const link = decodeXmlText((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]);
      const source = decodeXmlText((item.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
      const publishedAt = decodeXmlText((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
      if(title) items.push({title, source, link, publishedAt});
    }
    return items;
  }finally{
    clearTimeout(timer);
  }
}

function clipboardReadScript(){
  return `
try {
  $text = Get-Clipboard -Raw -ErrorAction Stop
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $text
} catch {
  Write-Output ""
}
`;
}

function screenshotScript(){
  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $env:USERPROFILE "Pictures\\MaiaScreenshots"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$file = Join-Path $dir ("maia-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".png")
$bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output $file
`;
}

function brightnessScript(level){
  const safeLevel = Math.max(0, Math.min(100, Number(level) || 50));
  return `
$methods = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue
if($methods){
  foreach($method in $methods){
    Invoke-CimMethod -InputObject $method -MethodName WmiSetBrightness -Arguments @{Timeout=1; Brightness=${safeLevel}} | Out-Null
  }
} else {
  throw "Controle de brilho nao disponivel neste monitor"
}
`;
}

async function runAction(action, payload){
  switch(action){
    case "brain.think":
      return megaBrain.think(payload && payload.prompt, {
        model: payload && payload.model,
        timeoutMs: 120000
      });
    case "brain.remember":
      return {memory: megaBrain.remember(payload && payload.text, "explicit-user")};
    case "brain.forget":
      return {removed: megaBrain.forget(payload && payload.query)};
    case "brain.status":
      return megaBrain.status();
    case "brain.warmup":
      return megaBrain.warmup();
    case "integration.arkama.status":
      return arkamaWebhookStatus();
    case "integration.status":
      return integrationStatus();
    case "integration.homeAssistant.configure":
      return configureHomeAssistant(payload && payload.baseUrl, payload && payload.token);
    case "integration.homeAssistant.status":
      return homeAssistantStatus();
    case "integration.homeAssistant.entities":
      return homeAssistantEntities();
    case "integration.homeAssistant.control":
      return homeAssistantControl(payload || {});
    case "integration.mobility.configure":
      return configureMobility(payload || {});
    case "integration.mobility.status":
      return mobilityStatus();
    case "weather.complete":
      return completeWeather(payload && payload.location);
    case "traffic.route":
      return trafficRoute(payload || {});
    case "integration.netlify.configure":
      return configureNetlifySales(payload && payload.baseUrl, payload && payload.deviceToken);
    case "integration.netlify.status":
      return netlifySalesStatus();
    case "integration.netlify.poll":
      await pollNetlifySales();
      return netlifySalesStatus();
    case "sales.localSummary":
      return localSalesSummary(payload && payload.period);
    case "spotify.open":
      return ps(`Start-Process "spotify:"`);
    case "streaming.open":
      return ps(streamingOpenScript(payload && payload.service, payload && payload.query));
    case "speech.openHelper":
      return openSpeechHelper();
    case "speech.speak":
      return speakWindowsFast(payload && payload.text, payload && payload.voice);
    case "spotify.authStatus":
      return spotifyAuthStatus();
    case "spotify.login":
      return startSpotifyLogin();
    case "spotify.current":
      return spotifyCurrentPlayback();
    case "spotify.volume":
      return spotifySetVolume(payload && payload.level);
    case "spotify.fadeVolume":
      return spotifyFadeVolume(payload && payload.from, payload && payload.to, payload && payload.durationMs);
    case "spotify.playSearch":
      return spotifyPlaySearch(payload && payload.query);
    case "spotify.searchTracks":
      return searchSpotifyTracks(payload && payload.query);
    case "spotify.playUri":
      return spotifyPlayUri(payload && payload.uri);
    case "spotify.playPlaylist":
      return spotifyPlayPlaylist(payload && payload.query);
    case "spotify.pause":
      return spotifyPause();
    case "spotify.resume":
      return spotifyResume();
    case "spotify.next":
      return spotifyNext();
    case "spotify.previous":
      return spotifyPrevious();
    case "spotify.shuffle":
      return spotifyShuffle(payload && payload.enabled);
    case "spotify.repeat":
      return spotifyRepeat(payload && payload.mode);
    case "spotify.saveCurrent":
      return spotifySaveCurrent();
    case "spotify.queueSearch":
      return spotifyQueueSearch(payload && payload.query);
    case "spotify.search":
      return ps(spotifySearchScript(payload && payload.query));
    case "spotify.searchPlay":
      return ps(spotifySearchAndPlayScript(payload && payload.query));
    case "system.openProgram":
      return ps(openProgramScript(payload && payload.program));
    case "system.closeProgram":
      return ps(closeProgramScript(payload && payload.program));
    case "system.shutdown":
      return ps(shutdownScript(payload && payload.seconds));
    case "system.restart":
      return ps(restartScript());
    case "system.sleep":
      return ps(sleepScript());
    case "system.lock":
      return ps(lockScript());
    case "meeting.open":
      return ps(meetingOpenScript());
    case "network.status":
      return networkStatus();
    case "network.devices":
      return networkDevices();
    case "news.today":
      return newsToday();
    case "window.organize":
      return ps(windowOrganizeScript());
    case "file.search": {
      const result = await ps(fileSearchScript(payload && payload.query));
      return {file: String(result && result.stdout || "").trim()};
    }
    case "youtube.play":
      return youtubePlay(payload && payload.query);
    case "youtube.search":
      return youtubeSearch(payload && payload.query);
    case "youtube.open":
      return youtubeOpen();
    case "youtube.status":
      return youtubeAppStatus();
    case "downloads.list":
      return {items:recentDownloads()};
    case "downloads.openLatest":
      return openLatestDownload();
    case "update.status":
      return updateStatus();
    case "connect.status":
      return connectStatus(true);
    case "connect.enable":
      return startConnectServer();
    case "connect.disable":
      return stopConnectServer();
    case "connect.rotateCode":
      refreshConnectPairCode();
      return connectStatus(true);
    case "connect.qr":
      return connectQrCode();
    case "connect.forgetDevices":
      connectDevices.clear();
      saveConnectDevices();
      return connectStatus(true);
    case "connect.theme":
      if(!connectDesktopHandlers.setTheme) throw new Error("controle de tema indisponível");
      return connectDesktopHandlers.setTheme(String(payload && payload.theme || ""));
    case "connect.clock.list":
      return connectDesktopHandlers.listClock ? connectDesktopHandlers.listClock() : [];
    case "connect.clock.add":
      if(!connectDesktopHandlers.addClock) throw new Error("serviço de lembretes indisponível");
      return connectDesktopHandlers.addClock(payload || {});
    case "connect.clock.remove":
      if(!connectDesktopHandlers.removeClock) throw new Error("serviço de lembretes indisponível");
      return connectDesktopHandlers.removeClock(payload && payload.id);
    case "connect.routine.run":
      if(!connectDesktopHandlers.runRoutine) throw new Error("rotinas indisponíveis");
      return connectDesktopHandlers.runRoutine(String(payload && payload.name || ""));
    case "clipboard.write":
      return ps(clipboardWriteScript(payload && payload.text));
    case "brightness.set":
      return ps(brightnessScript(payload && payload.level));
    case "volume.up":
      return ps(keyScript(0xAF));
    case "volume.down":
      return ps(keyScript(0xAE));
    case "volume.set":
      return ps(setVolumeScript(payload && payload.level));
    case "volume.mute":
      return ps(keyScript(0xAD));
    case "clipboard.read": {
      const result = await ps(clipboardReadScript());
      return {text: String(result && result.stdout || "").trim()};
    }
    case "screenshot.capture": {
      const result = await ps(screenshotScript());
      return {file: String(result && result.stdout || "").trim()};
    }
    case "media.playpause":
      return ps(keyScript(0xB3));
    case "media.next":
      return ps(keyScript(0xB0));
    case "media.previous":
      return ps(keyScript(0xB1));
    case "media.navigate":
      return ps(mediaNavigationScript(payload && payload.command));
    default:
      throw new Error("Acao desconhecida: " + action);
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const origin = allowedOrigin(req);
  const suppliedToken = req.headers["x-maia-token"] || requestUrl.searchParams.get("token") || "";

  if(req.method === "POST" && requestUrl.pathname.startsWith("/webhooks/arkama/")){
    const config = readArkamaConfig();
    const routeToken = decodeURIComponent(requestUrl.pathname.slice("/webhooks/arkama/".length));
    if(!secretMatches(routeToken, config.webhookToken)){
      send(res, 401, {ok:false, error:"webhook nao autorizado"}, req);
      return;
    }
    try{
      const body = await readBody(req);
      const sale = normalizeArkamaSale(body);
      if(!sale.approved){
        send(res, 202, {ok:true, ignored:true, reason:"evento nao aprovado", event:sale.event, status:sale.status}, req);
        return;
      }
      const created = registerApprovedSale(sale, body);
      send(res, 200, {ok:true, duplicate:!created, orderId:sale.id}, req);
    }catch(err){
      send(res, 400, {ok:false, error:err.message}, req);
    }
    return;
  }

  if(req.method === "OPTIONS"){
    if(!origin){
      send(res, 403, {ok: false, error: "origem nao autorizada"}, req);
      return;
    }
    send(res, 200, {ok: true}, req);
    return;
  }

  if(!origin || !hasValidToken(suppliedToken)){
    send(res, 401, {ok: false, error: "acesso nao autorizado"}, req);
    return;
  }

  if(req.method === "GET" && requestUrl.pathname === "/status"){
    send(res, 200, {
      ok: true,
      name: "maia-local-bridge",
      version: require("../../package.json").version,
      port: PORT,
      actions: [
        "spotify.open",
        "streaming.open",
        "speech.openHelper",
        "speech.speak",
        "spotify.authStatus",
        "spotify.login",
        "spotify.current",
        "spotify.volume",
        "spotify.fadeVolume",
        "spotify.playSearch",
        "spotify.searchTracks",
        "spotify.playUri",
        "spotify.playPlaylist",
        "spotify.pause",
        "spotify.resume",
        "spotify.next",
        "spotify.previous",
        "spotify.shuffle",
        "spotify.repeat",
        "spotify.saveCurrent",
        "spotify.queueSearch",
        "spotify.search",
        "spotify.searchPlay",
        "system.openProgram",
        "system.closeProgram",
        "system.shutdown",
        "system.restart",
        "system.sleep",
        "system.lock",
        "meeting.open",
        "network.status",
        "network.devices",
        "news.today",
        "window.organize",
        "file.search",
        "youtube.play",
        "youtube.search",
        "youtube.open",
        "youtube.status",
        "downloads.list",
        "downloads.openLatest",
        "update.status",
        "connect.status",
        "connect.enable",
        "connect.disable",
        "connect.rotateCode",
        "clipboard.write",
        "brightness.set",
        "volume.up",
        "volume.down",
        "volume.set",
        "volume.mute",
        "clipboard.read",
        "screenshot.capture",
        "media.playpause",
        "media.next",
        "media.previous",
        "media.navigate",
        "ai.local",
        "brain.think",
        "brain.remember",
        "brain.forget",
        "brain.status",
        "brain.warmup",
        "integration.arkama.status",
        "integration.status",
        "integration.homeAssistant.configure",
        "integration.homeAssistant.status",
        "integration.homeAssistant.entities",
        "integration.homeAssistant.control",
        "integration.mobility.configure",
        "integration.mobility.status",
        "weather.complete",
        "traffic.route",
        "integration.netlify.configure",
        "integration.netlify.status",
        "integration.netlify.poll",
        "sales.localSummary",
        "voice.native"
      ]
    }, req);
    return;
  }

  if(req.method === "GET" && requestUrl.pathname === "/voice/events"){
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Cache-Control": "no-cache"
    });
    voiceClients.add(res);
    sendSse(res, "status", {running: Boolean(voiceProcess && !voiceProcess.killed)});
    req.on("close", () => voiceClients.delete(res));
    return;
  }

  if(req.method === "GET" && requestUrl.pathname === "/telemetry"){
    send(res, 200, await telemetrySnapshot(), req);
    return;
  }

  if(req.method === "GET" && requestUrl.pathname === "/speech-helper"){
    sendHtml(res, speechHelperHtml());
    return;
  }

  if(req.method === "POST" && requestUrl.pathname === "/voice/browser-result"){
    try{
      const body = await readBody(req);
      const text = String(body.text || "").trim();
      if(text){
        broadcastVoice(body.final ? "browser-result" : "browser-partial", {
          text,
          final: Boolean(body.final),
          source: body.source || "browser-web-speech"
        });
      }
      send(res, 200, {ok: true}, req);
    }catch(err){
      send(res, 400, {ok: false, error: err.message}, req);
    }
    return;
  }

  if(req.method === "POST" && requestUrl.pathname === "/voice/start"){
    try{
      send(res, 200, {ok: true, voice: startNativeVoice()}, req);
    }catch(err){
      send(res, 500, {ok: false, error: err.message}, req);
    }
    return;
  }

  if(req.method === "POST" && requestUrl.pathname === "/voice/stop"){
    send(res, 200, {ok: true, voice: stopNativeVoice()}, req);
    return;
  }

  if(req.method === "POST" && requestUrl.pathname === "/command"){
    try{
      const body = await readBody(req);
      const action = body.action;
      const payload = body.payload || {};
      const result = await runAction(action, payload);
      send(res, 200, {ok: true, action, result}, req);
    }catch(err){
      send(res, 500, {ok: false, error: err.message}, req);
    }
    return;
  }

  send(res, 404, {ok: false, error: "rota nao encontrada"}, req);
});

function startBridge(){
  if(server.listening) return server;
  server.on("error", (err) => {
    if(err && err.code === "EADDRINUSE"){
      console.log(`[maia:bridge] Já está ativa em http://${HOST}:${PORT}`);
      return;
    }
    console.error("[maia:bridge] Falha ao iniciar:", err.message);
  });
  server.listen(PORT, HOST, () => {
    console.log(`[maia:bridge] Ativa em http://${HOST}:${PORT}`);
    megaBrain.warmup()
      .then(() => console.log("[maia:brain] Inicializado"))
      .catch((err) => console.warn("[maia:brain] Falha na inicialização:", err.message));
    startNetlifySalesPolling();
    ensureSpeechWorker();
  });
  return server;
}

function stopBridge(){
  stopConnectServer();
  closeSpeechHelper();
  stopNativeVoice();
  stopNetlifySalesPolling();
  if(speechProcess && !speechProcess.killed) speechProcess.kill();
  if(server.listening) server.close();
}

if(require.main === module){
  startBridge();
  console.log("[maia:bridge] Processo iniciado. Mantenha esta janela aberta durante o uso.");
}

module.exports = {
  startBridge,
  stopBridge,
  startConnectServer,
  stopConnectServer,
  getConnectStatus: () => connectStatus(true),
  getConnectQr: connectQrCode,
  setConnectDesktopHandlers,
  getAuthToken: () => AUTH_TOKEN,
  getArkamaWebhookStatus: arkamaWebhookStatus,
  normalizeArkamaSale,
  configureNetlifySales,
  netlifySalesStatus,
  pollNetlifySales,
  summarizeSales,
  localSalesSummary,
  configureHomeAssistant,
  homeAssistantStatus,
  homeAssistantEntities,
  homeAssistantControl,
  configureMobility,
  mobilityStatus,
  completeWeather,
  trafficRoute
};
