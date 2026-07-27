(() => {
  "use strict";
  const parentWindow = window.parent;
  const $ = (id) => document.getElementById(id);
  const state = {view:"inicio", pending:false, pendingTimer:null, stats:{cpu:0,ram:0,gpu:0,energia:100}, extensions:[], selectedExtension:"", theme:null, media:null, connect:null};
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const pad = (value) => String(value).padStart(2, "0");
  const days = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];
  const months = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

  function updateClock(){
    const now = new Date();
    $("clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    $("dateRow").textContent = `${days[now.getDay()]}, ${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  function switchView(name){
    state.view = name;
    const commandInputVisible = name === "inicio" || name === "terminal";
    $("app").classList.toggle("command-input-visible", commandInputVisible);
    const inputWrap = document.querySelector(".input-bar-wrap");
    if(inputWrap) inputWrap.setAttribute("aria-hidden", commandInputVisible ? "false" : "true");
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    $("chatInput").placeholder = name === "terminal" ? "Digite um comando para a Maia..." : "Digite seu comando ou pergunta...";
    if(name === "redes") parentWindow.postMessage({type:"maia-interface-action", action:"network.devices"}, "*");
    if(name === "arquivos") parentWindow.postMessage({type:"maia-interface-action", action:"downloads.list"}, "*");
    if(name === "sistema") parentWindow.postMessage({type:"maia-interface-action", action:"system.refresh"}, "*");
  }
  function bubble(role, text){
    const hint = $("chatEmptyHint");
    if(hint) hint.remove();
    const item = document.createElement("div");
    item.className = `chat-bubble ${role === "user" ? "from-user" : "from-maia"}`;
    if(role !== "user"){
      const label = document.createElement("div");
      label.className = "bubble-label";
      label.textContent = "M.A.I.A.";
      item.appendChild(label);
    }
    const content = document.createElement("div");
    content.className = "bubble-content";
    content.textContent = text;
    item.appendChild(content);
    $("chatLog").appendChild(item);
    $("chatLog").scrollTop = $("chatLog").scrollHeight;
  }
  function terminal(text, command=false){
    const line = document.createElement("div");
    line.className = `terminal-line${command ? " is-command" : ""}`;
    line.textContent = text;
    $("terminalLog").appendChild(line);
    $("terminalLog").scrollTop = $("terminalLog").scrollHeight;
  }
  function send(){
    const input = $("chatInput");
    const text = input.value.trim();
    if(!text || state.pending) return;
    input.value = "";
    if(state.view === "terminal") terminal(text, true);
    else { switchView("inicio"); bubble("user", text); }
    state.pending = true;
    $("sendBtn").disabled = true;
    clearTimeout(state.pendingTimer);
    state.pendingTimer=setTimeout(()=>{
      if(!state.pending)return;
      state.pending=false;
      $("sendBtn").disabled=false;
      const message="O núcleo demorou além do limite. Tente novamente.";
      if(state.view==="terminal")terminal(message);else bubble("assistant",message);
    },125000);
    parentWindow.postMessage({type:"maia-interface-command", text, terminal:state.view === "terminal"}, "*");
  }
  function setStat(key, value, label){
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    state.stats[key] = safe;
    document.querySelectorAll(`[data-stat="${key}"] .stat-fill`).forEach((el) => { el.style.width = `${safe}%`; });
    document.querySelectorAll(`[data-stat="${key}"] .stat-val`).forEach((el) => { el.textContent = label || `${Math.round(safe)}%`; });
  }
  function applyTelemetry(data){
    if(!data) return;
    setStat("cpu", data.cpu_percent);
    setStat("ram", data.ram_percent);
    const gpuName=String(data.gpu_name||"").replace(/^Intel\(R\)\s*/i,"Intel ").replace(/\s+/g," ").trim();
    const gpuLabel=gpuName?gpuName.replace(/Intel\s+HD\s+Graphics\s+/i,"Intel HD ").replace(/NVIDIA\s+GeForce\s+/i,"NVIDIA ").slice(0,22):"N/D";
    setStat("gpu", gpuName ? 100 : 0, gpuLabel);
    const gpuCard=document.querySelector('[data-stat="gpu"]');
    if(gpuCard)gpuCard.title=gpuName||"Nenhuma GPU identificada";
    setStat("energia", data.battery_percent == null ? 100 : data.battery_percent, data.battery_percent == null ? "REDE" : null);
    $("uplinkVal").textContent = data.internet_latency_ms == null ? "—" : `${data.internet_latency_ms} ms`;
    $("downlinkVal").textContent = data.internet_online === false ? "OFFLINE" : "ONLINE";
    const identity=$("systemIdentity20");
    if(identity)identity.textContent=[data.hostname,data.os_name,data.cpu_model,gpuName||null,data.ram_total_gb!=null?`${data.ram_total_gb} GB RAM`:null,data.disk_free_gb!=null?`${data.disk_free_gb} GB livres`:null].filter(Boolean).join(" • ");
  }
  const formatBytes20=(bytes)=>{
    const value=Number(bytes)||0;
    if(value<1024)return`${value} B`;
    if(value<1048576)return`${(value/1024).toFixed(1)} KB`;
    if(value<1073741824)return`${(value/1048576).toFixed(1)} MB`;
    return`${(value/1073741824).toFixed(1)} GB`;
  };
  const fileExtension20=(name)=>String(name||"").split(".").pop().toLowerCase();
  function renderFiles20(items,message){
    const type=$("fileType20")?.value||"";
    const groups={document:["pdf","doc","docx","txt","rtf","odt","xls","xlsx","ppt","pptx"],image:["png","jpg","jpeg","gif","webp","svg","bmp"],video:["mp4","mkv","avi","mov","webm"],audio:["mp3","wav","flac","aac","ogg","m4a"],archive:["zip","rar","7z","tar","gz"]};
    const list=(Array.isArray(items)?items:[]).filter((item)=>!type||(groups[type]||[]).includes(fileExtension20(item.name||item.Name)));
    document.querySelector(".file-list").innerHTML=list.length?list.map((item)=>{
      const name=item.name||item.Name||"Arquivo",path=item.path||item.FullName||"",size=item.size??item.Length;
      return `<div class="file-row"><span class="file-name" title="${escapeHtml(path)}">${escapeHtml(name)}</span><span class="file-meta">${formatBytes20(size)}</span><span class="file-row-actions20"><button type="button" data-file-open="${escapeHtml(path)}">ABRIR</button><button type="button" data-file-folder="${escapeHtml(path)}">PASTA</button></span></div>`;
    }).join(""):'<div class="file-row"><span class="file-name">Nenhum arquivo encontrado.</span><span class="file-meta">—</span></div>';
    $("fileStatus20").textContent=message||`${list.length} arquivo(s) exibido(s).`;
  }
  function renderProcesses20(items){
    document.querySelector(".process-list").innerHTML=(Array.isArray(items)?items:[]).map((item)=>`<div class="process-row"><span>${escapeHtml(item.name||"Processo")} <small>PID ${escapeHtml(item.pid)}</small></span><span>${escapeHtml(item.cpuSeconds)} s CPU</span><span>${escapeHtml(item.memoryMb)} MB</span></div>`).join("")||'<div class="process-row"><span>Nenhum processo disponível</span><span>—</span><span>—</span></div>';
  }
  const formatMediaTime20=(milliseconds)=>{
    const total=Math.max(0,Math.floor((Number(milliseconds)||0)/1000));
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;
  };
  function renderMedia20(media){
    state.media=media&&media.name?{...media,receivedAt:Date.now()}:null;
    const center=$("mediaCenter20"),cover=$("mediaCover20"),fallback=$("mediaFallback20");
    const active=Boolean(state.media);
    center.classList.toggle("media-empty20",!active);
    $("mediaTitle20").textContent=active?state.media.name:"Nada reproduzindo";
    $("mediaArtist20").textContent=active?[state.media.artists,state.media.album].filter(Boolean).join(" • "):"Spotify e YouTube aparecerão aqui";
    const service=active?String(state.media.service||"mídia").toUpperCase():"AGUARDANDO";
    $("mediaService20").textContent=service;
    center.style.setProperty("--media-glow",service==="SPOTIFY"?"#1ed760":service==="YOUTUBE"?"#ff3030":"var(--h-primary)");
    if(active&&state.media.image){
      const expectedImage=state.media.image;
      cover.onload=()=>{
        if(cover.src===expectedImage||cover.src.endsWith(expectedImage)){
          cover.hidden=false;
          fallback.hidden=true;
        }
      };
      cover.src=expectedImage;
      if(cover.complete&&cover.naturalWidth){
        cover.hidden=false;
        fallback.hidden=true;
      }
    }else{
      cover.hidden=true;
      cover.removeAttribute("src");
      fallback.hidden=false;
      fallback.textContent=service==="YOUTUBE"?"▶":"♫";
    }
    $("mediaPlay20").textContent=active&&state.media.playing===true?"❚❚":"▶";
    $("mediaPlay20").setAttribute("aria-label",active&&state.media.playing===true?"Pausar":"Reproduzir");
    const spotify=active&&String(state.media.service||"").toLowerCase()==="spotify";
    $("mediaShuffle20").disabled=!spotify;
    $("mediaRepeat20").disabled=!spotify;
    $("mediaShuffle20").classList.toggle("active",spotify&&Boolean(state.media.shuffle));
    $("mediaRepeat20").classList.toggle("active",spotify&&state.media.repeat&&state.media.repeat!=="off");
    $("mediaRepeat20").textContent=spotify&&state.media.repeat==="track"?"↻¹":"↻";
    $("mediaRepeat20").title=spotify&&state.media.repeat==="track"?"Repetindo esta faixa":spotify&&state.media.repeat==="context"?"Repetindo a playlist":"Repetição desligada";
    $("mediaDevice20").textContent=active?(state.media.device||"Dispositivo ativo"):"Nenhum dispositivo";
    $("mediaVolume20").textContent=active&&state.media.volumePercent!=null?`VOL ${Math.round(state.media.volumePercent)}%`:"VOL —";
    updateMediaProgress20();
  }
  function renderConnect20(status){
    state.connect=status||{enabled:false};
    const active=Boolean(state.connect.enabled);
    const center=$("connectCenter20");
    if(!center)return;
    center.classList.toggle("active",active);
    $("connectState20").textContent=active?"ATIVO NA REDE LOCAL":"DESATIVADO";
    $("connectAddress20").textContent=active&&(state.connect.addresses||[])[0]||(active?"Rede indisponível":"—");
    $("connectOwnerCode20").textContent=active&&state.connect.pairCode||"———";
    $("connectGuestCode20").textContent=active&&state.connect.guestCode||"———";
    $("connectDevices20").textContent=String(state.connect.pairedDevices||0);
    $("connectExpiry20").textContent=active&&state.connect.pairExpiresAt?new Date(state.connect.pairExpiresAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";
    $("connectToggle20").textContent=active?"RENOVAR CÓDIGOS":"ATIVAR CONNECT";
    const qr=$("connectQr20"),empty=$("connectQrEmpty20");
    if(active&&state.connect.qrDataUrl){
      qr.src=state.connect.qrDataUrl;
      qr.hidden=false;
      empty.hidden=true;
    }else{
      qr.hidden=true;
      qr.removeAttribute("src");
      empty.hidden=false;
      empty.textContent=active?"QR indisponível nesta rede":"Ative o Connect para gerar o QR Code";
    }
    const error=$("connectError20");
    error.textContent=state.connect.error||state.connect.qrError||"";
    $("connectDisable20").disabled=!active;
    $("connectCopy20").disabled=!active;
  }
  function updateMediaProgress20(){
    const media=state.media;
    let progress=media?Number(media.progressMs)||0:0;
    const duration=media?Number(media.durationMs)||0:0;
    if(media&&media.playing===true)progress+=Date.now()-media.receivedAt;
    progress=duration?Math.min(progress,duration):0;
    $("mediaProgress20").style.width=duration?`${Math.min(100,progress/duration*100).toFixed(2)}%`:"0%";
    $("mediaElapsed20").textContent=formatMediaTime20(progress);
    $("mediaDuration20").textContent=formatMediaTime20(duration);
  }
  function applyTheme(theme){
    if(!theme)return;
    state.theme=theme;
    try{localStorage.setItem("Maia.horizon.themePayload",JSON.stringify(theme));}catch(error){}
    const root=document.documentElement.style;
    root.setProperty("--h-primary",theme.primary||"#a78bfa");
    root.setProperty("--h-accent",theme.accent||theme.primary||"#7c3aed");
    root.setProperty("--h-soft",theme.soft||"#efe7ff");
    root.setProperty("--h-dim",theme.dim||"#62517e");
    root.setProperty("--h-bg",theme.background||"#020105");
    root.setProperty("--h-surface",theme.surface||"#160c28");
    document.body.dataset.theme=theme.id||"violet";
    const themeName=$("activeThemeName");
    const themeSelect=document.querySelector('[data-horizon-field="brainTheme"]');
    const selectedOption=themeSelect&&Array.from(themeSelect.options).find((option)=>option.value===(theme.id||""));
    if(themeName)themeName.textContent=selectedOption?.textContent||String(theme.id||"Violeta").replace(/[-_]/g," ").toUpperCase();
    applyCursorTheme20();
  }
  const cursorStyle20=document.createElement("style");
  cursorStyle20.id="maiaThemeCursor20";
  document.head.appendChild(cursorStyle20);
  function applyCursorTheme20(){
    const extension=state.extensions.find((item)=>item.id==="theme-cursor");
    if(extension&&extension.enabled===false){
      cursorStyle20.textContent="";
      return;
    }
    const theme=state.theme;
    if(!theme)return;
    const primary=String(theme.primary||"#a78bfa");
    const accent=String(theme.accent||"#ffffff");
    const arrow=`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 2.8v18.4l4.8-4 3.4 7.2 3.6-1.7-3.4-7.1 6.3-.5z" fill="${primary}" stroke="${accent}" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.1 6.4v9.8" stroke="white" stroke-opacity=".58" stroke-width="1.2"/></svg>`;
    const cursor=`url("data:image/svg+xml,${encodeURIComponent(arrow)}") 4 3`;
    cursorStyle20.textContent=`html,body,#app,#app *{cursor:${cursor},auto!important}input,textarea,[contenteditable="true"]{cursor:text!important}button,a,label,select,[role="button"]{cursor:${cursor},pointer!important}`;
  }
  window.addEventListener("message", (event) => {
    if(event.source!==parentWindow)return;
    const message = event.data || {};
    if(message.type === "maia-interface-telemetry") applyTelemetry(message.data);
    if(message.type==="maia-interface-mic"){
      const meter=$("micMeter20"),level=Math.max(0,Math.min(1,Number(message.level)||0));
      const percent=Math.round(level*100);
      const status=String(message.status||(!message.active?"unavailable":message.speaking?"responding":level>.08?"hearing":"waiting"));
      const statusLabels={
        unavailable:"INDISPONÍVEL",
        waiting:"AGUARDANDO “MAIA”",
        listening:"OUVINDO COMANDO",
        hearing:"CAPTANDO VOZ",
        processing:"PROCESSANDO",
        responding:"RESPONDENDO"
      };
      $("micPercent20").textContent=`${percent}%`;
      $("micState20").textContent=statusLabels[status]||"AGUARDANDO";
      meter.dataset.state=status;
      meter.classList.toggle("off",!message.active);
      meter.classList.toggle("live",message.active&&level>.025);
      meter.classList.toggle("speaking",status==="responding");
      meter.classList.toggle("processing",status==="processing");
      const bars=Array.from($("micBars20").children);
      bars.forEach((bar,index)=>{
        const position=(index+1)/bars.length;
        const shaped=Math.max(.08,Math.min(1,(level*1.35-position*.32)*(1.2+Math.sin(index*.9)*.14)));
        bar.style.transform=`scaleY(${shaped.toFixed(3)})`;
      });
    }
    if(message.type === "maia-interface-theme") applyTheme(message.data);
    if(message.type === "maia-interface-performance"){
      document.body.classList.toggle("performance-economy",message.mode === "economy");
    }
    if(message.type === "maia-interface-result"){
      state.pending = false;
      clearTimeout(state.pendingTimer);
      $("sendBtn").disabled = false;
      if(message.terminal) terminal(message.text || "Comando concluído.");
      else bubble("assistant", message.text || "Comando enviado ao núcleo da Maia.");
    }
    if(message.type === "maia-interface-devices"){
      const list=document.querySelector(".device-list");
      if(!list)return;
      const devices=Array.isArray(message.devices)?message.devices:[];
      list.innerHTML=devices.length?devices.map((device)=>`<div class="device-row"><span class="device-name">${escapeHtml(device.name||device.hostname||"Dispositivo")}</span><span class="device-ip">${escapeHtml(device.address||device.ip||"—")}</span><div class="signal-bars"><span style="height:6px"></span><span style="height:9px"></span><span style="height:12px"></span></div></div>`).join(""):'<div class="device-row"><span class="device-name">Nenhum dispositivo encontrado</span><span class="device-ip">—</span></div>';
    }
    if(message.type === "maia-interface-control-result"){
      const output=$("horizonControlOutput");
      if(output)output.textContent=message.text||"Ação concluída.";
    }
    if(message.type==="maia-interface-files")renderFiles20(message.items,message.message);
    if(message.type==="maia-interface-processes")renderProcesses20(message.items);
    if(message.type==="maia-interface-media")renderMedia20(message.data);
    if(message.type==="maia-interface-connect")renderConnect20(message.data);
    if(message.type === "maia-interface-snapshot")applyHorizonSnapshot(message.data);
  });
  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  ["copy","cut","contextmenu","dragstart"].forEach((eventName)=>document.addEventListener(eventName,(event)=>event.preventDefault()));
  document.addEventListener("selectstart",(event)=>{
    if(event.target.closest("input,textarea,select"))return;
    event.preventDefault();
  });
  $("radarBtn").addEventListener("click", () => switchView("inicio"));
  $("sendBtn").addEventListener("click", send);
  $("chatInput").addEventListener("keydown", (event) => { if(event.key === "Enter"){ event.preventDefault(); send(); } });
  $("sparkleBtn").addEventListener("click", () => { $("chatInput").value = "Qual é o status do sistema?"; $("chatInput").focus(); });
  $("fileSearchForm20").addEventListener("submit",(event)=>{event.preventDefault();const query=$("fileSearchInput20").value.trim();if(!query)return;$("fileStatus20").textContent="Buscando arquivos…";parentWindow.postMessage({type:"maia-interface-action",action:"file.search",query},"*");});
  $("downloadsRefresh20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-action",action:"downloads.list"},"*"));
  $("systemRefresh20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-action",action:"system.refresh"},"*"));
  document.querySelectorAll("[data-media-control]").forEach((button)=>button.addEventListener("click",()=>{
    const command=button.dataset.mediaControl;
    parentWindow.postMessage({type:"maia-interface-action",action:"media.control",command},"*");
  }));
  $("mediaCover20").addEventListener("error",()=>{
    $("mediaCover20").hidden=true;
    $("mediaFallback20").hidden=false;
  });
  document.querySelector(".file-list").addEventListener("click",(event)=>{const open=event.target.closest("[data-file-open]"),folder=event.target.closest("[data-file-folder]");if(open)parentWindow.postMessage({type:"maia-interface-action",action:"file.open",path:open.dataset.fileOpen},"*");if(folder)parentWindow.postMessage({type:"maia-interface-action",action:"file.openFolder",path:folder.dataset.fileFolder},"*");});
  $("fileType20").addEventListener("change",()=>{const query=$("fileSearchInput20").value.trim();parentWindow.postMessage({type:"maia-interface-action",action:query?"file.search":"downloads.list",query},"*");});
  $("toggleCompact").addEventListener("change", (event) => {
    $("app").classList.toggle("compact", event.target.checked);
    localStorage.setItem("Maia.horizon.compact",event.target.checked?"1":"0");
  });
  $("toggleSound").addEventListener("change",()=>parentWindow.postMessage({type:"maia-interface-control",id:"brainSilentToggle"},"*"));
  const controlGroups=[
    ["Desempenho",[["Alternar Normal / Economia","brainPerformanceMode"],["Prévia do tema","brainVisualPreview"]]],
    ["Integrações",[["Verificar integrações","brainIntegrationStatus"],["Testar tudo","brainTestAll"],["Home Assistant","brainHaStatus"],["Clima","brainWeatherTest"],["Trânsito","brainTrafficCheck"]]],
    ["Automação",[["Modo trabalho","command:modo trabalho"],["Modo jogo","command:modo jogo"],["Modo noite","command:modo noite"],["Modo cinema","command:modo cinema"],["Relógio do Windows","brainWindowsClockOpen"]]],
    ["Dados e segurança",[["Memória","brainMemoryView"],["Histórico","brainHistoryView"],["Exportar backup","brainBackupExport"],["Privacidade","brainPrivacyView"],["Diagnóstico","brainDiagnostics"],["Atualizações","brainUpdateCheck"]]],
  ];
  controlGroups.forEach(([title,controls])=>{
    const heading=document.createElement("div");
    heading.className="panel-title";
    heading.textContent=title;
    $("view-config").appendChild(heading);
    const row=document.createElement("div");
    row.className="horizon-actions";
    controls.forEach(([label,id])=>{
      const button=document.createElement("button");
      button.type="button";
      button.textContent=label;
      button.addEventListener("click",()=>parentWindow.postMessage(id.startsWith("command:")?{type:"maia-interface-command",text:id.slice(8),terminal:false}:{type:"maia-interface-control",id},"*"));
      row.appendChild(button);
    });
    $("view-config").appendChild(row);
  });
  const connectHeading=document.createElement("div");
  connectHeading.className="panel-title";
  connectHeading.textContent="Maia Connect";
  $("view-config").appendChild(connectHeading);
  const connectCenter=document.createElement("section");
  connectCenter.id="connectCenter20";
  connectCenter.className="connect-center20";
  connectCenter.innerHTML=`
    <div>
      <div class="connect-status20"><i></i><span id="connectState20">CONSULTANDO…</span></div>
      <div class="connect-details20">
        <div class="connect-detail20" style="grid-column:1/-1"><span>ENDEREÇO NO CELULAR</span><strong id="connectAddress20">—</strong></div>
        <div class="connect-detail20 connect-code20"><span>CÓDIGO DO PROPRIETÁRIO</span><strong id="connectOwnerCode20">———</strong></div>
        <div class="connect-detail20 connect-code20"><span>CÓDIGO DE CONVIDADO</span><strong id="connectGuestCode20">———</strong></div>
        <div class="connect-detail20"><span>CELULARES PAREADOS</span><strong id="connectDevices20">0</strong></div>
        <div class="connect-detail20"><span>CÓDIGOS VÁLIDOS ATÉ</span><strong id="connectExpiry20">—</strong></div>
      </div>
      <div class="connect-actions20">
        <button type="button" class="primary" id="connectToggle20">ATIVAR CONNECT</button>
        <button type="button" id="connectRefresh20">ATUALIZAR</button>
        <button type="button" id="connectCopy20">COPIAR ACESSO</button>
        <button type="button" id="connectForget20">REVOGAR CELULARES</button>
        <button type="button" id="connectDisable20">DESATIVAR</button>
      </div>
      <div class="connect-error20" id="connectError20"></div>
    </div>
    <div class="connect-qr20"><img id="connectQr20" alt="QR Code do Maia Connect" hidden><span id="connectQrEmpty20">Ative o Connect para gerar o QR Code</span></div>`;
  $("view-config").appendChild(connectCenter);
  $("connectToggle20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-control",id:"brainConnectEnable"},"*"));
  $("connectRefresh20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-control",id:"brainConnectRefresh"},"*"));
  $("connectDisable20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-control",id:"brainConnectDisable"},"*"));
  $("connectForget20").addEventListener("click",()=>parentWindow.postMessage({type:"maia-interface-control",id:"brainConnectForget"},"*"));
  $("connectCopy20").addEventListener("click",async()=>{
    const status=state.connect||{},address=(status.addresses||[])[0]||"";
    if(!status.enabled||!address)return;
    const access=`${address}\nCódigo: ${status.pairCode||""}`;
    try{
      await navigator.clipboard.writeText(access);
      $("horizonControlOutput").textContent="Endereço e código de pareamento copiados.";
    }catch(err){
      parentWindow.postMessage({type:"maia-interface-control",id:"brainConnectCopy"},"*");
    }
  });
  const output=document.createElement("div");
  output.id="horizonControlOutput";
  output.className="terminal-log";
  output.textContent="Central Horizon pronta.";
  $("view-config").appendChild(output);
  function addForm(title,fields,actions){
    const section=document.createElement("section");
    section.className="horizon-form";
    const heading=document.createElement("div");
    heading.className="panel-title";
    heading.textContent=title;
    section.appendChild(heading);
    fields.forEach(([id,label,type="text"])=>{
      const row=document.createElement("label");
      row.className="horizon-field";
      const caption=document.createElement("span");
      caption.textContent=label;
      const control=type==="select"?document.createElement("select"):document.createElement("input");
      control.dataset.horizonField=id;
      control.id=`h-${id}`;
      if(type!=="select")control.type=type;
      row.append(caption,control);
      section.appendChild(row);
    });
    const buttons=document.createElement("div");
    buttons.className="horizon-actions";
    actions.forEach(([label,click])=>{
      const button=document.createElement("button");
      button.type="button";
      button.textContent=label;
      button.addEventListener("click",()=>{
        const values={};
        section.querySelectorAll("[data-horizon-field]").forEach((control)=>{
          if(control.dataset.horizonDirty==="1")values[control.dataset.horizonField]=control.value;
        });
        if(!Object.keys(values).length&&click==="horizonProfileApply"){
          const output=$("horizonControlOutput");
          if(output)output.textContent="Nenhuma alteração para salvar.";
          return;
        }
        parentWindow.postMessage({type:"maia-interface-form",values,click},"*");
        section.querySelectorAll("[data-horizon-field]").forEach((control)=>{
          if(control.dataset.horizonDirty!=="1")return;
          control.dataset.horizonInitial=control.value;
          control.dataset.horizonDirty="0";
        });
      });
      buttons.appendChild(button);
    });
    section.appendChild(buttons);
    $("view-config").appendChild(section);
  }
  addForm("Perfil e preferências",[["brainOwnerName","Seu nome"],["brainCity","Cidade"],["brainTreatment","Tratamento","select"],["brainSpeechMode","Personalidade","select"],["brainPresence","Presença","select"],["brainVolume","Volume","number"],["brainWakeWords","Palavras de ativação"]],[["Salvar perfil","horizonProfileApply"]]);
  addForm("Home Assistant",[["brainHaUrl","Endereço"],["brainHaToken","Token","password"],["brainHaEntity","Entidade","select"],["brainHaAction","Ação","select"]],[["Conectar","brainHaConnect"],["Atualizar dispositivos","brainHaRefresh"],["Executar","brainHaRun"]]);
  addForm("Clima e trânsito",[["brainMobilityCity","Cidade"],["brainTrafficOrigin","Origem"],["brainTrafficKey","Google Routes","password"],["brainTrafficDestination","Destino"]],[["Salvar","brainMobilitySave"],["Ver clima","brainWeatherTest"],["Ver trânsito","brainTrafficCheck"]]);
  addForm("Aparência",[["brainTheme","Tema","select"],["brainAutoTheme","Tema automático","select"]],[["Aplicar tema","brainThemeApply"],["Aplicar automático","brainAutoThemeApply"]]);
  addForm("Rotinas",[["brainRoutineName","Nome"],["brainRoutine","Ações"],["brainRoutineSaved","Rotina salva","select"]],[["Salvar","brainRoutineSave"],["Executar","brainRoutineRun"],["Excluir","brainRoutineDelete"]]);
  addForm("Relógio e lembretes",[["brainClockType","Tipo","select"],["brainClockWhen","Horário","datetime-local"],["brainClockMessage","Mensagem"]],[["Criar","brainClockAdd"],["Atualizar","brainClockRefresh"],["Abrir Relógio","brainWindowsClockOpen"]]);
  const extensionCenter=document.createElement("section");
  extensionCenter.className="horizon-extension-center";
  extensionCenter.innerHTML=`
    <div class="panel-title">Central de extensões</div>
    <div class="extension-toolbar">
      <label class="extension-search"><span>BUSCAR</span><input id="extensionSearch20" type="search" placeholder="Nome, categoria ou comando"></label>
      <label><span>STATUS</span><select id="extensionStatus20"><option value="all">Todas</option><option value="active">Ativas</option><option value="disabled">Desativadas</option><option value="new">Novidades</option></select></label>
      <label><span>CATEGORIA</span><select id="extensionCategory20"><option value="all">Todas</option></select></label>
    </div>
    <div class="extension-summary20" id="extensionSummary20"></div>
    <div class="extension-layout20">
      <div class="extension-grid20" id="extensionGrid20"></div>
      <aside class="extension-detail20" id="extensionDetail20"></aside>
    </div>`;
  $("view-config").appendChild(extensionCenter);
  const configView=$("view-config");
  const categoryDefinitions=[["geral","Geral"],["perfil","Perfil"],["integracoes","Integrações"],["connect","Connect"],["automacao","Automação"],["visual","Visual"],["dados","Dados"],["relogio","Relógio"],["extensoes","Extensões"]];
  const categoryPanels={};
  const categoryNav=document.createElement("nav");
  categoryNav.className="horizon-category-nav";
  categoryDefinitions.forEach(([id,label],index)=>{
    const tab=document.createElement("button");
    tab.type="button";
    tab.dataset.horizonCategoryTab=id;
    tab.classList.toggle("active",index===0);
    tab.textContent=label;
    categoryNav.appendChild(tab);
    const panel=document.createElement("section");
    panel.className=`horizon-category${index===0?" active":""}`;
    panel.dataset.horizonCategory=id;
    categoryPanels[id]=panel;
  });
  function categoryForTitle(text){
    const value=String(text||"").toLowerCase();
    if(value.includes("perfil"))return"perfil";
    if(value.includes("home assistant")||value.includes("clima")||value.includes("integra"))return"integracoes";
    if(value.includes("connect"))return"connect";
    if(value.includes("automa")||value.includes("rotina"))return"automacao";
    if(value.includes("apar")||value.includes("desempenho"))return"visual";
    if(value.includes("dado")||value.includes("seguran"))return"dados";
    if(value.includes("relógio")||value.includes("lembrete"))return"relogio";
    if(value.includes("extens"))return"extensoes";
    return"geral";
  }
  const movable=Array.from(configView.children).slice(1);
  let activeCategory="geral";
  movable.forEach((node)=>{
    if(node.classList.contains("horizon-extension-center")){
      activeCategory="extensoes";
      categoryPanels.extensoes.appendChild(node);
      return;
    }
    if(node.classList.contains("horizon-form")){
      activeCategory=categoryForTitle(node.querySelector(".panel-title")?.textContent);
      categoryPanels[activeCategory].appendChild(node);
      return;
    }
    if(node.classList.contains("panel-title"))activeCategory=categoryForTitle(node.textContent);
    if(node.id==="horizonControlOutput")activeCategory="geral";
    categoryPanels[activeCategory].appendChild(node);
  });
  configView.appendChild(categoryNav);
  categoryDefinitions.forEach(([id])=>configView.appendChild(categoryPanels[id]));
  categoryNav.addEventListener("click",(event)=>{
    const tab=event.target.closest("[data-horizon-category-tab]");
    if(!tab)return;
    const selected=tab.dataset.horizonCategoryTab;
    categoryNav.querySelectorAll("button").forEach((button)=>button.classList.toggle("active",button===tab));
    Object.entries(categoryPanels).forEach(([id,panel])=>panel.classList.toggle("active",id===selected));
    configView.scrollTop=0;
  });
  function applyHorizonSnapshot(snapshot){
    if(!snapshot||!snapshot.fields)return;
    Object.entries(snapshot.fields).forEach(([id,definition])=>{
      const control=document.querySelector(`[data-horizon-field="${id}"]`);
      if(!control)return;
      if(control.dataset.horizonDirty==="1")return;
      if(control.tagName==="SELECT"&&Array.isArray(definition.options)){
        control.innerHTML="";
        definition.options.forEach((item)=>{
          const option=document.createElement("option");
          option.value=item.value;
          option.textContent=item.label;
          control.appendChild(option);
        });
      }
      control.value=definition.value??"";
      control.dataset.horizonInitial=control.value;
    });
    const status=snapshot.status||{};
    const output=$("horizonControlOutput");
    if(output)output.textContent=[status.general,status.home,status.mobility,status.connect,status.clock,status.extensions].filter(Boolean).join("\n");
    const themeSelect=document.querySelector('[data-horizon-field="brainTheme"]');
    const themeName=$("activeThemeName");
    const activeOption=themeSelect&&Array.from(themeSelect.options).find((option)=>option.value===document.body.dataset.theme);
    if(themeName&&activeOption)themeName.textContent=activeOption.textContent;
    if(snapshot.preferences&&typeof snapshot.preferences.silentMode==="boolean")$("toggleSound").checked=!snapshot.preferences.silentMode;
    if(Array.isArray(snapshot.extensions)){
      state.extensions=snapshot.extensions;
      renderExtensionCenter20();
      applyCursorTheme20();
    }
  }
  document.addEventListener("input",(event)=>{
    const control=event.target.closest&&event.target.closest("[data-horizon-field]");
    if(!control)return;
    control.dataset.horizonDirty=control.value!==String(control.dataset.horizonInitial??"")?"1":"0";
  });
  document.addEventListener("change",(event)=>{
    const control=event.target.closest&&event.target.closest("[data-horizon-field]");
    if(!control)return;
    control.dataset.horizonDirty=control.value!==String(control.dataset.horizonInitial??"")?"1":"0";
  });
  function extensionInitials20(name){
    return String(name||"EX").split(/\s+/).slice(0,2).map((part)=>part[0]||"").join("").toUpperCase();
  }
  function renderExtensionCenter20(){
    const search=$("extensionSearch20"),status=$("extensionStatus20"),category=$("extensionCategory20");
    if(!search||!status||!category)return;
    const categories=[...new Set(state.extensions.map((item)=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const currentCategory=category.value||"all";
    category.innerHTML='<option value="all">Todas</option>'+categories.map((item)=>`<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    category.value=categories.includes(currentCategory)?currentCategory:"all";
    const query=search.value.trim().toLowerCase();
    const visible=state.extensions.filter((item)=>{
      if(status.value==="active"&&!item.enabled)return false;
      if(status.value==="disabled"&&item.enabled)return false;
      if(status.value==="new"&&!item.badge)return false;
      if(category.value!=="all"&&item.category!==category.value)return false;
      const haystack=[item.name,item.category,item.summary,...(item.commands||[])].join(" ").toLowerCase();
      return !query||haystack.includes(query);
    });
    if(!state.extensions.some((item)=>item.id===state.selectedExtension))state.selectedExtension=visible[0]?.id||state.extensions[0]?.id||"";
    $("extensionSummary20").innerHTML=`<span><b>${state.extensions.length}</b> instaladas</span><span><b>${state.extensions.filter((item)=>item.enabled).length}</b> ativas</span><span><b>${state.extensions.filter((item)=>item.badge).length}</b> novidades</span><span><b>${visible.length}</b> exibidas</span>`;
    $("extensionGrid20").innerHTML=visible.length?visible.map((item)=>`
      <button type="button" class="extension-card20${item.id===state.selectedExtension?" selected":""}${item.enabled?"":" disabled"}" data-extension-id="${escapeHtml(item.id)}">
        <span class="extension-icon20">${escapeHtml(extensionInitials20(item.name))}</span>
        <span class="extension-card-body20"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} • v${escapeHtml(item.version)}</small><em>${escapeHtml(item.summary)}</em></span>
        <span class="extension-state20">${item.enabled?"ATIVA":"DESATIVADA"}</span>
      </button>`).join(""):'<div class="extension-empty20">Nenhuma extensão corresponde aos filtros.</div>';
    const selected=state.extensions.find((item)=>item.id===state.selectedExtension);
    $("extensionDetail20").innerHTML=selected?`
      <div class="extension-detail-head20"><span class="extension-icon20">${escapeHtml(extensionInitials20(selected.name))}</span><div><strong>${escapeHtml(selected.name)}</strong><small>${escapeHtml(selected.category)} • v${escapeHtml(selected.version)}</small></div></div>
      <p>${escapeHtml(selected.summary)}</p>
      <h4>COMANDOS</h4><div class="extension-chips20">${(selected.commands||[]).map((item)=>`<button type="button" data-extension-command="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")||"<span>Nenhum comando listado.</span>"}</div>
      <h4>PERMISSÕES</h4><ul>${(selected.permissions||[]).map((item)=>`<li>${escapeHtml(item)}</li>`).join("")||"<li>Nenhuma permissão adicional.</li>"}</ul>
      <button type="button" class="extension-toggle20 ${selected.enabled?"danger":""}" data-extension-toggle="${escapeHtml(selected.id)}">${selected.enabled?"DESATIVAR EXTENSÃO":"ATIVAR EXTENSÃO"}</button>`
      :'<div class="extension-empty20">Selecione uma extensão.</div>';
  }
  extensionCenter.addEventListener("input",(event)=>{
    if(event.target.matches("#extensionSearch20,#extensionStatus20,#extensionCategory20"))renderExtensionCenter20();
  });
  extensionCenter.addEventListener("change",(event)=>{
    if(event.target.matches("#extensionStatus20,#extensionCategory20"))renderExtensionCenter20();
  });
  extensionCenter.addEventListener("click",(event)=>{
    const card=event.target.closest("[data-extension-id]");
    if(card){state.selectedExtension=card.dataset.extensionId;renderExtensionCenter20();return;}
    const toggle=event.target.closest("[data-extension-toggle]");
    if(toggle){toggle.disabled=true;parentWindow.postMessage({type:"maia-extension-toggle",id:toggle.dataset.extensionToggle},"*");return;}
    const command=event.target.closest("[data-extension-command]");
    if(command){switchView("inicio");$("chatInput").value=command.dataset.extensionCommand;$("chatInput").focus();}
  });
  const horizonStyle=document.createElement("style");
  horizonStyle.textContent=".no-anim,.no-anim *{animation:none!important;transition:none!important}.horizon-actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 18px}.horizon-actions button,.horizon-category-nav button{border:1px solid color-mix(in srgb,var(--h-primary) 35%,transparent);background:color-mix(in srgb,var(--h-primary) 9%,transparent);color:var(--h-soft);padding:9px 12px;border-radius:5px;cursor:pointer;font:10px inherit;letter-spacing:.04em}.horizon-actions button:hover,.horizon-category-nav button:hover,.horizon-category-nav button.active{background:color-mix(in srgb,var(--h-primary) 22%,transparent);border-color:var(--h-primary);color:var(--h-primary)}#view-config{overflow:auto;padding-right:8px}.horizon-category-nav{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:7px;width:100%;padding:8px 0 16px;margin-bottom:14px;border-bottom:1px solid color-mix(in srgb,var(--h-primary) 18%,transparent);background:var(--h-bg);isolation:isolate}.horizon-category-nav button{position:relative;z-index:1;flex:0 0 auto;white-space:nowrap}.horizon-category{display:none;position:relative;z-index:1;clear:both;width:100%;padding-top:8px}.horizon-category.active{display:block;animation:horizonCategoryIn .18s ease}.horizon-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin-bottom:18px}.horizon-form>.panel-title,.horizon-form>.horizon-actions{grid-column:1/-1}.horizon-field{display:grid;gap:5px;color:var(--h-dim);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.horizon-field input,.horizon-field select{width:100%;height:34px;border:1px solid color-mix(in srgb,var(--h-primary) 25%,transparent);background:color-mix(in srgb,var(--h-surface) 34%,#050208);color:var(--h-soft);padding:0 9px;border-radius:4px;outline:none}.horizon-field input:focus,.horizon-field select:focus{border-color:var(--h-primary)}#horizonControlOutput{white-space:pre-wrap;min-height:54px;max-height:150px;margin-bottom:24px}.horizon-extension-center{width:100%}.extension-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) 145px 170px;gap:10px;margin-bottom:12px}.extension-toolbar label{display:grid;gap:5px;color:var(--h-dim);font-size:8px;letter-spacing:.12em}.extension-toolbar input,.extension-toolbar select{height:36px;border:1px solid color-mix(in srgb,var(--h-primary) 28%,transparent);border-radius:6px;background:color-mix(in srgb,var(--h-surface) 45%,#050208);color:var(--h-soft);padding:0 10px;outline:none}.extension-summary20{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.extension-summary20 span{padding:6px 9px;border:1px solid color-mix(in srgb,var(--h-primary) 20%,transparent);border-radius:99px;color:var(--h-dim);font-size:9px}.extension-summary20 b{color:var(--h-primary)}.extension-layout20{display:grid;grid-template-columns:minmax(280px,1.25fr) minmax(240px,.75fr);gap:14px;align-items:start}.extension-grid20{display:grid;gap:8px}.extension-card20{width:100%;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;text-align:left;padding:11px;border:1px solid color-mix(in srgb,var(--h-primary) 18%,transparent);border-radius:8px;background:color-mix(in srgb,var(--h-surface) 26%,transparent);color:var(--h-soft)}.extension-card20:hover,.extension-card20.selected{border-color:var(--h-primary);background:color-mix(in srgb,var(--h-primary) 12%,var(--h-surface))}.extension-card20.disabled{opacity:.58}.extension-icon20{width:38px;height:38px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--h-primary) 42%,transparent);border-radius:10px;background:color-mix(in srgb,var(--h-primary) 10%,transparent);color:var(--h-primary);font:700 10px var(--font-display)}.extension-card-body20{display:grid;gap:3px;min-width:0}.extension-card-body20 strong,.extension-detail-head20 strong{font-size:12px}.extension-card-body20 small,.extension-detail-head20 small{color:var(--h-dim);font-size:9px}.extension-card-body20 em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:color-mix(in srgb,var(--h-soft) 68%,transparent);font-size:10px;font-style:normal}.extension-state20{font-size:8px;color:var(--h-primary)}.extension-card20.disabled .extension-state20{color:var(--h-dim)}.extension-detail20{position:sticky;top:0;min-height:230px;padding:15px;border:1px solid color-mix(in srgb,var(--h-primary) 25%,transparent);border-radius:9px;background:color-mix(in srgb,var(--h-surface) 42%,#050208)}.extension-detail-head20{display:flex;gap:10px;align-items:center}.extension-detail-head20 div{display:grid;gap:3px}.extension-detail20 p,.extension-detail20 li{color:color-mix(in srgb,var(--h-soft) 72%,transparent);font-size:10px;line-height:1.5}.extension-detail20 h4{margin:15px 0 7px;color:var(--h-primary);font-size:8px;letter-spacing:.14em}.extension-detail20 ul{margin:0;padding-left:17px}.extension-chips20{display:flex;flex-wrap:wrap;gap:5px}.extension-chips20 button{padding:6px 8px;border:1px solid color-mix(in srgb,var(--h-primary) 23%,transparent);border-radius:5px;color:var(--h-soft);background:transparent;font-size:9px}.extension-toggle20{width:100%;margin-top:16px;padding:9px;border:1px solid var(--h-primary);border-radius:6px;background:color-mix(in srgb,var(--h-primary) 16%,transparent);color:var(--h-primary);font-size:9px}.extension-toggle20.danger{border-color:#ff6b78;color:#ff8c96;background:rgba(255,80,95,.08)}.extension-empty20{padding:24px;text-align:center;color:var(--h-dim);font-size:10px}@keyframes horizonCategoryIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@media(max-width:900px){.extension-layout20{grid-template-columns:1fr}.extension-detail20{position:relative}.extension-toolbar{grid-template-columns:1fr 1fr}.extension-search{grid-column:1/-1}}@media(max-width:760px){.horizon-form{grid-template-columns:1fr}.horizon-category-nav{gap:5px}.horizon-category-nav button{padding:8px 9px}.extension-toolbar{grid-template-columns:1fr}.extension-search{grid-column:auto}}";
  document.head.appendChild(horizonStyle);
  document.body.classList.remove("no-anim");
  localStorage.setItem("Maia.horizon.animations","1");
  $("toggleCompact").checked=localStorage.getItem("Maia.horizon.compact")==="1";
  $("app").classList.toggle("compact",$("toggleCompact").checked);
  $("app").classList.add("command-input-visible");
  updateClock();
  setInterval(()=>{if(!document.hidden)updateClock()},1000);
  setInterval(()=>{if(!document.hidden)updateMediaProgress20()},1000);
  parentWindow.postMessage({type:"maia-interface-ready"}, "*");
  parentWindow.postMessage({type:"maia-interface-action",action:"media.current"}, "*");
  const boot=$("horizonBoot"),bootProgress=$("horizonBootProgress"),bootState=$("horizonBootState");
  const bootSteps=[[18,"CARREGANDO IDENTIDADE"],[42,"CONECTANDO AO NÚCLEO"],[68,"SINCRONIZANDO INTEGRAÇÕES"],[88,"VALIDANDO SISTEMAS"],[100,"HORIZON ONLINE"]];
  bootSteps.forEach(([progress,label],index)=>setTimeout(()=>{
    if(bootProgress)bootProgress.style.width=`${progress}%`;
    if(bootState)bootState.textContent=label;
    if(progress===100)setTimeout(()=>boot?.classList.add("done"),320);
  },180+index*260));
})();
