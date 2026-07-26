const assert = require("node:assert");
process.env.MAIA_CONNECT_PORT = "18780";
const bridge = require("../src/bridge/server.js");
const connectUrl = "http://127.0.0.1:18780";

async function run(){
  bridge.startConnectServer();
  await new Promise(resolve => setTimeout(resolve, 350));
  let mobileToken = "";
  try{
    const status = bridge.getConnectStatus();
    assert.equal(status.enabled, true);
    assert.match(status.pairCode, /^\d{6}$/);
    assert.ok(status.addresses.length > 0, "Nenhum endereço local encontrado");

    const home = await fetch(connectUrl + "/");
    assert.equal(home.status, 200);
    assert.match(await home.text(), /MAIA CONNECT/);
    const manifest = await fetch(connectUrl + "/manifest.webmanifest");
    assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).display, "standalone");
    const qr = await bridge.getConnectQr();
    assert.match(qr.dataUrl, /^data:image\/png;base64,/);

    const pair = await fetch(connectUrl + "/api/pair", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({code:status.pairCode,name:"Teste automatizado"})
    });
    const paired = await pair.json();
    assert.equal(pair.status, 200);
    assert.match(paired.token, /^[a-f0-9]{64}$/);
    mobileToken = paired.token;

    const snapshot = await fetch(connectUrl + "/api/snapshot", {headers:{Authorization:`Bearer ${mobileToken}`}});
    const snapshotData = await snapshot.json();
    assert.equal(snapshot.status, 200);
    assert.equal(snapshotData.version, require("../package.json").version);
    assert.ok(Array.isArray(snapshotData.extensions));

    const denied = await fetch(connectUrl + "/api/action", {
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${mobileToken}`},
      body:JSON.stringify({action:"system.shutdown",payload:{}})
    });
    assert.equal(denied.status, 400);
    const unconfirmedSleep = await fetch(connectUrl + "/api/action", {
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${mobileToken}`},
      body:JSON.stringify({action:"system.sleep",payload:{}})
    });
    assert.equal(unconfirmedSleep.status, 400);

    await fetch(connectUrl + "/api/unpair", {
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${mobileToken}`},
      body:"{}"
    });
    console.log("[maia:connect] OK — interface, pareamento, snapshot, autorização e desconexão.");
  } finally {
    bridge.stopConnectServer();
  }
}

run().catch(error => {
  console.error("[maia:connect] FALHOU —", error && error.message || error);
  bridge.stopConnectServer();
  process.exitCode = 1;
});
