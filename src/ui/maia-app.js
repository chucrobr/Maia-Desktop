/* =========================================================
   MAIA VOICE CORE
   Comandos por voz + integração Windows/Spotify.
========================================================= */
(function(){
  "use strict";

  // Compatibilidade funcional sem canvas, WebGL, Three.js ou loops visuais.
  let visualQuality = "disabled";
  window.nucleo = {
    setState(){},
    playBootSequence(){ return Promise.resolve(); },
    setPalette(){},
    setQuality(){ visualQuality = "disabled"; return visualQuality; },
    setIntensity(){ return 0; },
    getQuality(){
      return {selected:"disabled", effective:"disabled", particles:0, intensity:0, fps:0, drawCalls:0, triangles:0};
    },
    setAmplitude(){},
    setSpectrum(){},
    setListening(){},
    setSpeaking(){},
    idle(){},
    startMic(){ return Promise.resolve(); },
    stopMic(){ return Promise.resolve(); },
    setPaused(){ return true; },
    speak(text){
      return new Promise((resolve) => {
        if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){ resolve(); return; }
        window.speechSynthesis.cancel();
        let played = false;
        let attempts = 0;
        const play = () => {
          if(played) return;
          attempts += 1;
          const voices = window.speechSynthesis.getVoices();
          const femaleVoices = voices
            .filter((voice) =>
              /maria|francisca|luciana|female|feminin/i.test(voice.name) &&
              /^pt(?:-|_)/i.test(voice.lang)
            )
            .sort((a, b) => {
              const score = (voice) => {
                const name = String(voice.name || "");
                let value = 0;
                if(/natural/i.test(name)) value += 100;
                if(/online|neural/i.test(name)) value += 50;
                if(/francisca|luciana/i.test(name)) value += 20;
                if(/maria/i.test(name)) value += 10;
                if(/desktop/i.test(name)) value -= 25;
                if(/^pt-BR$/i.test(voice.lang)) value += 15;
                return value;
              };
              return score(b) - score(a);
            });
          const configuredVoiceName = String(state && state.preferences && state.preferences.voiceName || "");
          const configuredVoice = femaleVoices.find((voice) => voice.name === configuredVoiceName);
          const femaleVoice = configuredVoice || femaleVoices[0];
          if(!femaleVoice){
            if(attempts < 40){ setTimeout(play, 250); return; }
            resolve();
            return;
          }
          played = true;
          const utterance = new SpeechSynthesisUtterance(String(text || ""));
          utterance.lang = "pt-BR";
          utterance.voice = femaleVoice;
          const preferredRate = Number(state && state.preferences && state.preferences.voiceRate || 100);
          utterance.rate = Math.max(0.72, Math.min(1.35, preferredRate / 100 * 1.04));
          utterance.pitch = 1;
          utterance.volume = 1;
          utterance.onend = resolve;
          utterance.onerror = resolve;
          window.speechSynthesis.speak(utterance);
        };
        window.speechSynthesis.addEventListener("voiceschanged", play, {once:true});
        play();
      });
    }
  };
  window.__maiaVisualEngine = "disabled";

  const BRIDGE_URL = "http://127.0.0.1:17778";
  const BRIDGE_TOKEN = new URLSearchParams(location.search).get("bridgeToken") || "";
  const bridgeHeaders = (extra = {}) => ({...extra, "X-Maia-Token": BRIDGE_TOKEN});
  const bridgeEventUrl = () => BRIDGE_URL + "/voice/events?token=" + encodeURIComponent(BRIDGE_TOKEN);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceStatus = document.getElementById("voiceStatus");
  const systemState = document.getElementById("systemState");
  const coreState = document.getElementById("coreState");
  const textCommandForm = document.getElementById("textCommandForm");
  const textCommandInput = document.getElementById("textCommandInput");
  const brainConsole = document.getElementById("brainConsole");
  const brainTrigger = document.getElementById("brainTrigger");
  const brainPanel = document.getElementById("brainPanel");
  const brainOwnerName = document.getElementById("brainOwnerName");
  const brainTreatment = document.getElementById("brainTreatment");
  const brainCity = document.getElementById("brainCity");
  const brainSpeechMode = document.getElementById("brainSpeechMode");
  const brainPresence = document.getElementById("brainPresence");
  const brainVolume = document.getElementById("brainVolume");
  const brainWakeWords = document.getElementById("brainWakeWords");
  const brainTheme = document.getElementById("brainTheme");
  const brainQuality = document.getElementById("brainQuality");
  const brainIntensity = document.getElementById("brainIntensity");
  const brainAutoTheme = document.getElementById("brainAutoTheme");
  const brainBackground = document.getElementById("brainBackground");
  const brainVoiceRate = document.getElementById("brainVoiceRate");
  const brainVoiceName = document.getElementById("brainVoiceName");
  const brainDisplay = document.getElementById("brainDisplay");
  const brainExtensionSelect = document.getElementById("brainExtensionSelect");
  const brainExtensionDetails = document.getElementById("brainExtensionDetails");
  const brainExtensionSearch = document.getElementById("brainExtensionSearch");
  const brainExtensionFilter = document.getElementById("brainExtensionFilter");
  const brainExtensionGrid = document.getElementById("brainExtensionGrid");
  const brainExtensionSummary = document.getElementById("brainExtensionSummary");
  const brainRoutine = document.getElementById("brainRoutine");
  const brainRoutineName = document.getElementById("brainRoutineName");
  const brainRoutineSaved = document.getElementById("brainRoutineSaved");
  const brainMicSensitivity = document.getElementById("brainMicSensitivity");
  const brainOutput = document.getElementById("brainOutput");
  const brainBackupFile = document.getElementById("brainBackupFile");
  const setupWizard = document.getElementById("setupWizard");
  const setupResults = document.getElementById("setupResults");
  const titleEl = document.getElementById("titleEl");
  const hudEl = document.querySelector(".hud");
  const bootOverlay = document.getElementById("bootOverlay");
  const bootLog = document.getElementById("bootLog");
  const nowPlaying = document.getElementById("nowPlaying");
  const nowCover = document.getElementById("nowCover");
  const nowTitle = document.getElementById("nowTitle");
  const nowArtist = document.getElementById("nowArtist");
  const nowProgress = document.getElementById("nowProgress");
  const nowToggle = document.getElementById("nowToggle");
  function setBrainPanel(open){
    const visible = Boolean(open);
    brainConsole.classList.toggle("open", visible);
    document.body.classList.toggle("brain-menu-open", visible);
    brainTrigger.setAttribute("aria-expanded", String(visible));
    brainPanel.setAttribute("aria-hidden", String(!visible));
  }
  const centralCategoryByTitle={
    "PERFIL E PREFERÊNCIAS":"inicio","DADOS E PREFERÊNCIAS":"inicio","SOBRE A MAIA":"inicio",
    "INTEGRAÇÕES E VOZ":"integracoes","HOME ASSISTANT":"integracoes","CLIMA E TRÂNSITO":"integracoes","MAIA CONNECT • CELULAR":"integracoes","CENTRAL DE EXTENSÕES":"integracoes",
    "ROTINAS AUTOMÁTICAS":"automacao",
    "APARÊNCIA, VOZ E MONITOR":"visual",
    "MEMÓRIA, HISTÓRICO E BACKUP":"dados","CENTRAL DE COMANDOS":"dados",
    "RELÓGIO DO WINDOWS":"sistema","PRIVACIDADE E DIAGNÓSTICO":"sistema","ATUALIZAÇÕES":"sistema"
  };
  const centralSections=[...brainPanel.querySelectorAll(".brain-section")];
  centralSections.forEach(section=>{const title=section.querySelector("h3");section.dataset.centralCategory=centralCategoryByTitle[title&&title.textContent.trim()]||"sistema"});
  function selectCentralTab(category){
    const selected=category||"inicio";
    brainPanel.querySelectorAll("[data-central-tab]").forEach(button=>button.classList.toggle("active",button.dataset.centralTab===selected));
    centralSections.forEach(section=>section.classList.toggle("central-visible",section.dataset.centralCategory===selected));
    brainPanel.scrollTop=0;
    localStorage.setItem("Maia.centralTab",selected);
  }
  brainPanel.querySelectorAll("[data-central-tab]").forEach(button=>button.addEventListener("click",()=>selectCentralTab(button.dataset.centralTab)));
  selectCentralTab(localStorage.getItem("Maia.centralTab")||"inicio");
  brainTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = !brainConsole.classList.contains("open");
    setBrainPanel(opening);
    if(opening){
      try{
        brainOwnerName.value = state.preferences.ownerName === "senhor" ? "" : (state.preferences.ownerName || "");
        brainTreatment.value = state.preferences.treatment || "senhor";
        brainCity.value = state.preferences.city || "";
        brainSpeechMode.value = state.preferences.speechMode || "formal";
        brainPresence.value = state.preferences.presenceLevel || "vivid";
        brainVolume.value = state.preferences.preferredVolume == null ? 50 : state.preferences.preferredVolume;
        brainWakeWords.value = getWakeWords().join(", ");
        brainTheme.value = state.preferences.theme || "classic";
        brainQuality.value = localStorage.getItem("Maia.visualQuality") || "auto";
        brainIntensity.value = Math.round(Number(localStorage.getItem("Maia.visualIntensity") || 1) * 100);
        brainAutoTheme.value = state.preferences.autoTheme || "off";
        brainBackground.value = state.preferences.backgroundColor || "#071a24";
        brainVoiceRate.value = state.preferences.voiceRate || 100;
        brainMicSensitivity.value = state.preferences.micSensitivity || 55;
        renderVoiceOptions20();
        renderDisplayOptions20();
        renderExtensions20();
        refreshConnect20();
      }catch(err){
        logError20("brain.panel", err);
        if(brainOutput) brainOutput.textContent = "O painel abriu em modo seguro. Consulte Diagnóstico para revisar uma configuração incompatível.";
      }
    }
  });
  brainPanel.addEventListener("click", (event) => event.stopPropagation());
  document.getElementById("brainPanelClose").addEventListener("click", () => setBrainPanel(false));
  brainPanel.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command || "";
      if(!command) return;
      setBrainPanel(false);
      processCommand(command);
    });
  });
  brainPanel.querySelectorAll("[data-setup]").forEach((button) => {
    button.addEventListener("click", () => {
      const setup = button.dataset.setup;
      let command = "";
      if(setup === "owner" && brainOwnerName.value.trim()) command = "meu nome é " + brainOwnerName.value.trim();
      if(setup === "city" && brainCity.value.trim()) command = "definir cidade " + brainCity.value.trim();
      if(setup === "speech") command = "modo " + brainSpeechMode.value;
      if(setup === "presence"){
        state.preferences.presenceLevel = ["vivid", "balanced", "quiet"].includes(brainPresence.value) ? brainPresence.value : "vivid";
        saveMemory();
        speak(state.preferences.presenceLevel === "quiet" ? "Presença discreta ativada." : state.preferences.presenceLevel === "balanced" ? "Presença equilibrada ativada." : "Presença marcante ativada. Agora vai ficar interessante.");
        return;
      }
      if(setup === "volume") command = "volume " + Math.max(0, Math.min(100, Number(brainVolume.value) || 0));
      if(setup === "wake" || setup === "wake-reset"){
        const source = setup === "wake-reset" ? DEFAULT_WAKE_WORDS : brainWakeWords.value;
        state.preferences.wakeWords = sanitizeWakeWords(source);
        brainWakeWords.value = state.preferences.wakeWords.join(", ");
        saveMemory();
        speak(setup === "wake-reset" ? "Palavras de ativação restauradas." : "Palavras de ativação atualizadas.");
        return;
      }
      if(command) processCommand(command);
    });
  });
  document.addEventListener("click", () => setBrainPanel(false));
  document.addEventListener("keydown", (event) => {
    if(event.key === "Escape") setBrainPanel(false);
  });
  function readLocalJson(key, fallback){
    try{
      const stored = localStorage.getItem(key);
      if(stored == null) return fallback;
      const parsed = JSON.parse(stored);
      return parsed == null ? fallback : parsed;
    }catch(error){
      localStorage.removeItem(key);
      return fallback;
    }
  }

  const state = {
    voiceEnabled: true,
    waitingCommandUntil: 0,
    listening: false,
    restarting: false,
    bridgeOnline: false,
    lastNativeVoiceAt: 0,
    lastMicPulseAt: 0,
    clapTimes: [],
    lastClapAt: 0,
    lastRms: 0,
    noiseFloor: 0.004,
    suppressClapUntil: 0,
    commandArmed: false,
    forceCaptureUntil: 0,
    commandListenAfter: 0,
    nativeFirstUntil: 0,
    commandHandledAt: 0,
    recentVoiceCommands: new Map(),
    commandInFlight: false,
    nativeVoiceActive: false,
    browserHelperOpened: false,
    browserHelperOpening: false,
    presenceMonitoring: false,
    visualMode: localStorage.getItem("Maia.voice.visualMode") || "default",
    notes: readLocalJson("Maia.voice.notes", []),
    tasks: readLocalJson("Maia.voice.tasks", []),
    expenses: readLocalJson("Maia.voice.expenses", []),
    preferences: readLocalJson("Maia.voice.preferences", {ownerName:"senhor",preferredVolume:50,favoriteApps:[],frequentMusics:[],commonHours:{}}),
    learnedMemory: readLocalJson("Maia.voice.learnedMemory", {assistantName:"Maia",facts:[],customCommands:[],capabilities:["controlar Spotify","ajustar volume","abrir programas","criar lembretes","executar agendamentos","fazer cálculos","guardar memória"]}),
    reminders: readLocalJson("Maia.voice.reminders", []),
    commandHistory: readLocalJson("Maia.voice.history", []),
    routines: readLocalJson("Maia.voice.routines", {}),
    presence: readLocalJson("Maia.voice.presence", {lastSeenAt:0,lastGreetingDate:"",awayAt:0,dailyDate:"",dailyProgress:0,alerts:{},lastInternetOnline:null}),
    pendingSmartConfirmation: null,
    pendingMediaChoices: null,
    errorLog: readLocalJson("Maia.voice.errors", []),
    diagnostics: readLocalJson("Maia.voice.diagnostics", {heard:"",corrected:"",source:"",confidence:null,intent:"",intentConfidence:null,status:"aguardando",at:0})
  };
  localStorage.removeItem("Maia.crashClub.rounds");
  state.notes = Array.isArray(state.notes) ? state.notes : [];
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
  state.reminders = Array.isArray(state.reminders) ? state.reminders : [];
  state.commandHistory = Array.isArray(state.commandHistory) ? state.commandHistory : [];
  state.errorLog = Array.isArray(state.errorLog) ? state.errorLog : [];
  state.preferences = state.preferences && typeof state.preferences === "object" && !Array.isArray(state.preferences) ? state.preferences : {};
  state.learnedMemory = state.learnedMemory && typeof state.learnedMemory === "object" && !Array.isArray(state.learnedMemory) ? state.learnedMemory : {};
  state.routines = state.routines && typeof state.routines === "object" && !Array.isArray(state.routines) ? state.routines : {};
  state.presence = state.presence && typeof state.presence === "object" && !Array.isArray(state.presence) ? state.presence : {};
  state.diagnostics = state.diagnostics && typeof state.diagnostics === "object" && !Array.isArray(state.diagnostics) ? state.diagnostics : {};
  state.learnedMemory.facts = Array.isArray(state.learnedMemory.facts) ? state.learnedMemory.facts : [];
  state.learnedMemory.customCommands = Array.isArray(state.learnedMemory.customCommands) ? state.learnedMemory.customCommands : [];
  state.learnedMemory.capabilities = Array.isArray(state.learnedMemory.capabilities) ? state.learnedMemory.capabilities : [];
  state.presence = {lastSeenAt:0,lastGreetingDate:"",awayAt:0,dailyDate:"",dailyProgress:0,alerts:{},lastInternetOnline:null,...state.presence};
  state.presence.alerts = state.presence.alerts && typeof state.presence.alerts === "object" ? state.presence.alerts : {};
  state.preferences.speechMode = state.preferences.speechMode || "formal";
  state.preferences.treatment = ["senhor","senhora","name","neutral"].includes(state.preferences.treatment) ? state.preferences.treatment : "senhor";
  state.preferences.presenceLevel = state.preferences.presenceLevel || "vivid";
  state.preferences.theme = state.preferences.theme || "classic";
  state.preferences.voiceRate = Math.max(60, Math.min(140, Number(state.preferences.voiceRate || 100)));
  state.preferences.voiceName = String(state.preferences.voiceName || "");
  state.preferences.displayId = String(state.preferences.displayId || "");
  state.preferences.disabledExtensions = Array.isArray(state.preferences.disabledExtensions) ? state.preferences.disabledExtensions : [];
  state.preferences.voiceEngine = "stable";
  state.learnedMemory.assistantName = "Maia";
  state.preferences.silentMode = Boolean(state.preferences.silentMode);
  state.preferences.autoTheme = state.preferences.autoTheme || "off";
  state.preferences.mediaHistory = Array.isArray(state.preferences.mediaHistory) ? state.preferences.mediaHistory : [];
  state.preferences.systemAlerts = Array.isArray(state.preferences.systemAlerts) ? state.preferences.systemAlerts : [];
  state.preferences.micSensitivity = Math.max(10, Math.min(100, Number(state.preferences.micSensitivity || 55)));
  state.preferences.privacyMode = Boolean(state.preferences.privacyMode);
  state.routines.saved = state.routines.saved && typeof state.routines.saved === "object" ? state.routines.saved : {};
  state.speechMode = state.preferences.speechMode;

  function refreshVoiceOptions20(){
    if(!brainVoiceName || !window.speechSynthesis) return;
    const selected = String(state.preferences.voiceName || "");
    const voices = window.speechSynthesis.getVoices()
      .filter((voice) => /^pt(?:-|_)/i.test(voice.lang) && /maria|francisca|luciana|female|feminin/i.test(voice.name))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    brainVoiceName.innerHTML = '<option value="">Automática feminina</option>' + voices
      .map((voice) => `<option value="${escapeHtml(voice.name)}">${escapeHtml(voice.name)} • ${escapeHtml(voice.lang)}</option>`)
      .join("");
    brainVoiceName.value = voices.some((voice) => voice.name === selected) ? selected : "";
  }
  refreshVoiceOptions20();
  if(window.speechSynthesis) window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceOptions20);

  let recognition = null;
  let selfDestructRun = 0;

  function setHud(text, mode){
    voiceStatus.textContent = text;
    if(mode) window.nucleo.setState(mode);
  }

  function setCore(text){
    coreState.textContent = text;
  }

  function pick(list){
    return list[Math.floor(Math.random() * list.length)];
  }

  const presenceMemory = new Map();
  let activeMusicMood = "neutral";

  function pickFresh(key, lines){
    const available = (lines || []).filter(Boolean);
    if(!available.length) return "";
    const previous = presenceMemory.get(key);
    const choices = available.length > 1 ? available.filter(line => line !== previous) : available;
    const selected = pick(choices.length ? choices : available);
    presenceMemory.set(key, selected);
    return selected;
  }

  function presenceMode(){
    return state.speechMode || state.preferences.speechMode || "formal";
  }

  function expressive(kind, factual, data = {}){
    const presenceLevel = state.preferences.presenceLevel || "vivid";
    if(presenceLevel === "quiet") return String(factual || "").trim();
    if(presenceLevel === "balanced" && Math.random() < 0.35) return String(factual || "").trim();
    const name = String(data.name || data.program || "").trim();
    const modes = {
      open: {
        formal: ["Tudo certo por aqui.", "Deixe comigo.", "Já estou cuidando disso."],
        casual: ["Pode deixar comigo.", "Boa, já estou abrindo.", "Partiu."],
        sarcastic: ["Uma tarefa digna dos meus circuitos.", "Complicadíssimo. Já resolvi.", "Lá vamos nós."]
      },
      complete: {
        formal: ["Tudo pronto.", "Operação concluída.", "Resolvido."],
        casual: ["Prontinho.", "Fechado.", "Tudo certo."],
        sarcastic: ["Milagre tecnológico concluído.", "Sobrevivi à operação.", "Mais uma missão impossível resolvida."]
      },
      reminder: {
        formal: ["Pode deixar, eu aviso no momento certo.", "Ficou sob minha responsabilidade.", "Não deixarei passar."],
        casual: ["Relaxa, eu te lembro.", "Pode deixar comigo.", "Anotado. Eu te aviso."],
        sarcastic: ["Ainda bem que alguém aqui tem memória.", "Anotado, antes que o universo esqueça.", "Eu lembro por nós dois."]
      }
    };
    const group = modes[kind] || modes.complete;
    const suffix = pickFresh("presence:" + kind + ":" + presenceMode(), group[presenceMode()] || group.formal);
    return [String(factual || "").trim(), suffix.replace("{name}", name)].filter(Boolean).join(" ");
  }

  function savePresence(){
    state.presence.lastSeenAt = Date.now();
    localStorage.setItem("Maia.voice.presence", JSON.stringify(state.presence));
  }

  function todayKey(){
    return new Date().toLocaleDateString("pt-BR");
  }

  function presenceCanSpeak(key, cooldownMs){
    if((state.preferences.presenceLevel || "vivid") === "quiet") return false;
    const now = Date.now();
    if(now - Number(state.presence.alerts[key] || 0) < cooldownMs) return false;
    state.presence.alerts[key] = now;
    savePresence();
    return true;
  }

  function appPresence(program){
    const app = normalize(program);
    if(/\b(code|vscode|visual studio|android studio|cursor)\b/.test(app)) return pickFresh("app:code", ["Ambiente de criação aberto. Vamos tirar essa ideia do papel.", "Código na tela. Estou com você nessa.", "Oficina aberta. Hora de construir algo bom."]);
    if(/\b(steam|epic|valorant|fortnite|minecraft|jogo|game)\b/.test(app)) return pickFresh("app:game", ["Modo diversão. Boa partida.", "Tudo pronto. Agora é com você.", "Entrando em território competitivo. Divirta-se."]);
    if(/\b(photoshop|illustrator|figma|canva|blender)\b/.test(app)) return pickFresh("app:create", ["Espaço criativo aberto. Quero ver no que isso vai virar.", "Ferramentas prontas. Pode criar.", "Boa. Hora de transformar ideia em imagem."]);
    if(/\b(chrome|edge|firefox|navegador)\b/.test(app)) return pickFresh("app:web", ["Navegador aberto. Se precisar encontrar algo, é só chamar.", "Janela para o mundo aberta.", "Pronto para explorar."]);
    return expressive("open", "Abrindo " + program + ".", {program});
  }

  function markDailyProgress(){
    const today = todayKey();
    if(state.presence.dailyDate !== today){
      state.presence.dailyDate = today;
      state.presence.dailyProgress = 0;
    }
    state.presence.dailyProgress += 1;
    savePresence();
    if([3, 5, 10].includes(state.presence.dailyProgress) && presenceCanSpeak("progress:" + today + ":" + state.presence.dailyProgress, 86400000)){
      setTimeout(() => speak(pickFresh("progress:" + state.presence.dailyProgress, [
        "Boa sequência. Já organizei " + state.presence.dailyProgress + " coisas com você hoje.",
        state.presence.dailyProgress + " tarefas encaminhadas hoje. Estamos rendendo.",
        "Olha o ritmo: " + state.presence.dailyProgress + " coisas resolvidas juntos hoje."
      ])), 900);
    }
  }

  function contextualWelcome(){
    const today = todayKey();
    const firstToday = state.presence.lastGreetingDate !== today;
    state.presence.lastGreetingDate = today;
    savePresence();
    const real = window.__maiaTelemetry || {};
    const detail = real.battery_percent != null && !real.battery_charging && real.battery_percent <= 30
      ? " A bateria está em " + Math.round(real.battery_percent) + " por cento."
      : "";
    const lines = firstToday ? [
      greeting() + ", " + ownerTitle() + ". Bom ter você por aqui. Estou online e atento.",
      greeting() + ", " + ownerTitle() + ". Sistemas prontos. Vamos fazer este dia valer.",
      "Olá, " + ownerTitle() + ". Maia presente. O que vamos construir hoje?"
    ] : [
      greeting() + ", " + ownerTitle() + ". Estou de volta com você.",
      "Maia online outra vez. Pronto quando você estiver.",
      "Tudo sincronizado, " + ownerTitle() + ". Podemos continuar."
    ];
    speak(pickFresh(firstToday ? "welcome:first" : "welcome:return", lines) + detail);
  }

  let networkPresenceWarmupUntil=Date.now()+45000;
  let networkPresenceCandidate=null;
  let networkPresenceCandidateCount=0;
  function evaluateSystemPresence(real){
    if(!state.presenceMonitoring || !real || state.commandInFlight || window.__maiaSpeaking) return;
    if(typeof real.internet_online === "boolean"){
      if(Date.now()<networkPresenceWarmupUntil||typeof state.presence.lastInternetOnline!=="boolean"){
        state.presence.lastInternetOnline=real.internet_online;
        networkPresenceCandidate=null;
        networkPresenceCandidateCount=0;
      }else if(real.internet_online===state.presence.lastInternetOnline){
        networkPresenceCandidate=null;
        networkPresenceCandidateCount=0;
      }else{
        if(networkPresenceCandidate===real.internet_online)networkPresenceCandidateCount+=1;
        else{networkPresenceCandidate=real.internet_online;networkPresenceCandidateCount=1;}
        if(networkPresenceCandidateCount>=2){
          state.presence.lastInternetOnline=real.internet_online;
          networkPresenceCandidate=null;
          networkPresenceCandidateCount=0;
          if(real.internet_online===false&&presenceCanSpeak("internet:offline",1800000))speak("Percebi que a internet caiu. Continuo aqui; os comandos locais seguem funcionando.");
          if(real.internet_online===true&&presenceCanSpeak("internet:online",300000))speak("A internet voltou. Conexão restabelecida.");
        }
      }
    }
    if(real.battery_percent != null && !real.battery_charging && real.battery_percent <= 15 && presenceCanSpeak("battery:low", 3600000)){
      speak("Atenção: bateria em " + Math.round(real.battery_percent) + " por cento. Melhor conectar o carregador.");
    }else if(real.disk_percent >= 92 && presenceCanSpeak("disk:high", 21600000)){
      speak("Aviso importante: o disco C está com " + Math.round(real.disk_percent) + " por cento de uso. Vale liberar espaço.");
    }else if(real.ram_percent >= 92 && presenceCanSpeak("ram:high", 3600000)){
      speak("A memória está bem carregada, em " + Math.round(real.ram_percent) + " por cento. Posso ajudar a fechar algo.");
    }
    for(const alert of state.preferences.systemAlerts){
      const value = alert.metric === "cpu" ? Number(real.cpu_percent) :
        alert.metric === "ram" ? Number(real.ram_percent) :
        alert.metric === "battery" ? Number(real.battery_percent) : NaN;
      const triggered = Number.isFinite(value) && (alert.operator === "below" ? value <= alert.threshold : value >= alert.threshold);
      if(triggered && Date.now() - Number(alert.lastAt || 0) > 30 * 60000){
        alert.lastAt = Date.now();
        const label = alert.metric === "cpu" ? "CPU" : alert.metric === "ram" ? "memória RAM" : "bateria";
        speak("Aviso configurado: " + label + " está em " + Math.round(value) + " por cento.");
      }
    }
    savePresence();
    localStorage.setItem("Maia.voice.preferences", JSON.stringify(state.preferences));
  }

  function handlePresenceVisibility(){
    if(document.hidden){
      state.presence.awayAt = Date.now();
      savePresence();
      return;
    }
    const awayAt = Number(state.presence.awayAt || 0);
    state.presence.awayAt = 0;
    savePresence();
    const awayMinutes = Math.floor((Date.now() - awayAt) / 60000);
    if(awayAt && awayMinutes >= 10 && presenceCanSpeak("return", 600000)){
      const hours = Math.round(awayMinutes / 60);
      const duration = awayMinutes >= 60 ? hours + (hours === 1 ? " hora" : " horas") : awayMinutes + " minutos";
      setTimeout(() => speak(pickFresh("presence:return", [
        "Bem-vindo de volta. Você ficou fora por cerca de " + duration + ". Mantive tudo sob observação.",
        "Você voltou. Foram aproximadamente " + duration + ". Estou pronto para continuar.",
        "De volta à central. Fiquei por aqui durante esses " + duration + "."
      ])), 700);
    }
  }
  document.addEventListener("visibilitychange", handlePresenceVisibility);
  window.addEventListener("beforeunload", savePresence);

  function classifyMusicMood(...values){
    const text = normalize(values.filter(Boolean).join(" "));
    const rules = [
      {mood:"combat", pattern:/\b(metal|rock|linkin park|system of a down|slipknot|metallica|rage against|bring me the horizon|rap pesado|trap pesado)\b/},
      {mood:"romantic", pattern:/\b(amor|love|romant|paixao|paixão|casamento|love song|perfect|thinking out loud)\b/},
      {mood:"sad", pattern:/\b(triste|sad|saudade|chorar|sofrencia|sofrência|melancol|depress|heartbreak)\b/},
      {mood:"calm", pattern:/\b(lofi|lo-fi|calma|relax|acoustic|acustic|piano|classica|clássica|jazz|sleep|meditation)\b/},
      {mood:"nostalgic", pattern:/\b(anos 60|anos 70|anos 80|anos 90|anos 2000|classico|clássico|nostalgia|old school|flashback)\b/},
      {mood:"energetic", pattern:/\b(funk|eletronica|eletrônica|dance|edm|house|party|festa|animada|treino|workout|phonk|pop)\b/}
    ];
    const match = rules.find(rule => rule.pattern.test(text));
    return match ? match.mood : "neutral";
  }

  function applyMusicMood(mood){
    activeMusicMood = mood || "neutral";
    const visualModes = {
      combat:"combat",
      energetic:"focus",
      romantic:"rest",
      sad:"rest",
      calm:"rest",
      nostalgic:"rest",
      neutral:"default"
    };
    setVisualMode(visualModes[activeMusicMood] || "default");
  }

  let musicPlaybackInactivePolls = 0;
  let lastPlayback20 = null;
  async function refreshNowPlaying20(){
    if(!state.bridgeOnline) return;
    try{
      const data = await callBridge("spotify.current");
      const current = data && data.result;
      lastPlayback20 = current;
      if(!current || !current.name){
        nowPlaying.classList.remove("visible");
        return;
      }
      nowTitle.textContent = current.name;
      nowArtist.textContent = [current.artists,current.album].filter(Boolean).join(" • ");
      if(current.image){ nowCover.src=current.image; nowCover.style.visibility="visible"; }else{ nowCover.removeAttribute("src"); nowCover.style.visibility="hidden"; }
      nowProgress.style.width = current.durationMs ? Math.min(100, current.progressMs / current.durationMs * 100).toFixed(1) + "%" : "0%";
      nowToggle.textContent = current.playing ? "Ⅱ" : "▶";
      nowPlaying.classList.add("visible");
    }catch(err){
      nowPlaying.classList.remove("visible");
    }
  }
  nowPlaying.querySelectorAll("[data-media]").forEach(button => button.addEventListener("click", async () => {
    const action = button.dataset.media;
    try{
      if(action === "previous") await callBridge("spotify.previous");
      else if(action === "next") await callBridge("spotify.next");
      else if(lastPlayback20 && lastPlayback20.playing) await callBridge("spotify.pause");
      else await callBridge("spotify.resume");
      setTimeout(refreshNowPlaying20, 350);
    }catch(err){}
  }));
  async function monitorMusicVisual(){
    if(activeMusicMood === "neutral") return;
    try{
      const data = await callBridge("spotify.current");
      const current = data && data.result;
      if(current && current.playing){
        musicPlaybackInactivePolls = 0;
        return;
      }
      musicPlaybackInactivePolls += 1;
      if(musicPlaybackInactivePolls >= 2){
        musicPlaybackInactivePolls = 0;
        applyMusicMood("neutral");
      }
    }catch(err){}
  }

  function musicReaction(query, track){
    const title = String(track && track.name || query || "essa música").trim();
    const artists = String(track && track.artists || "").trim();
    const mood = classifyMusicMood(query, title, artists);
    applyMusicMood(mood);
    const reactions = {
      combat: [
        "Agora você falou a minha língua. Modo combate ativado.",
        "Essa chega com energia. Preparando o sistema para impacto.",
        "Escolha pesada. Aumentando a intensidade por aqui."
      ],
      romantic: [
        "Entendido. Criando o clima.",
        "Boa escolha. Essa merece luz baixa e atenção.",
        "Tem sentimento nessa escolha. Aproveite o momento."
      ],
      sad: [
        "Essa bate diferente. Estou aqui com você.",
        "Entendi o clima. Vou deixar o ambiente mais tranquilo.",
        "Algumas músicas dizem o que a gente não consegue. Aproveite."
      ],
      calm: [
        "Boa escolha. Hora de desacelerar um pouco.",
        "Clima tranquilo ativado. Respire e aproveite.",
        "Essa combina com uma pausa bem merecida."
      ],
      nostalgic: [
        "Clássica. Algumas músicas realmente atravessam o tempo.",
        "Essa desbloqueia memórias. Excelente escolha.",
        "Voltando no tempo com estilo. Aproveite."
      ],
      energetic: [
        "Essa é boa, hein? Ótimo gosto. Aproveite sua música.",
        "Energia lá em cima. Essa escolha foi certeira.",
        "Boa! Ativando um clima mais vivo para acompanhar."
      ],
      neutral: [
        "Essa é boa, hein? Ótimo gosto. Aproveite sua música.",
        "Boa escolha. Vou entrar no clima com você.",
        "Gostei da seleção. Som liberado, aproveite.",
        "Essa merece tocar. Curta o momento."
      ]
    };
    return pickFresh("music:" + mood, reactions[mood] || reactions.neutral);
  }

  function weatherReaction(weather){
    if((state.preferences.presenceLevel || "vivid") === "quiet") return "";
    const temp = Number(weather && weather.temp);
    const rain = Number(weather && weather.rain);
    if(rain >= 60) return pickFresh("weather:rain", [
      "Melhor levar um guarda-chuva. Eu não gostaria de ver meus circuitos nessa chuva.",
      "Chance alta de chuva. Planeje a saída com cuidado.",
      "O céu parece decidido a participar do seu dia. Leve um guarda-chuva."
    ]);
    if(temp >= 30) return pickFresh("weather:hot", [
      "Dia quente. Água por perto seria uma decisão inteligente.",
      "Está calor de verdade. Hidrate-se.",
      "Temperatura alta lá fora. Vá com calma."
    ]);
    if(temp <= 15) return pickFresh("weather:cold", [
      "Está frio. Um casaco parece uma excelente ideia.",
      "Clima frio detectado. Melhor sair preparado.",
      "Hoje pede algo quente e um bom casaco."
    ]);
    return pickFresh("weather:mild", [
      "Clima agradável. Parece um bom momento para sair.",
      "O tempo está colaborando hoje.",
      "Condições tranquilas lá fora."
    ]);
  }

  function setVisualMode(mode){
    const selected = ["focus", "combat", "rest"].includes(mode) ? mode : "default";
    state.visualMode = selected;
    localStorage.setItem("Maia.voice.visualMode", selected);
    document.body.classList.remove("mode-focus", "mode-combat", "mode-rest");
    if(selected !== "default") document.body.classList.add("mode-" + selected);
    const palette = {
      default:themePalette20(state.preferences.theme),
      focus:{core:0xd3fbff, key:0x7af4ff, rim:0x89d8ff, halo:.82},
      combat:{core:0xff6b6b, key:0xff6b6b, rim:0xffb454, halo:.9},
      rest:{core:0x92a7ff, key:0x92a7ff, rim:0xc9a8ff, halo:.58}
    }[selected];
    if(window.nucleo && window.nucleo.setPalette) window.nucleo.setPalette(palette, selected);
    if(document.title !== "MAIA::MODE::" + selected) document.title = "MAIA::MODE::" + selected;
    setCore(selected === "default" ? "MODO PADRAO" : "MODO " + selected.toUpperCase());
  }

  function syncVoiceMode(){
    if(!SR){
      setCore("WEB SPEECH INDISPONIVEL");
      setHud("MOTOR ONLINE AUSENTE", "idle");
      return;
    }
    if(state.voiceEnabled){
      setCore("WEB SPEECH ATIVO");
      setHud("DIGA MAIA", "listening");
    }else{
      setCore("VOZ DESLIGADA");
      setHud("ESCUTA PAUSADA", "idle");
    }
  }

  function armCommandByClap(){
    state.clapTimes = [];
    state.commandArmed = true;
    state.waitingCommandUntil = Date.now() + 15000;
    state.commandListenAfter = Date.now() + 420;
    state.nativeFirstUntil = 0;
    state.forceCaptureUntil = Date.now() + 2100;
    setCore("OUVINDO COMANDO");
    setHud("PODE FALAR", "listening");
  }

  function disarmCommand(){
    state.commandArmed = false;
    state.waitingCommandUntil = 0;
    state.forceCaptureUntil = 0;
    state.commandListenAfter = 0;
    state.nativeFirstUntil = 0;
    state.clapTimes = [];
  }

  function suppressClaps(ms = 3500){
    state.clapTimes = [];
    state.suppressClapUntil = Math.max(state.suppressClapUntil, Date.now() + ms);
  }

  function addBootLine(text, cls){
    if(!bootLog) return;
    const line = document.createElement("div");
    line.className = "boot-log-line" + (cls ? " " + cls : "");
    line.textContent = text;
    bootLog.appendChild(line);
  }

  async function showDemoOrbit(){
    const container = document.getElementById("demoOrbit");
    if(!container){
      speak("Demonstração indisponível nesta interface.");
      return;
    }
    container.innerHTML = "";

    const cards = [];
    try{
      const data = await callBridge("spotify.current");
      const current = data && data.result;
      if(current && current.name){
        cards.push({label:"SPOTIFY", title:current.name, sub:current.artists || ""});
      }
    }catch(err){}

    const real = window.__maiaTelemetry;
    if(real && real.ok){
      const parts = [];
      if(real.cpu_percent != null) parts.push("CPU " + Math.round(real.cpu_percent) + "%");
      if(real.ram_percent != null) parts.push("RAM " + Math.round(real.ram_percent) + "%");
      if(real.battery_percent != null) parts.push("BAT " + Math.round(real.battery_percent) + "%");
      if(parts.length) cards.push({label:"SISTEMA", title:"Telemetria ao vivo", sub:parts.join(" - ")});
    }

    try{
      const weather = await getCurrentWeather();
      if(weather){
        cards.push({label:"CLIMA", title:weather.label, sub:Math.round(weather.temp) + "°C - " + weather.condition});
      }
    }catch(err){}

    if(state.preferences.frequentMusics && state.preferences.frequentMusics[0]){
      cards.push({label:"MEMORIA", title:"Música mais pedida", sub:state.preferences.frequentMusics[0].name});
    }

    try{
      const newsData = await callBridge("news.today");
      const items = (newsData && newsData.result) || [];
      if(items[0]){
        cards.push({label:"NOTICIA", title:items[0].title, sub:items[0].source || ""});
      }
    }catch(err){}

    if(!cards.length){
      speak("Não encontrei dados suficientes para a demonstração. Verifique a conexão da Maia.");
      return;
    }

    const radius = Math.min(window.innerWidth, window.innerHeight) * .28;
    const elements = cards.map((card) => {
      const el = document.createElement("div");
      const label = document.createElement("div");
      const title = document.createElement("div");
      const sub = document.createElement("div");
      el.className = "demo-card";
      label.className = "demo-label";
      title.className = "demo-title";
      sub.className = "demo-sub";
      label.textContent = card.label;
      title.textContent = card.title;
      sub.textContent = card.sub || "";
      el.append(label, title, sub);
      container.appendChild(el);
      return el;
    });

    requestAnimationFrame(() => elements.forEach((el) => el.classList.add("visible")));

    const total = elements.length;
    const duration = 9000;
    const start = performance.now();
    return new Promise((resolve) => {
      function frame(now){
        const elapsed = now - start;
        const spin = elapsed * .09;
        elements.forEach((el, index) => {
          const angle = spin + (360 / total) * index;
          el.style.transform = "translate(-50%,-50%) rotate(" + angle + "deg) translateX(" + radius + "px) rotate(" + (-angle) + "deg)";
        });
        if(elapsed < duration){
          requestAnimationFrame(frame);
        }else{
          elements.forEach((el) => el.classList.remove("visible"));
          setTimeout(() => {
            container.innerHTML = "";
            resolve();
          }, 600);
        }
      }
      requestAnimationFrame(frame);
    });
  }

  async function runBootIntro(){
    if(!bootOverlay || !hudEl || !window.nucleo || !window.nucleo.playBootSequence){
      setCore("WEB SPEECH ATIVO");
      return;
    }

    if(bootLog) bootLog.innerHTML = "";
    if(titleEl) titleEl.classList.remove("glitch");
    hudEl.classList.add("hud-booting");
    bootOverlay.classList.remove("fade-out");
    bootOverlay.classList.remove("active");
    void bootOverlay.offsetWidth;
    bootOverlay.classList.add("active");
    setCore("SEQUENCIA DE BOOT INICIADA");

    const lines = [
      "INICIALIZANDO NUCLEO...",
      "CARREGANDO PROTOCOLOS DE COMANDO...",
      "SINCRONIZANDO SENSORES...",
      "CALIBRANDO RECONHECIMENTO DE VOZ...",
      "VERIFICANDO INTEGRIDADE DO SISTEMA..."
    ];

    const corePromise = window.nucleo.playBootSequence();
    for(let i = 0; i < lines.length; i++){
      addBootLine(lines[i]);
      await new Promise((resolve) => setTimeout(resolve, 340));
    }

    await corePromise;
    addBootLine("NUCLEO ESTAVEL. SISTEMAS ONLINE.", "ok");
    await new Promise((resolve) => setTimeout(resolve, 550));

    hudEl.classList.remove("hud-booting");
    if(titleEl){
      titleEl.classList.add("glitch");
      setTimeout(() => titleEl.classList.remove("glitch"), 500);
    }
    bootOverlay.classList.add("fade-out");
    setTimeout(() => {
      bootOverlay.classList.remove("active", "fade-out");
      if(bootLog) bootLog.innerHTML = "";
    }, 900);

    setCore("WEB SPEECH ATIVO");
    contextualWelcome();
  }

  function armConfirmationReply(){
    state.clapTimes = [];
    state.commandArmed = true;
    state.waitingCommandUntil = Date.now() + 9000;
    state.commandListenAfter = Date.now() + 420;
    state.nativeFirstUntil = 0;
    state.forceCaptureUntil = Date.now() + 1800;
    setCore("AGUARDANDO CONFIRMACAO");
    setHud("RESPONDA SIM OU NAO", "listening");
  }

  function normalize(text){
    return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function parseSelfDestructSeconds(text){
    const match = normalize(text).match(/(?:em|de)\s+(\d{1,3})\s*segundos?/) || normalize(text).match(/(\d{1,3})\s*segundos?/);
    return Math.min(60, Math.max(5, match ? Number(match[1]) : 5));
  }

  const DEFAULT_WAKE_WORDS = Object.freeze(["maia","maya","maiaa"]);
  function sanitizeWakeWords(value){
    const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
    const unique = [];
    for(const item of values){
      const word = normalize(item).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if(word.length >= 2 && word.length <= 24 && !unique.includes(word)) unique.push(word);
      if(unique.length >= 24) break;
    }
    return unique.length ? unique : [...DEFAULT_WAKE_WORDS];
  }

  state.preferences.wakeWords = sanitizeWakeWords(state.preferences.wakeWords || DEFAULT_WAKE_WORDS);

  function getWakeWords(){
    return sanitizeWakeWords(state.preferences.wakeWords || DEFAULT_WAKE_WORDS);
  }

  function wakeWordPattern(flags = "i"){
    const alternatives = getWakeWords().map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
    return new RegExp("\\b(?:" + alternatives.join("|") + ")\\b", flags);
  }

  function findWakeWord(text){
    return wakeWordPattern().test(normalize(text));
  }

  function removeWakeWord(text){
    return normalize(text).replace(wakeWordPattern(), "").replace(/^[\s,.:;-]+/, "").trim();
  }

  function saveMemory(){
    localStorage.setItem("Maia.voice.notes", JSON.stringify(state.notes));
    localStorage.setItem("Maia.voice.tasks", JSON.stringify(state.tasks));
    localStorage.setItem("Maia.voice.expenses", JSON.stringify(state.expenses));
    localStorage.setItem("Maia.voice.preferences", JSON.stringify(state.preferences));
    localStorage.setItem("Maia.voice.learnedMemory", JSON.stringify(state.learnedMemory));
    localStorage.setItem("Maia.voice.reminders", JSON.stringify(state.reminders));
    localStorage.setItem("Maia.voice.history", JSON.stringify(state.commandHistory.slice(0, 80)));
    localStorage.setItem("Maia.voice.routines", JSON.stringify(state.routines));
    localStorage.setItem("Maia.voice.errors", JSON.stringify(state.errorLog.slice(0, 100)));
    localStorage.setItem("Maia.voice.diagnostics", JSON.stringify(state.diagnostics));
    savePresence();
  }

  async function runSystemTest20(output){
    const lines = [];
    const push = (ok, label, detail = "") => {
      lines.push((ok ? "✓ " : "○ ") + label + (detail ? " — " + detail : ""));
      if(output) output.textContent = "TESTE COMPLETO DA MAIA\n\n" + lines.join("\n");
    };
    push(Boolean(window.speechSynthesis), "Saída de voz", window.speechSynthesis ? "disponível" : "indisponível");
    push(Boolean(SR), "Reconhecimento de voz", SR ? "disponível" : "use o auxiliar online");
    push(!state.preferences.privacyMode, "Microfone", state.preferences.privacyMode ? "bloqueado pelo modo privado" : "pronto para escuta");
    try{
      const network = await callBridge("network.status");
      const result = network && network.result || {};
      push(Boolean(result.online), "Internet", result.online ? "conectada" : "sem conexão");
    }catch(err){ push(false, "Internet", err.message); }
    try{
      const response = await callBridge("integration.status");
      const status = response && response.result || {};
      push(Boolean(status.bridge), "Ponte local", status.bridge ? "operacional" : "indisponível");
      push(Boolean(status.spotify && status.spotify.connected), "Spotify", status.spotify && status.spotify.connected ? "conectado" : "opcional, não conectado");
      const apps = status.installed || [];
      push(apps.length > 0, "Aplicativos integrados", apps.length ? apps.map(item => item.name).join(", ") : "nenhum detectado");
    }catch(err){ push(false, "Integrações", err.message); }
    try{
      const displays = window.maiaDesktop ? await window.maiaDesktop.getDisplays() : [];
      push(displays.length > 0, "Monitores", displays.length ? displays.length + " detectado(s)" : "controle indisponível");
    }catch(err){ push(false, "Monitores", err.message); }
    push(state.errorLog.length === 0, "Saúde recente", state.errorLog.length ? state.errorLog.length + " erro(s) registrado(s)" : "sem erros");
    if(output) output.textContent += "\n\nTeste concluído. Itens opcionais não impedem o funcionamento da Maia.";
    return lines;
  }

  let connectStatus20 = null;
  async function refreshConnect20(action = "connect.status"){
    const output = document.getElementById("brainConnectStatus");
    try{
      const response = await callBridge(action);
      connectStatus20 = response && response.result || {};
      if(!connectStatus20.enabled){
        output.textContent = "Maia Connect desligado.\nAtive somente em uma rede Wi-Fi confiável.";
        document.getElementById("brainConnectEnable").textContent = "ATIVAR CONNECT";
        document.getElementById("brainConnectQr").hidden = true;
        return connectStatus20;
      }
      const addresses = connectStatus20.addresses || [];
      const expires = connectStatus20.pairExpiresAt ? new Date(connectStatus20.pairExpiresAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—";
      output.textContent = [
        "MAIA CONNECT ATIVO",
        "Abra no celular: " + (addresses[0] || "Nenhum endereço de rede encontrado"),
        "Código do proprietário: " + (connectStatus20.pairCode || "—"),
        "Código de convidado (somente mídia): " + (connectStatus20.guestCode || "—") + " • válidos até " + expires,
        "Celulares pareados nesta sessão: " + (connectStatus20.pairedDevices || 0),
        "",
        "O celular e o computador devem estar na mesma rede Wi-Fi."
      ].join("\n");
      document.getElementById("brainConnectEnable").textContent = "RENOVAR CÓDIGO";
      try{
        const qr = await callBridge("connect.qr");
        const image = document.getElementById("brainConnectQr");
        image.src = qr && qr.result && qr.result.dataUrl || "";
        image.hidden = !image.src;
      }catch(err){}
      return connectStatus20;
    }catch(err){
      output.textContent = "Não foi possível consultar o Maia Connect: " + err.message;
      return null;
    }
  }

  const extensionFallback20 = [
    {id:"windows-core",name:"Windows",version:"1.2.0",category:"Sistema",summary:"Controle de aplicativos, janelas, volume e recursos do Windows.",badge:"updated",functional:true,intentPrefixes:["system.","volume.","window.","clipboard.","screenshot.","brightness."],commands:["abrir calculadora","volume 50","organizar janelas","tirar print"],permissions:["Abrir aplicativos","Controlar volume","Organizar janelas","Acessar área de transferência mediante comando"]},
    {id:"spotify",name:"Spotify",version:"1.1.0",category:"Música",summary:"Reprodução, busca, playlists e controles de música.",badge:"updated",functional:true,intentPrefixes:["spotify."],commands:["abrir Spotify","tocar minha playlist","pausar música"],permissions:["Abrir Spotify","Consultar reprodução","Controlar músicas e playlists"]},
    {id:"streaming",name:"Streaming",version:"1.1.0",category:"Entretenimento",summary:"Acesso rápido a serviços de filmes e séries.",badge:"updated",functional:true,intentPrefixes:["streaming."],commands:["abrir Netflix","abrir Prime Video","pausar vídeo"],permissions:["Detectar aplicativos compatíveis","Abrir serviços","Controlar reprodução"]},
    {id:"voice",name:"Voz",version:"1.2.0",category:"Comunicação",summary:"Reconhecimento, ativação e respostas por voz.",badge:"updated",functional:true,intentPrefixes:["speech."],commands:["teste de voz","modo silencioso","parar fala"],permissions:["Usar microfone quando ativado","Converter fala em comandos","Reproduzir respostas de voz"]},
    {id:"productivity",name:"Produtividade",version:"1.2.0",category:"Produtividade",summary:"Foco, agenda, tarefas, memórias e lembretes.",badge:"updated",functional:true,intentPrefixes:["reminder.","alarm.","timer.","schedule.","agenda.","memory.","task.","focus."],commands:["modo trabalho","criar lembrete","minha agenda"],permissions:["Salvar lembretes localmente","Executar rotinas confirmadas","Guardar preferências locais"]},
    {id:"youtube",name:"YouTube",version:"1.2.0",category:"Vídeo",summary:"Busca e controle de reprodução no YouTube.",badge:"updated",functional:true,intentPrefixes:["youtube."],commands:["abrir YouTube","buscar vídeo no YouTube","pausar vídeo"],permissions:["Detectar o aplicativo instalado","Abrir buscas e vídeos","Enviar controles de mídia ao Windows"]},
    {id:"system-monitor",name:"Monitor do Sistema",version:"1.1.0",category:"Sistema",summary:"Telemetria local, diagnósticos e avisos.",badge:"updated",functional:true,intentPrefixes:["monitor.","downloads.","diagnostics."],commands:["status do sistema","diagnóstico","ver downloads"],permissions:["Ler telemetria local","Avisar sobre limites configurados","Consultar Downloads mediante comando"]},
    {id:"clock",name:"Relógio e Alarmes",version:"1.2.0",category:"Produtividade",summary:"Alarmes, temporizadores e lembretes.",badge:"updated",functional:true,intentPrefixes:["alarm.","timer.","reminder."],commands:["alarme para 8 horas","temporizador de 10 minutos"],permissions:["Salvar horários localmente","Mostrar notificações","Tocar e interromper alarmes"]},
    {id:"routines",name:"Rotinas Inteligentes",version:"1.0.0",category:"Automação",summary:"Sequências personalizadas de ações da Maia.",badge:"new",functional:true,intentPrefixes:["routine."],commands:["modo trabalho","modo jogo","modo noite"],permissions:["Salvar rotinas localmente","Abrir aplicativos incluídos","Alterar volume e modos após comando"]}
    ,{id:"themes",name:"Temas e Efeitos",version:"2.5.0",category:"Personalização",summary:"61 temas sincronizados com a Horizon e modos Normal e Economia.",badge:"updated",functional:true,intentPrefixes:["visual."],commands:["abrir temas","prévia do tema","modo padrão","tema automático","modo economia","modo normal"],permissions:["Salvar o tema escolhido localmente","Alterar cores da Horizon e do botão flutuante","Reduzir animações no modo Economia"]}
    ,{id:"maia-connect",name:"Maia Connect",version:"2.4.0",category:"Conectividade",summary:"Web app móvel em escala 1× no iPhone, texto como padrão e voz protegida no Android.",badge:"updated",functional:true,intentPrefixes:["connect."],commands:["ativar Maia Connect","status do Maia Connect","renovar código de pareamento","desativar Maia Connect"],permissions:["Abrir uma porta somente quando ativado","Receber comandos de celulares pareados","Controlar mídia, rotinas, temas e sistema com confirmações","Transferir arquivos dentro dos limites informados"]}
    ,{id:"home-assistant",name:"Home Assistant",version:"1.0.0",category:"Casa Inteligente",summary:"Controle real de entidades, cenas e automações do Home Assistant.",badge:"new",functional:true,intentPrefixes:["smart.home.","homeassistant."],commands:["ligar luz da sala","desligar tomada","executar modo cinema","abrir persiana"],permissions:["Conectar ao Home Assistant configurado","Consultar estados de entidades","Executar somente serviços permitidos"]}
    ,{id:"weather-traffic",name:"Clima e Trânsito",version:"1.0.0",category:"Mobilidade",summary:"Previsão de sete dias e rotas com trânsito ao vivo.",badge:"new",functional:true,intentPrefixes:["weather.","traffic.","location."],commands:["previsão para a semana","vai chover hoje","rota para o centro"],permissions:["Consultar Open-Meteo","Consultar Google Routes com chave pessoal","Salvar cidade e origem localmente"]}
    ,{id:"theme-cursor",name:"Cursor Temático",version:"1.0.0",category:"Personalização",summary:"Cursor exclusivo que acompanha automaticamente as cores de cada tema da Horizon.",badge:"new",functional:true,intentPrefixes:[],commands:[],permissions:["Alterar apenas o cursor dentro da interface Maia","Ler a paleta do tema ativo"]}
  ];
  let extensionCatalog20 = extensionFallback20.map(extension => ({...extension}));
  function extensionEnabled20(id){
    return !state.preferences.disabledExtensions.includes(id);
  }
  function extensionForIntent20(intent){
    const value = String(intent || "");
    const catalog = extensionCatalog20.length ? extensionCatalog20 : [
      {id:"windows-core", intentPrefixes:["system.","volume.","window.","clipboard.","screenshot.","brightness."]},
      {id:"spotify", intentPrefixes:["spotify."]},
      {id:"streaming", intentPrefixes:["streaming."]},
      {id:"voice", intentPrefixes:["speech."]},
      {id:"productivity", intentPrefixes:["reminder.","alarm.","timer.","schedule.","agenda.","memory.","task.","focus."]},
      {id:"youtube", intentPrefixes:["youtube."]},
      {id:"home-assistant", intentPrefixes:["smart.home.","homeassistant."]},
      {id:"weather-traffic", intentPrefixes:["weather.","traffic.","location."]},
      {id:"system-monitor", intentPrefixes:["monitor.","downloads.","diagnostics."]},
      {id:"clock", intentPrefixes:["alarm.","timer.","reminder."]}
    ];
    return catalog.find(extension => (extension.intentPrefixes || []).some(prefix => value.startsWith(prefix)));
  }
  function showExtensionDetails20(){
    const extension = extensionCatalog20.find(item => item.id === brainExtensionSelect.value);
    if(!extension){ brainExtensionDetails.textContent = "Nenhuma extensão selecionada."; return; }
    const enabled = extensionEnabled20(extension.id);
    brainExtensionDetails.textContent = [
      extension.name + " • versão " + extension.version,
      "Estado: " + (enabled ? "ATIVA" : "DESATIVADA"),
      "Categoria: " + (extension.category || "Sistema"),
      extension.summary || "",
      "",
      "Permissões:",
      ...(extension.permissions || []).map(permission => "• " + permission),
      ...(extension.changes && extension.changes.length ? ["", "Novidades:", ...extension.changes.map(change => "• " + change)] : [])
    ].join("\n");
    document.getElementById("brainExtensionToggle").textContent = enabled ? "DESATIVAR" : "ATIVAR";
    brainExtensionGrid.querySelectorAll(".extension-card").forEach(card => card.classList.toggle("selected", card.dataset.extensionId === extension.id));
  }
  async function renderExtensions20(refreshCatalog = true){
    const draw = () => {
      const functional = extensionCatalog20.filter(extension => extension.functional !== false);
      const current = brainExtensionSelect.value;
      const query = String(brainExtensionSearch.value || "").toLowerCase().trim();
      const filter = brainExtensionFilter.value;
      const visible = functional.filter(extension => {
        const enabled = extensionEnabled20(extension.id);
        if(filter === "active" && !enabled) return false;
        if(filter === "disabled" && enabled) return false;
        if(filter === "new" && !extension.badge) return false;
        const haystack = [extension.name,extension.summary,extension.category,...(extension.commands || []),...(extension.permissions || [])].join(" ").toLowerCase();
        return !query || haystack.includes(query);
      });
      brainExtensionSelect.innerHTML = functional.map(extension => `<option value="${extension.id}">${extension.name}</option>`).join("");
      brainExtensionSelect.value = functional.some(extension => extension.id === current) ? current : (visible[0] && visible[0].id || functional[0] && functional[0].id || "");
      brainExtensionSummary.innerHTML = `<span>${functional.length} INSTALADAS</span><span class="active">${functional.filter(extension => extensionEnabled20(extension.id)).length} ATIVAS</span><span>${functional.filter(extension => extension.badge).length} NOVIDADES</span>`;
      brainExtensionGrid.innerHTML = visible.map(extension => {
        const enabled = extensionEnabled20(extension.id);
        const badge = extension.badge ? `<span class="extension-badge ${extension.badge}">${extension.badge === "new" ? "NOVA" : "ATUALIZADA"}</span>` : "";
        return `<button class="extension-card ${enabled ? "" : "disabled"}" data-extension-id="${extension.id}"><span class="extension-card-head"><strong>${extension.name}</strong>${badge}</span><p>${extension.summary || extension.category || "Extensão oficial da Maia"}</p><span class="extension-card-state">${enabled ? "● ATIVA" : "○ DESATIVADA"} • v${extension.version}</span></button>`;
      }).join("") || `<div class="brain-info">Nenhuma extensão encontrada com esses filtros.</div>`;
      brainExtensionGrid.querySelectorAll(".extension-card").forEach(card => card.addEventListener("click", () => {
        brainExtensionSelect.value = card.dataset.extensionId;
        showExtensionDetails20();
      }));
      showExtensionDetails20();
    };
    draw();
    if(refreshCatalog){
      try{
        const response = await callBridge("integration.status");
        const received = response && response.result && response.result.extensions || [];
        if(received.length) extensionCatalog20 = received.filter(extension => extension && extension.id && extension.functional !== false);
      }catch(err){}
    }
    draw();
  }

  let setupStep20 = 0;
  function showSetupStep20(step){
    setupStep20 = Math.max(0, Math.min(2, Number(step) || 0));
    setupWizard.querySelectorAll(".setup-step").forEach((element, index) => element.classList.toggle("active", index === setupStep20));
    setupWizard.querySelectorAll(".setup-progress span").forEach((element, index) => element.classList.toggle("active", index <= setupStep20));
    document.getElementById("setupBack").style.visibility = setupStep20 ? "visible" : "hidden";
    document.getElementById("setupNext").textContent = setupStep20 === 2 ? "CONCLUIR" : "CONTINUAR";
  }

  function openSetupWizard20(){
    document.getElementById("setupOwner").value = state.preferences.ownerName === "senhor" ? "" : state.preferences.ownerName || "";
    document.getElementById("setupCity").value = state.preferences.city || "";
    document.getElementById("setupTreatment").value = state.preferences.treatment || "senhor";
    document.getElementById("setupSpeech").value = state.preferences.speechMode || "formal";
    document.getElementById("setupWake").value = getWakeWords().join(", ");
    document.getElementById("setupMic").value = state.preferences.micSensitivity || 55;
    document.getElementById("setupRate").value = state.preferences.voiceRate || 100;
    showSetupStep20(0);
    setupWizard.classList.add("open");
    setupWizard.setAttribute("aria-hidden", "false");
  }

  function completeSetupWizard20(){
    const owner = document.getElementById("setupOwner").value.trim();
    const city = document.getElementById("setupCity").value.trim();
    if(owner) state.preferences.ownerName = owner;
    if(city) state.preferences.city = city;
    state.preferences.treatment = document.getElementById("setupTreatment").value;
    state.preferences.speechMode = document.getElementById("setupSpeech").value;
    state.speechMode = state.preferences.speechMode;
    state.preferences.wakeWords = sanitizeWakeWords(document.getElementById("setupWake").value);
    state.preferences.micSensitivity = Number(document.getElementById("setupMic").value) || 55;
    state.preferences.voiceRate = Number(document.getElementById("setupRate").value) || 100;
    localStorage.setItem("Maia.onboarding.completed", "1");
    saveMemory();
    setupWizard.classList.remove("open");
    setupWizard.setAttribute("aria-hidden", "true");
    speak("Configuração concluída. A Maia está pronta.");
  }

  const baseThemeSurfaces20 = {
    classic:{soft:"#e6fbff",dim:"#4b8492",bg1:"#0a3442",bg2:"#020d13"},
    iron:{soft:"#ffe7e2",dim:"#984940",bg1:"#501813",bg2:"#170504"},
    neon:{soft:"#e2ffec",dim:"#2e8b57",bg1:"#0b4827",bg2:"#03150b"},
    arctic:{soft:"#effcff",dim:"#56899b",bg1:"#17475d",bg2:"#06131e"},
    violet:{soft:"#f3eaff",dim:"#76539b",bg1:"#34175a",bg2:"#0e061b"},
    solar:{soft:"#fff2ca",dim:"#9a6c2e",bg1:"#57300e",bg2:"#1b0a03"},
    ocean:{soft:"#e0f9ff",dim:"#377b96",bg1:"#0b405c",bg2:"#03131f"},
    minimal:{soft:"#f4f7f8",dim:"#77858d",bg1:"#293238",bg2:"#090d10"},
    rose:{soft:"#ffe9f6",dim:"#9d527c",bg1:"#501b3b",bg2:"#170710"},
    blush:{soft:"#fff0f8",dim:"#9c607f",bg1:"#4b243b",bg2:"#160a12"},
    lavender:{soft:"#f5efff",dim:"#775d9b",bg1:"#38245c",bg2:"#10091b"},
    sakura:{soft:"#fff2f6",dim:"#a36072",bg1:"#512433",bg2:"#180a0f"},
    pinkpearl:{soft:"#fff8fb",dim:"#9b7484",bg1:"#46313a",bg2:"#130d11"},
    champagne:{soft:"#fff6e8",dim:"#92704b",bg1:"#4c3521",bg2:"#160d06"},
    starlight:{soft:"#eaebff",dim:"#555d9d",bg1:"#20275d",bg2:"#07091d"},
    pearl:{soft:"#ffffff",dim:"#75889a",bg1:"#334452",bg2:"#0b1117"},
    bluefire:{soft:"#e0f7ff",dim:"#3374a4",bg1:"#073f70",bg2:"#021425"},
    quantum:{soft:"#dcffff",dim:"#23838b",bg1:"#073a45",bg2:"#020f16"},
    hologram:{soft:"#e4fffc",dim:"#318b86",bg1:"#0a4142",bg2:"#021515"},
    eclipse:{soft:"#fff5d5",dim:"#927336",bg1:"#3f3010",bg2:"#120b03"},
    royal:{soft:"#ffffff",dim:"#6d879e",bg1:"#33485d",bg2:"#0b1118"},
    venus:{soft:"#ffe8f5",dim:"#9c4f78",bg1:"#5b123c",bg2:"#190510"},
    silk:{soft:"#fff1fb",dim:"#946f8d",bg1:"#50304d",bg2:"#150c16"}
  };
  const newThemeDefinitions20 = {
    plasma:{core:0x19f5d2,key:0x0fd0ba,rim:0xff5cc8,halo:.8,cyan:"#19f5d2",soft:"#d9fff8",dim:"#14786d",amber:"#ff5cc8",bg1:"#063d3a",bg2:"#031515"},
    cyber:{core:0xff3dbb,key:0xdc269f,rim:0x35e8ff,halo:.83,cyan:"#ff3dbb",soft:"#ffe0f6",dim:"#872361",amber:"#35e8ff",bg1:"#4b0a38",bg2:"#180513"},
    ion:{core:0x9b6cff,key:0x7948e8,rim:0x43ffd1,halo:.81,cyan:"#9b6cff",soft:"#eee6ff",dim:"#50358e",amber:"#43ffd1",bg1:"#2b1857",bg2:"#0e0821"},
    nebula:{core:0x6d7dff,key:0x5362df,rim:0xff6fb7,halo:.78,cyan:"#6d7dff",soft:"#e5e8ff",dim:"#394285",amber:"#ff6fb7",bg1:"#222856",bg2:"#0b0d21"},
    matrixgreen:{core:0x39ff71,key:0x1fd957,rim:0xb7ff35,halo:.72,cyan:"#39ff71",soft:"#ddffe6",dim:"#1c7d39",amber:"#b7ff35",bg1:"#0a3c1a",bg2:"#031408"},
    singularity:{core:0xa86bff,key:0x6f35c8,rim:0xf0d8ff,halo:.92,cyan:"#a86bff",soft:"#f4eaff",dim:"#59368a",amber:"#f0d8ff",bg1:"#2b104d",bg2:"#08020f"},
    obsidian:{core:0x8da0b7,key:0x68798d,rim:0xf0b95e,halo:.57,cyan:"#8da0b7",soft:"#e7edf3",dim:"#485463",amber:"#f0b95e",bg1:"#20262d",bg2:"#080a0d"},
    sapphire:{core:0x347cff,key:0x225dd1,rim:0xa9d4ff,halo:.76,cyan:"#347cff",soft:"#dfebff",dim:"#234b8b",amber:"#a9d4ff",bg1:"#0b285d",bg2:"#030b1b"},
    emeraldlux:{core:0x28d99a,key:0x17ad78,rim:0xe0c56e,halo:.73,cyan:"#28d99a",soft:"#ddfff3",dim:"#1f7257",amber:"#e0c56e",bg1:"#0a3b2c",bg2:"#03130e"},
    bronze:{core:0xd48a4a,key:0xb16731,rim:0xffd18a,halo:.7,cyan:"#d48a4a",soft:"#ffead8",dim:"#754929",amber:"#ffd18a",bg1:"#442711",bg2:"#160c05"},
    noir:{core:0xe5e7eb,key:0x9ca3af,rim:0xffffff,halo:.54,cyan:"#e5e7eb",soft:"#ffffff",dim:"#6b7280",amber:"#ffffff",bg1:"#17191d",bg2:"#030304"},
    coral:{core:0xff806e,key:0xeb6256,rim:0x72f0db,halo:.76,cyan:"#ff806e",soft:"#ffe7e2",dim:"#91453d",amber:"#72f0db",bg1:"#4a1d19",bg2:"#170807"},
    lilacmist:{core:0xd0a2ff,key:0xb57ce8,rim:0x8de9ff,halo:.72,cyan:"#d0a2ff",soft:"#f5eaff",dim:"#71558e",amber:"#8de9ff",bg1:"#38234d",bg2:"#120a1c"},
    moonrose:{core:0xed91bd,key:0xd16c9d,rim:0xd8dcff,halo:.75,cyan:"#ed91bd",soft:"#ffe7f2",dim:"#824d68",amber:"#d8dcff",bg1:"#482139",bg2:"#170a13"},
    serenity:{core:0x78b8e8,key:0x5d99c8,rim:0xc4ffe7,halo:.65,cyan:"#78b8e8",soft:"#e5f4ff",dim:"#426985",amber:"#c4ffe7",bg1:"#16364e",bg2:"#07131d"},
    pinkaurora:{core:0xff91df,key:0xd96ec0,rim:0x75ffe7,halo:.88,cyan:"#ff91df",soft:"#ffe9fa",dim:"#8e4b7e",amber:"#75ffe7",bg1:"#512044",bg2:"#13091c"},
    forest:{core:0x42c979,key:0x279e59,rim:0xb2e65c,halo:.68,cyan:"#42c979",soft:"#e2ffeb",dim:"#286f47",amber:"#b2e65c",bg1:"#123d26",bg2:"#05150c"},
    volcano:{core:0xff6338,key:0xdf3d22,rim:0xffbd3f,halo:.85,cyan:"#ff6338",soft:"#ffe5dc",dim:"#8c3525",amber:"#ffbd3f",bg1:"#55170c",bg2:"#1b0502"},
    glacier:{core:0xa7ecff,key:0x70cde8,rim:0xe8f8ff,halo:.64,cyan:"#a7ecff",soft:"#f4fdff",dim:"#56808e",amber:"#e8f8ff",bg1:"#214351",bg2:"#09151b"},
    storm:{core:0x4f91bd,key:0x36759e,rim:0xb9d1ff,halo:.69,cyan:"#4f91bd",soft:"#e1f2ff",dim:"#31576e",amber:"#b9d1ff",bg1:"#173247",bg2:"#071019"},
    desert:{core:0xe6aa55,key:0xc88436,rim:0xffe09b,halo:.71,cyan:"#e6aa55",soft:"#fff0d8",dim:"#7d5c32",amber:"#ffe09b",bg1:"#4b3215",bg2:"#170f06"},
    lagoon:{core:0x22e6bf,key:0x10b99e,rim:0x70a8ff,halo:.8,cyan:"#22e6bf",soft:"#dcfff8",dim:"#197763",amber:"#70a8ff",bg1:"#07483f",bg2:"#031817"},
    thunder:{core:0x80c8ff,key:0x4da2e5,rim:0xa077ff,halo:.9,cyan:"#80c8ff",soft:"#e8f6ff",dim:"#47708c",amber:"#a077ff",bg1:"#183a58",bg2:"#080b1c"},
    wildfire:{core:0xff5b21,key:0xe13b12,rim:0xffd23f,halo:.91,cyan:"#ff5b21",soft:"#ffe4d9",dim:"#8b3019",amber:"#ffd23f",bg1:"#5a1606",bg2:"#1d0501"},
    mars:{core:0xd9684a,key:0xb84a34,rim:0xf3b56c,halo:.72,cyan:"#d9684a",soft:"#ffe6df",dim:"#773b2f",amber:"#f3b56c",bg1:"#462016",bg2:"#150806"},
    saturn:{core:0xd8bd83,key:0xb69962,rim:0x8ba9d9,halo:.69,cyan:"#d8bd83",soft:"#fff3d9",dim:"#776846",amber:"#8ba9d9",bg1:"#40351e",bg2:"#12100a"},
    galaxy:{core:0x6657d9,key:0x4c3dbb,rim:0xe06acb,halo:.82,cyan:"#6657d9",soft:"#e8e5ff",dim:"#3d3578",amber:"#e06acb",bg1:"#211754",bg2:"#09051b"},
    supernova:{core:0xffb347,key:0xff7b32,rim:0xff4d8d,halo:.95,cyan:"#ffb347",soft:"#fff0d8",dim:"#925f2a",amber:"#ff4d8d",bg1:"#5b2509",bg2:"#1b050c"},
    blackhole:{core:0x716b91,key:0x514b72,rim:0xd19cff,halo:.48,cyan:"#716b91",soft:"#dedbea",dim:"#423e57",amber:"#d19cff",bg1:"#171326",bg2:"#010103"},
    comet:{core:0xc6f4ff,key:0x8edcf0,rim:0xffd0a1,halo:.77,cyan:"#c6f4ff",soft:"#ffffff",dim:"#65818a",amber:"#ffd0a1",bg1:"#253e4b",bg2:"#091119"},
    pulsar:{core:0x50e8ff,key:0x28bcd5,rim:0xff74d6,halo:.94,cyan:"#50e8ff",soft:"#e2fbff",dim:"#287989",amber:"#ff74d6",bg1:"#0a4051",bg2:"#08091e"},
    eventhorizon:{core:0xff7a32,key:0xd94b21,rim:0x8b5cff,halo:.96,cyan:"#ff7a32",soft:"#ffe6d8",dim:"#8c4228",amber:"#8b5cff",bg1:"#4d1608",bg2:"#020105"},
    synthwave:{core:0xff4fbc,key:0xd52d9b,rim:0x36d9ff,halo:.84,cyan:"#ff4fbc",soft:"#ffe2f6",dim:"#8b2c68",amber:"#36d9ff",bg1:"#4f0c3c",bg2:"#13051f"},
    arcade:{core:0x46ff66,key:0x28dc45,rim:0xffe34d,halo:.76,cyan:"#46ff66",soft:"#e0ffe5",dim:"#247b35",amber:"#ffe34d",bg1:"#0b3e17",bg2:"#041208"},
    amberterminal:{core:0xffb52e,key:0xd88d15,rim:0xffe08a,halo:.64,cyan:"#ffb52e",soft:"#fff0cf",dim:"#8b611f",amber:"#ffe08a",bg1:"#412805",bg2:"#120b02"},
    vaporwave:{core:0xd675ff,key:0xb751df,rim:0x62e4ff,halo:.81,cyan:"#d675ff",soft:"#f6e5ff",dim:"#75428b",amber:"#62e4ff",bg1:"#421b59",bg2:"#10102b"},
    lasergrid:{core:0x39ff8a,key:0x1ed668,rim:0xff3fcf,halo:.91,cyan:"#39ff8a",soft:"#dcffe9",dim:"#207c4a",amber:"#ff3fcf",bg1:"#063d21",bg2:"#13051d"},
    chroma:{core:0x31e8ff,key:0xff355e,rim:0xffe33d,halo:.94,cyan:"#31e8ff",soft:"#e0fbff",dim:"#267784",amber:"#ff355e",bg1:"#202052",bg2:"#130619"}
  };
  const baseThemeIds20 = ["classic", "iron", "neon", "arctic", "violet", "solar", "ocean", "minimal", "rose", "blush", "lavender", "sakura", "pinkpearl", "champagne", "starlight", "pearl", "bluefire", "quantum", "hologram", "eclipse", "royal", "venus", "silk"];
  function applyTheme20(theme){
    const selected = [...baseThemeIds20, ...Object.keys(newThemeDefinitions20)].includes(theme) ? theme : "classic";
    const palette = themePalette20(selected);
    const definition = newThemeDefinitions20[selected];
    state.preferences.theme = selected;
    state.preferences.backgroundColor = "";
    document.body.dataset.theme = selected;
    for(const property of ["--cyan","--cyan-soft","--cyan-dim","--amber","--panel","--panel-2","--panel-border","--panel-border-strong","--scene-bg","--vignette-edge"]) document.body.style.removeProperty(property);
    if(definition){
      document.body.style.setProperty("--cyan", definition.cyan);
      document.body.style.setProperty("--cyan-soft", definition.soft);
      document.body.style.setProperty("--cyan-dim", definition.dim);
      document.body.style.setProperty("--amber", definition.amber);
      document.body.style.setProperty("--panel", "color-mix(in srgb, " + definition.bg1 + " 68%, transparent)");
      document.body.style.setProperty("--panel-2", "color-mix(in srgb, " + definition.bg2 + " 92%, black)");
      document.body.style.setProperty("--panel-border", "color-mix(in srgb, " + definition.cyan + " 28%, transparent)");
      document.body.style.setProperty("--panel-border-strong", "color-mix(in srgb, " + definition.amber + " 48%, transparent)");
      document.body.style.setProperty("--scene-bg", "radial-gradient(circle at 50% 45%," + definition.bg1 + " 0%," + definition.bg2 + " 44%,#000 86%)");
      document.body.style.setProperty("--vignette-edge", definition.bg2);
    }
    document.title = "MAIA::THEME::" + selected;
    document.getElementById("scene").style.removeProperty("background");
    if(brainTheme) brainTheme.value = selected;
    if(state.visualMode === "default" && window.nucleo && window.nucleo.setPalette) window.nucleo.setPalette(palette, "default");
    postModern20({type:"maia-interface-theme",data:horizonThemePayload20(selected)});
    saveMemory();
  }

  function themePalette20(theme){
    const palettes = {
      classic:{core:0x5be6ff,key:0x5be6ff,rim:0xffb454,halo:.72},
      iron:{core:0xff5f52,key:0xff6b5f,rim:0xffc857,halo:.76},
      neon:{core:0x4dff9a,key:0x4dff9a,rim:0xd96cff,halo:.72},
      arctic:{core:0x8eeeff,key:0x8eeeff,rim:0xb8d4ff,halo:.68},
      violet:{core:0xc49aff,key:0xc49aff,rim:0xff8bd8,halo:.76},
      solar:{core:0xffd166,key:0xffc24d,rim:0xff7a45,halo:.8},
      ocean:{core:0x58d9ff,key:0x58d9ff,rim:0x43f0d0,halo:.7},
      minimal:{core:0xaeddea,key:0x7ec7da,rim:0xcbd7dc,halo:.5},
      rose:{core:0xff8fcf,key:0xff79c6,rim:0xffd1ea,halo:.78},
      blush:{core:0xffacd8,key:0xff91ca,rim:0xe6b6ff,halo:.79},
      lavender:{core:0xc8a8ff,key:0xb98cff,rim:0xffbde1,halo:.77},
      sakura:{core:0xffb7c9,key:0xff91ac,rim:0xffcfe8,halo:.78},
      pinkpearl:{core:0xffd3e5,key:0xf7bcd5,rim:0xe8d1ff,halo:.69},
      champagne:{core:0xf6cf9f,key:0xeebd7d,rim:0xf2a9c7,halo:.74},
      starlight:{core:0x858cff,key:0x7b82ff,rim:0xd8a7ff,halo:.77},
      pearl:{core:0xdcecff,key:0xc8ddf5,rim:0xd9c8ff,halo:.62},
      bluefire:{core:0x45bfff,key:0x2eaeff,rim:0x77fff2,halo:.79}
      ,quantum:{core:0x28f7ff,key:0x19dce7,rim:0x8c5cff,halo:.86}
      ,hologram:{core:0x54fff0,key:0x39e4d8,rim:0x62a7ff,halo:.82}
      ,eclipse:{core:0xf4cf72,key:0xeab94c,rim:0xff885c,halo:.85}
      ,royal:{core:0xe9f4ff,key:0xc9e5ff,rim:0xb8dcff,halo:.76}
      ,venus:{core:0xff79bd,key:0xf457a6,rim:0xa98cff,halo:.87}
      ,silk:{core:0xf7b8e5,key:0xdf93cb,rim:0xd9b8ff,halo:.8}
    };
    return newThemeDefinitions20[theme] || palettes[theme] || palettes.classic;
  }
  function horizonThemePayload20(theme){
    const palette=themePalette20(theme);
    const definition=newThemeDefinitions20[theme];
    const surface=definition||baseThemeSurfaces20[theme]||baseThemeSurfaces20.classic;
    const hex=(value)=>"#"+Math.max(0,Number(value)||0).toString(16).padStart(6,"0").slice(-6);
    return {id:theme,primary:definition?.cyan||hex(palette.core),accent:definition?.amber||hex(palette.rim),soft:surface.soft,dim:surface.dim,background:surface.bg2,surface:surface.bg1};
  }

  function applyBackground20(color){
    const selected = /^#[0-9a-f]{6}$/i.test(color) ? color : "#071a24";
    state.preferences.backgroundColor = selected;
    document.getElementById("scene").style.background = "radial-gradient(circle at 50% 47%, " + selected + " 0%, #020507 48%, #000 86%)";
    saveMemory();
  }

  function applyAutomaticTheme20(force = false){
    if(state.preferences.autoTheme !== "time" && !force) return;
    const hour = new Date().getHours();
    const selected = hour < 6 ? "starlight" : hour < 11 ? "solar" : hour < 18 ? "classic" : hour < 22 ? "rose" : "bluefire";
    if(force || state.preferences.theme !== selected) applyTheme20(selected);
  }

  function rememberMedia20(service, title, extra = ""){
    const item = {service, title:String(title || "").trim(), extra:String(extra || "").trim(), at:new Date().toISOString()};
    if(!item.title) return;
    state.preferences.mediaHistory = [item, ...(state.preferences.mediaHistory || []).filter(old => old.service !== item.service || normalize(old.title) !== normalize(item.title))].slice(0, 80);
    saveMemory();
  }

  async function runRoutine20(commands, label){
    const list = Array.isArray(commands) ? commands : String(commands || "").split(";");
    const clean = list.map(item => String(item).trim()).filter(Boolean).slice(0, 8);
    if(!clean.length){ if(brainOutput) brainOutput.textContent = "Rotina vazia."; return; }
    if(brainOutput) brainOutput.textContent = "Executando " + (label || "rotina") + ":\n" + clean.join("\n");
    setBrainPanel(false);
    for(const command of clean) await processCommand(command);
  }

  function renderSavedRoutines20(){
    const selected = brainRoutineSaved.value;
    brainRoutineSaved.innerHTML = '<option value="">Selecione</option>';
    Object.keys(state.routines.saved || {}).sort().forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      brainRoutineSaved.appendChild(option);
    });
    if(state.routines.saved && state.routines.saved[selected]) brainRoutineSaved.value = selected;
  }

  function backupPayload20(){
    return {
      format:"maia-local-backup",
      version:2,
      exportedAt:new Date().toISOString(),
      data:{
        notes:state.notes, tasks:state.tasks, expenses:state.expenses,
        preferences:state.preferences, learnedMemory:state.learnedMemory,
        reminders:state.reminders, routines:state.routines
      }
    };
  }

  function setupCentral20(){
    applyTheme20(state.preferences.theme || "classic");
    if(state.preferences.backgroundColor) applyBackground20(state.preferences.backgroundColor);
    const savedPerformance=localStorage.getItem("Maia.performanceMode") === "economy" ? "economy" : "normal";
    localStorage.setItem("Maia.performanceMode",savedPerformance);
    document.getElementById("brainPerformanceMode").textContent = savedPerformance === "economy" ? "ATIVAR MODO NORMAL" : "ATIVAR MODO ECONOMIA";
    const presets = {
      work:["modo foco", "volume 45", "abrir vs code"],
      game:["modo combate", "volume 70"],
      night:["modo repouso", "volume 25"],
      cinema:["modo repouso", "volume 55", "abrir prime video"],
      presentation:["modo foco", "volume 65"]
    };
    renderSavedRoutines20();
    brainPanel.querySelectorAll("[data-routine]").forEach(button => button.addEventListener("click", () => runRoutine20(presets[button.dataset.routine], button.textContent)));
    document.getElementById("brainConnectEnable").addEventListener("click", () => refreshConnect20(connectStatus20 && connectStatus20.enabled ? "connect.rotateCode" : "connect.enable"));
    document.getElementById("brainConnectRefresh").addEventListener("click", () => refreshConnect20());
    document.getElementById("brainConnectDisable").addEventListener("click", () => refreshConnect20("connect.disable"));
    document.getElementById("brainConnectForget").addEventListener("click", async () => {
      if(!confirm("Revogar o acesso de todos os celulares pareados?")) return;
      await refreshConnect20("connect.forgetDevices");
      brainOutput.textContent = "Todos os celulares foram revogados. Faça um novo pareamento para reconectar.";
    });
    document.getElementById("brainConnectCopy").addEventListener("click", async () => {
      const status = connectStatus20 && connectStatus20.enabled ? connectStatus20 : await refreshConnect20();
      if(!status || !status.enabled){ brainOutput.textContent = "Ative o Maia Connect antes de copiar o acesso."; return; }
      const access = (status.addresses && status.addresses[0] || "") + "\nCódigo: " + status.pairCode;
      try{ await navigator.clipboard.writeText(access); brainOutput.textContent = "Endereço e código do Maia Connect copiados."; }
      catch(err){ brainOutput.textContent = access; }
    });
    document.getElementById("brainTreatmentApply").addEventListener("click", () => {
      state.preferences.treatment = brainTreatment.value;
      saveMemory();
      brainOutput.textContent = "Tratamento atualizado para: " + brainTreatment.options[brainTreatment.selectedIndex].textContent + ".";
      speak("Preferência de tratamento atualizada.");
    });
    brainExtensionSearch.addEventListener("input", () => renderExtensions20(false));
    brainExtensionFilter.addEventListener("change", () => renderExtensions20(false));
    document.getElementById("brainExtensionCommands").addEventListener("click", () => {
      const extension = extensionCatalog20.find(item => item.id === brainExtensionSelect.value);
      brainExtensionDetails.textContent = extension && extension.commands && extension.commands.length
        ? extension.name + " • COMANDOS\n" + extension.commands.map(command => "• " + command).join("\n")
        : "Esta extensão não possui exemplos de comandos cadastrados.";
    });
    document.getElementById("brainExtensionToggle").addEventListener("click", () => {
      const id = brainExtensionSelect.value;
      if(!id) return;
      if(extensionEnabled20(id)) state.preferences.disabledExtensions.push(id);
      else state.preferences.disabledExtensions = state.preferences.disabledExtensions.filter(item => item !== id);
      saveMemory();
      renderExtensions20();
    });
    document.getElementById("brainRoutineActionAdd").addEventListener("click", () => {
      const action = document.getElementById("brainRoutineAction").value;
      if(!action){ brainOutput.textContent = "Escolha uma ação para adicionar à rotina."; return; }
      const current = brainRoutine.value.split(";").map(item => item.trim()).filter(Boolean);
      if(!current.includes(action)) current.push(action);
      brainRoutine.value = current.join("; ");
      brainOutput.textContent = "Ação adicionada: " + action + ".";
    });
    document.getElementById("brainRoutineRun").addEventListener("click", () => {
      const commands = brainRoutine.value.split(";").map(item => item.trim()).filter(Boolean);
      if(commands.length) state.routines.last = commands;
      saveMemory();
      runRoutine20(commands, "rotina personalizada");
    });
    document.getElementById("brainRoutineSave").addEventListener("click", () => {
      const name = brainRoutineName.value.trim();
      const commands = brainRoutine.value.split(";").map(item => item.trim()).filter(Boolean).slice(0, 12);
      if(!name || !commands.length){ brainOutput.textContent = "Informe o nome e os comandos da rotina."; return; }
      state.routines.saved[name] = commands;
      saveMemory();
      renderSavedRoutines20();
      brainRoutineSaved.value = name;
      brainOutput.textContent = "Rotina " + name + " salva localmente.";
    });
    brainRoutineSaved.addEventListener("change", () => {
      const commands = state.routines.saved[brainRoutineSaved.value];
      if(commands){ brainRoutineName.value = brainRoutineSaved.value; brainRoutine.value = commands.join("; "); }
    });
    document.getElementById("brainRoutineDelete").addEventListener("click", () => {
      const name = brainRoutineSaved.value;
      if(!name){ brainOutput.textContent = "Selecione uma rotina salva."; return; }
      delete state.routines.saved[name];
      saveMemory();
      renderSavedRoutines20();
      brainOutput.textContent = "Rotina removida.";
    });
    document.getElementById("brainThemeApply").addEventListener("click", () => {
      applyTheme20(brainTheme.value);
      brainOutput.textContent = "Tema aplicado e salvo localmente.";
    });
    document.getElementById("brainBackgroundApply").addEventListener("click", () => {
      applyBackground20(brainBackground.value);
      brainOutput.textContent = "Cor de fundo personalizada aplicada sem aumentar o custo da animação.";
    });
    document.getElementById("brainQualityApply").addEventListener("click", () => {
      const result = window.nucleo && window.nucleo.setQuality ? window.nucleo.setQuality(brainQuality.value) : null;
      brainOutput.textContent = result ? "Qualidade " + result.selected + ". Nível atual: " + result.effective + ", com " + result.particles + " partículas." : "Controle visual indisponível.";
    });
    document.getElementById("brainIntensityApply").addEventListener("click", () => {
      const result = window.nucleo && window.nucleo.setIntensity ? window.nucleo.setIntensity(Number(brainIntensity.value) / 100) : null;
      brainOutput.textContent = result ? "Intensidade visual em " + Math.round(Number(brainIntensity.value)) + "%. FPS continua desbloqueado." : "Controle visual indisponível.";
    });
    document.getElementById("brainAutoThemeApply").addEventListener("click", () => {
      state.preferences.autoTheme = brainAutoTheme.value;
      saveMemory();
      if(state.preferences.autoTheme === "time") applyAutomaticTheme20(true);
      brainOutput.textContent = state.preferences.autoTheme === "time" ? "Tema automático por horário ativado." : "Tema automático desligado.";
    });
    document.getElementById("brainPerformanceMode").addEventListener("click", () => {
      const mode = localStorage.getItem("Maia.performanceMode") === "economy" ? "normal" : "economy";
      localStorage.setItem("Maia.performanceMode",mode);
      document.getElementById("brainPerformanceMode").textContent = mode === "economy" ? "ATIVAR MODO NORMAL" : "ATIVAR MODO ECONOMIA";
      postModern20({type:"maia-interface-performance",mode});
      brainOutput.textContent = mode === "economy"
        ? "Modo Economia ativo: animações contínuas reduzidas, mantendo transições rápidas e todas as funções."
        : "Modo Normal ativo: animações cinematográficas e temas completos.";
    });
    document.getElementById("brainVisualPreview").addEventListener("click", async () => {
      const original = state.preferences.theme || "classic";
      for(const theme of [...baseThemeIds20, ...Object.keys(newThemeDefinitions20)]){
        applyTheme20(theme);
        await new Promise(resolve => setTimeout(resolve, 450));
      }
      applyTheme20(original);
      brainOutput.textContent = "Prévia concluída. Tema anterior restaurado.";
    });
    document.getElementById("brainVoiceApply").addEventListener("click", () => {
      state.preferences.voiceRate = Math.max(60, Math.min(140, Number(brainVoiceRate.value) || 100));
      saveMemory();
      brainOutput.textContent = "Velocidade da voz: " + state.preferences.voiceRate + "%.";
    });
    document.getElementById("brainVoiceNameApply").addEventListener("click", () => {
      state.preferences.voiceName = brainVoiceName.value || "";
      cachedSpeechVoice = null;
      saveMemory();
      brainOutput.textContent = state.preferences.voiceName ? "Voz selecionada: " + state.preferences.voiceName + "." : "Seleção automática de voz restaurada.";
      speak("Esta é a voz selecionada para a Maia.");
    });
    document.getElementById("brainDisplayApply").addEventListener("click", async () => {
      if(!window.maiaDesktop){ brainOutput.textContent = "Controle de monitores indisponível."; return; }
      const result = await window.maiaDesktop.moveToDisplay(brainDisplay.value);
      if(result && result.ok){
        state.preferences.displayId = result.id;
        saveMemory();
        brainOutput.textContent = "Maia movida para o monitor selecionado.";
      }
    });
    document.getElementById("brainSilentToggle").addEventListener("click", () => {
      state.preferences.silentMode = !state.preferences.silentMode;
      saveMemory();
      brainOutput.textContent = state.preferences.silentMode ? "Modo silencioso ativo: respostas apenas na interface." : "Modo silencioso desativado.";
    });
    document.getElementById("brainStopSpeech").addEventListener("click", () => {
      if(window.speechSynthesis) window.speechSynthesis.cancel();
      window.__maiaSpeaking = false;
      setVisualState("idle");
      brainOutput.textContent = "Fala interrompida.";
    });
    document.getElementById("brainMemoryView").addEventListener("click", () => {
      const facts = (state.learnedMemory.facts || []).slice(0, 20);
      brainOutput.textContent = [
        "Nome: " + (state.preferences.ownerName || "não informado"),
        "Cidade: " + (state.preferences.city || "não informada"),
        "Fatos: " + (facts.length ? facts.map(item => item.text || item.key || String(item)).join(" • ") : "nenhum"),
        "Notas: " + state.notes.length,
        "Tarefas: " + state.tasks.length,
        "Lembretes: " + state.reminders.length
      ].join("\n");
    });
    document.getElementById("brainHistoryView").addEventListener("click", () => {
      brainOutput.textContent = state.commandHistory.length
        ? state.commandHistory.slice(0, 20).map(item => new Date(item.at).toLocaleString("pt-BR") + " — " + item.text + " [" + item.intent + "]").join("\n")
        : "Nenhum comando no histórico.";
    });
    let eraseAllArmedUntil = 0;
    document.getElementById("brainEraseAll").addEventListener("click", () => {
      if(Date.now() > eraseAllArmedUntil){
        eraseAllArmedUntil = Date.now() + 10000;
        brainOutput.textContent = "Confirmação necessária: clique novamente em APAGAR TODOS OS DADOS dentro de 10 segundos.";
        return;
      }
      const preserved = {
        theme:state.preferences.theme,
        backgroundColor:state.preferences.backgroundColor,
        voiceName:state.preferences.voiceName,
        voiceRate:state.preferences.voiceRate
      };
      ["Maia.voice.notes","Maia.voice.tasks","Maia.voice.expenses","Maia.voice.preferences","Maia.voice.learnedMemory","Maia.voice.reminders","Maia.voice.history","Maia.voice.routines","Maia.voice.errors","maia.kernel.context"].forEach(key => localStorage.removeItem(key));
      state.notes = []; state.tasks = []; state.expenses = []; state.reminders = []; state.commandHistory = []; state.errorLog = [];
      state.routines = {saved:{}};
      state.learnedMemory = {assistantName:"Maia", facts:[], customCommands:[], capabilities:[]};
      state.preferences = {ownerName:"senhor", preferredVolume:50, favoriteApps:[], frequentMusics:[], commonHours:{}, ...preserved};
      saveMemory();
      eraseAllArmedUntil = 0;
      brainOutput.textContent = "Dados pessoais, memórias, histórico, erros e rotinas foram apagados. Preferências visuais e de voz foram preservadas.";
    });
    document.getElementById("brainClearHistory").addEventListener("click", () => {
      state.commandHistory = [];
      saveMemory();
      brainOutput.textContent = "Histórico local apagado.";
    });
    document.getElementById("brainForgetApply").addEventListener("click", () => {
      const query = normalize(document.getElementById("brainForget").value);
      if(!query){ brainOutput.textContent = "Informe qual memória deseja apagar."; return; }
      const before = (state.learnedMemory.facts || []).length;
      state.learnedMemory.facts = (state.learnedMemory.facts || []).filter(item => !normalize((item.text || "") + " " + (item.key || "")).includes(query));
      saveMemory();
      brainOutput.textContent = before === state.learnedMemory.facts.length ? "Nenhuma memória correspondente encontrada." : "Memória removida localmente.";
    });
    const commandCatalog = [
      "tocar música no Spotify","tocar playlist no Spotify","próxima música","música anterior","ativar aleatório","desativar aleatório","repetir esta música","repetir playlist","desativar repetição","favoritar música atual",
      "tocar no YouTube","voltar à música anterior","o que tocou hoje","modo foco","modo combate","modo repouso","modo normal","modo economia","tema automático","minha memória","esqueça que","criar tarefa","criar lembrete","abrir programa","status da internet"
    ];
    document.getElementById("brainCommandSearchApply").addEventListener("click", () => {
      const query = normalize(document.getElementById("brainCommandSearch").value);
      const found = commandCatalog.filter(item => !query || normalize(item).includes(query));
      brainOutput.textContent = found.length ? "COMANDOS ENCONTRADOS\n• " + found.join("\n• ") : "Nenhum comando encontrado para essa busca.";
    });
    document.getElementById("brainCommandTestApply").addEventListener("click", async () => {
      const command = document.getElementById("brainCommandTest").value.trim();
      if(!command){ brainOutput.textContent = "Digite um comando para testar."; return; }
      setBrainPanel(false);
      await processCommand(command);
    });
    document.getElementById("brainBackupExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(backupPayload20(), null, 2)], {type:"application/json"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Maia-Backup-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      brainOutput.textContent = "Backup local exportado.";
    });
    document.getElementById("brainBackupImport").addEventListener("click", () => brainBackupFile.click());
    brainBackupFile.addEventListener("change", async () => {
      try{
        const parsed = JSON.parse(await brainBackupFile.files[0].text());
        if(parsed.format !== "maia-local-backup" || !parsed.data) throw new Error("arquivo incompatível");
        const data = parsed.data;
        if(Array.isArray(data.notes)) state.notes = data.notes.slice(0, 500);
        if(Array.isArray(data.tasks)) state.tasks = data.tasks.slice(0, 500);
        if(Array.isArray(data.expenses)) state.expenses = data.expenses.slice(0, 1000);
        if(data.preferences && typeof data.preferences === "object") state.preferences = {...state.preferences, ...data.preferences};
        if(data.learnedMemory && typeof data.learnedMemory === "object") state.learnedMemory = data.learnedMemory;
        if(Array.isArray(data.reminders)) state.reminders = data.reminders.slice(0, 500);
        if(data.routines && typeof data.routines === "object") state.routines = data.routines;
        saveMemory(); applyTheme20(state.preferences.theme);
        brainOutput.textContent = "Backup restaurado com sucesso.";
      }catch(err){ brainOutput.textContent = "Backup recusado: " + err.message; }
      brainBackupFile.value = "";
    });
    document.getElementById("brainPrivacyView").addEventListener("click", () => {
      brainOutput.textContent = "PRIVACIDADE LOCAL\n• Memória, rotinas e histórico: armazenados somente neste computador\n• Microfone: " + (state.preferences.privacyMode ? "desativado pelo modo privado" : "ativo para reconhecimento de voz") + "\n• Internet: usada somente por clima, notícias e integrações solicitadas\n• Credenciais: senhas não são armazenadas pela interface da Maia\n• Ações críticas: exigem confirmação\n• Exclusão total: disponível nesta central";
    });
    const haUrl=document.getElementById("brainHaUrl"),haToken=document.getElementById("brainHaToken"),haEntity=document.getElementById("brainHaEntity"),haAction=document.getElementById("brainHaAction"),haOutput=document.getElementById("brainHaOutput");
    const haActions={light:["turn_on","turn_off","toggle"],switch:["turn_on","turn_off","toggle"],fan:["turn_on","turn_off","toggle"],scene:["turn_on"],automation:["trigger","turn_on","turn_off"],cover:["open_cover","close_cover"],lock:["lock","unlock"],climate:["turn_on","turn_off"],media_player:["media_play_pause","turn_on","turn_off"]};
    const haActionLabels={turn_on:"Ligar/ativar",turn_off:"Desligar",toggle:"Alternar",trigger:"Executar automação",open_cover:"Abrir",close_cover:"Fechar",lock:"Trancar",unlock:"Destrancar",media_play_pause:"Reproduzir/pausar"};
    function syncHaActions(){const option=haEntity.options[haEntity.selectedIndex],domain=option&&option.dataset.domain||"";haAction.innerHTML=(haActions[domain]||[]).map(value=>`<option value="${value}">${haActionLabels[value]||value}</option>`).join("")}
    async function loadHaEntities(){haOutput.textContent="Carregando entidades…";try{const response=await callBridge("integration.homeAssistant.entities"),items=response.result||[];haEntity.innerHTML=items.map(item=>`<option value="${escapeHtml(item.entityId)}" data-domain="${escapeHtml(item.domain)}">${escapeHtml(item.name)} • ${escapeHtml(item.state)}</option>`).join("")||'<option value="">Nenhuma entidade compatível</option>';syncHaActions();haOutput.textContent=items.length+" entidades compatíveis carregadas."}catch(err){haOutput.textContent="Home Assistant: "+err.message}}
    haEntity.addEventListener("change",syncHaActions);
    document.getElementById("brainHaConnect").addEventListener("click",async()=>{haOutput.textContent="Conectando…";try{const response=await callBridge("integration.homeAssistant.configure",{baseUrl:haUrl.value,token:haToken.value}),result=response.result||{};haToken.value="";haOutput.textContent="✓ Conectado a "+(result.locationName||"Home Assistant")+" • versão "+(result.version||"detectada");await loadHaEntities()}catch(err){haOutput.textContent="Falha: "+err.message}});
    document.getElementById("brainHaRefresh").addEventListener("click",loadHaEntities);
    document.getElementById("brainHaStatus").addEventListener("click",async()=>{try{const response=await callBridge("integration.homeAssistant.status"),result=response.result||{};if(result.baseUrl)haUrl.value=result.baseUrl;haOutput.textContent=result.connected?"✓ "+(result.locationName||"Home Assistant")+" conectado • "+(result.version||"versão detectada"):result.configured?"Configurado, porém offline: "+result.error:"Ainda não configurado."}catch(err){haOutput.textContent=err.message}});
    document.getElementById("brainHaRun").addEventListener("click",async()=>{const option=haEntity.options[haEntity.selectedIndex];if(!option||!option.value)return;haOutput.textContent="Executando…";try{await callBridge("integration.homeAssistant.control",{entityId:option.value,domain:option.dataset.domain,service:haAction.value});haOutput.textContent="✓ Ação enviada para "+option.textContent;setTimeout(loadHaEntities,700)}catch(err){haOutput.textContent="Falha: "+err.message}});
    const mobilityCity=document.getElementById("brainMobilityCity"),trafficOrigin=document.getElementById("brainTrafficOrigin"),trafficKey=document.getElementById("brainTrafficKey"),trafficDestination=document.getElementById("brainTrafficDestination"),mobilityOutput=document.getElementById("brainMobilityOutput");
    document.getElementById("brainMobilitySave").addEventListener("click",async()=>{mobilityOutput.textContent="Salvando…";try{const response=await callBridge("integration.mobility.configure",{city:mobilityCity.value,origin:trafficOrigin.value,googleApiKey:trafficKey.value}),result=response.result||{};trafficKey.value="";mobilityOutput.textContent="✓ Preferências salvas. Trânsito ao vivo: "+(result.trafficConfigured?"configurado":"aguardando chave Google Routes") }catch(err){mobilityOutput.textContent="Falha: "+err.message}});
    document.getElementById("brainWeatherTest").addEventListener("click",async()=>{mobilityOutput.textContent="Consultando previsão…";try{const response=await callBridge("weather.complete",{location:mobilityCity.value}),result=response.result||{},current=result.current||{},daily=result.daily||{};const days=(daily.time||[]).slice(0,5).map((date,index)=>`${new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"})}: ${Math.round(daily.temperature_2m_min[index])}°–${Math.round(daily.temperature_2m_max[index])}° • chuva ${Math.round(daily.precipitation_probability_max[index]||0)}%`);mobilityOutput.textContent=[result.location&&result.location.name||mobilityCity.value,`Agora: ${Math.round(current.temperature_2m)}°C • sensação ${Math.round(current.apparent_temperature)}°C • umidade ${Math.round(current.relative_humidity_2m)}%`,`Vento: ${Math.round(current.wind_speed_10m)} km/h • rajadas ${Math.round(current.wind_gusts_10m)} km/h`,"",...days].join("\n")}catch(err){mobilityOutput.textContent="Clima indisponível: "+err.message}});
    document.getElementById("brainTrafficCheck").addEventListener("click",async()=>{mobilityOutput.textContent="Calculando rota com trânsito ao vivo…";try{const response=await callBridge("traffic.route",{origin:trafficOrigin.value,destination:trafficDestination.value}),result=response.result||{},routes=result.routes||[];mobilityOutput.textContent=[result.origin+" → "+result.destination,...routes.map((route,index)=>`${index?"Alternativa":"Melhor rota"}: ${route.durationMinutes} min • ${route.distanceKm} km${route.delayMinutes?` • atraso ${route.delayMinutes} min`:" • fluxo normal"}`)].join("\n")}catch(err){mobilityOutput.textContent="Trânsito indisponível: "+err.message}});
    callBridge("integration.homeAssistant.status").then(response=>{const result=response.result||{};if(result.baseUrl)haUrl.value=result.baseUrl;if(result.connected)loadHaEntities()}).catch(()=>{});
    callBridge("integration.mobility.status").then(response=>{const result=response.result||{};mobilityCity.value=result.city||state.preferences.city||"";trafficOrigin.value=result.origin||""}).catch(()=>{mobilityCity.value=state.preferences.city||""});
    document.getElementById("brainIntegrationStatus").addEventListener("click", async () => {
      brainOutput.textContent = "Verificando integrações...";
      try{
        const response = await callBridge("integration.status");
        const status = response && response.result || {};
        const apps = (status.installed || []).map(item => "✓ " + item.name);
        brainOutput.textContent = [
          "CENTRAL DE INTEGRAÇÕES",
          "Bridge local: " + (status.bridge ? "✓ operacional" : "✕ indisponível"),
          "Spotify: " + (status.spotify && status.spotify.connected ? "✓ conectado como " + status.spotify.user : "○ não conectado"),
          "Voz auxiliar: " + (status.speechHelper ? "✓ ativa" : "○ opcional/inativa"),
          "Aplicativos encontrados:",
          apps.length ? apps.join("\n") : "○ nenhum streaming compatível detectado"
        ].join("\n");
      }catch(err){ brainOutput.textContent = "Falha no diagnóstico das integrações: " + err.message; }
    });
    document.getElementById("brainTestAll").addEventListener("click", () => runSystemTest20(brainOutput));
    document.getElementById("brainOpenSetup").addEventListener("click", () => {
      setBrainPanel(false);
      openSetupWizard20();
    });
    document.getElementById("setupBack").addEventListener("click", () => showSetupStep20(setupStep20 - 1));
    setupWizard.addEventListener("click", (event) => event.stopPropagation());
    document.getElementById("setupSkip").addEventListener("click", () => {
      setupWizard.classList.remove("open");
      setupWizard.setAttribute("aria-hidden", "true");
    });
    document.getElementById("setupNext").addEventListener("click", () => {
      if(setupStep20 < 2) showSetupStep20(setupStep20 + 1);
      else completeSetupWizard20();
    });
    document.getElementById("setupTest").addEventListener("click", () => runSystemTest20(setupResults));
    setupWizard.addEventListener("keydown", (event) => {
      if(event.key === "Enter" && event.target.tagName !== "SELECT"){
        event.preventDefault();
        if(setupStep20 < 2) showSetupStep20(setupStep20 + 1);
        else completeSetupWizard20();
      }
      if(event.key === "Escape"){
        setupWizard.classList.remove("open");
        setupWizard.setAttribute("aria-hidden", "true");
      }
    });
    document.getElementById("brainPrivacyToggle").addEventListener("click", () => {
      state.preferences.privacyMode = !state.preferences.privacyMode;
      state.voiceEnabled = !state.preferences.privacyMode;
      if(state.preferences.privacyMode){
        if(recognition) try{ recognition.stop(); }catch(err){}
        if(window.speechSynthesis) window.speechSynthesis.cancel();
        setHud("MODO PRIVADO", "idle");
      }else{
        if(SR) startVoice();
        setHud("DIGA MAIA", "listening");
      }
      saveMemory();
      brainOutput.textContent = state.preferences.privacyMode ? "Modo privado ativo: microfone, histórico novo e registro de erros pausados." : "Modo privado desativado. Recursos locais restaurados.";
    });
    document.getElementById("brainErrorLog").addEventListener("click", () => {
      brainOutput.textContent = state.errorLog.length ? "ERROS RECENTES\n" + state.errorLog.slice(0, 20).map(item => new Date(item.at).toLocaleString("pt-BR") + " — " + item.source + ": " + item.message).join("\n") : "Nenhum erro registrado.";
    });
    document.getElementById("brainMicApply").addEventListener("click", () => {
      state.preferences.micSensitivity = Math.max(10, Math.min(100, Number(brainMicSensitivity.value) || 55));
      saveMemory();
      brainOutput.textContent = "Sensibilidade do microfone em " + state.preferences.micSensitivity + "%. Fale normalmente para observar o núcleo reagir.";
    });
    document.getElementById("brainUpdateCheck").addEventListener("click", async () => {
      try{
        const data = await callBridge("update.status");
        const update = data && data.result;
        if(!update.configured) brainOutput.textContent = "Maia " + update.currentVersion + " está instalada. O canal oficial ainda não foi configurado; nenhuma atualização insegura será baixada.";
        else if(update.available) brainOutput.textContent = "Nova versão disponível: " + update.latestVersion + ". O instalador deverá ser confirmado antes da instalação.";
        else brainOutput.textContent = "Maia está atualizada na versão " + update.currentVersion + ".";
      }catch(err){ brainOutput.textContent = "Não consegui verificar atualizações: " + err.message; }
    });
    document.getElementById("brainDiagnostics").addEventListener("click", async () => {
      const t = window.__maiaTelemetry || {};
      const quality = window.nucleo && window.nucleo.getQuality ? window.nucleo.getQuality() : {};
      let integrations = null;
      try{ integrations = (await callBridge("integration.status")).result; }catch(err){}
      brainOutput.textContent = [
        "DIAGNÓSTICO 3.2",
        "Bridge local: " + (state.bridgeOnline ? "online" : "indisponível"),
        "Microfone: " + (state.preferences.privacyMode ? "desativado pelo modo privado" : state.listening ? "ouvindo" : "aguardando"),
        "Reconhecimento: " + (SR ? "disponível" : "indisponível neste sistema"),
        "Internet: " + (t.internet_online === true ? "online" : t.internet_online === false ? "offline" : "verificando"),
        "Spotify: " + (integrations && integrations.spotify && integrations.spotify.connected ? "conectado" : "não conectado"),
        "Última fala: " + (state.diagnostics.heard || "—"),
        "Comando corrigido: " + (state.diagnostics.corrected || "—"),
        "Origem/confiança: " + (state.diagnostics.source || "—") + " / " + (state.diagnostics.confidence == null ? "—" : Math.round(state.diagnostics.confidence * 100) + "%"),
        "Intenção: " + (state.diagnostics.intent || "—") + " / " + (state.diagnostics.intentConfidence == null ? "—" : state.diagnostics.intentConfidence + "%"),
        "Resultado: " + (state.diagnostics.status || "aguardando"),
        "Apps integrados: " + (integrations && integrations.installed ? integrations.installed.length : "—"),
        "Erros recentes: " + state.errorLog.length,
        "CPU: " + (t.cpu_percent == null ? "—" : t.cpu_percent + "%"),
        "RAM: " + (t.ram_percent == null ? "—" : t.ram_percent + "%"),
        "GPU: " + (t.gpu_name || "—"),
        "Visual: " + (quality.selected || "auto") + " / " + (quality.effective || "—") + " / " + (quality.particles || "—") + " partículas",
        "Render: " + (quality.fps || 0) + " FPS / " + (quality.drawCalls || 0) + " chamadas / " + (quality.triangles || 0) + " triângulos",
        "Intensidade: " + (quality.intensity || 100) + "%",
        "Tema: " + (state.preferences.theme || "classic"),
        "Integridade: " + (t.integrity_percent == null ? "—" : t.integrity_percent + "%")
      ].join("\n");
    });
    document.getElementById("brainClipboardSummary").addEventListener("click", async () => {
      try{
        const data = await callBridge("clipboard.read");
        const text = String(data && data.result && data.result.text || "").trim();
        if(!text){ brainOutput.textContent = "Não há texto copiado."; return; }
        const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [text];
        const summary = sentences.slice(0, 3).join(" ").trim().slice(0, 700);
        brainOutput.textContent = "RESUMO LOCAL\n" + summary;
      }catch(err){ brainOutput.textContent = "Não consegui acessar o texto copiado."; }
    });
    document.getElementById("brainClipboardFix").addEventListener("click", async () => {
      try{
        const data = await callBridge("clipboard.read");
        let text = String(data && data.result && data.result.text || "").trim();
        if(!text){ brainOutput.textContent = "Não há texto copiado."; return; }
        text = text.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").replace(/([.!?])(?=\S)/g, "$1 ");
        text = text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
        await callBridge("clipboard.write", {text});
        brainOutput.textContent = "Texto corrigido por regras locais e copiado novamente:\n" + text.slice(0, 700);
      }catch(err){ brainOutput.textContent = "Não consegui corrigir o texto copiado."; }
    });
    document.getElementById("brainNotificationSummary").addEventListener("click", () => {
      const openTasks = state.tasks.filter(item => !item.done);
      const upcoming = state.reminders.filter(item => !item.done).slice(0, 10);
      brainOutput.textContent = [
        "CENTRAL DE AVISOS LOCAL",
        "Tarefas pendentes: " + openTasks.length,
        "Lembretes ativos: " + upcoming.length,
        ...openTasks.slice(0, 5).map(item => "• " + (item.text || item.title || "tarefa")),
        ...upcoming.slice(0, 5).map(item => "• " + (item.text || item.title || "lembrete"))
      ].join("\n");
    });
  }

  function rememberCommand(command, intent){
    if(state.preferences.privacyMode) return;
    const text = String(command || "").trim();
    if(!text) return;
    state.commandHistory.unshift({text, intent: intent || "unknown", at: new Date().toISOString()});
    state.commandHistory = state.commandHistory.slice(0, 80);
    const hour = String(new Date().getHours()).padStart(2, "0");
    state.preferences.commonHours[hour] = (state.preferences.commonHours[hour] || 0) + 1;
    saveMemory();
  }

  function rememberFavoriteApp(program){
    const app = String(program || "").trim();
    if(!app) return;
    const key = normalize(app);
    state.preferences.favoriteApps = state.preferences.favoriteApps.filter(item => normalize(item) !== key);
    state.preferences.favoriteApps.unshift(app);
    state.preferences.favoriteApps = state.preferences.favoriteApps.slice(0, 12);
    saveMemory();
  }

  function rememberMusic(query){
    const music = String(query || "").trim();
    if(!music) return;
    const key = normalize(music);
    const existing = state.preferences.frequentMusics.find(item => normalize(item.name) === key);
    if(existing){
      existing.count += 1;
      existing.lastAt = new Date().toISOString();
    }else{
      state.preferences.frequentMusics.push({name: music, count: 1, lastAt: new Date().toISOString()});
    }
    state.preferences.frequentMusics.sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt)));
    state.preferences.frequentMusics = state.preferences.frequentMusics.slice(0, 20);
    saveMemory();
  }

  function ownerTitle(){
    const rawName = String(state.preferences.ownerName || "").trim();
    const name = rawName && normalize(rawName) !== "senhor" ? rawName : "";
    const treatment = state.preferences.treatment || "senhor";
    if(treatment === "senhora") return name ? "senhora " + name : "senhora";
    if(treatment === "name" || treatment === "neutral") return name || "você";
    return name ? "senhor " + name : "senhor";
  }

  function applyUserTreatment20(text){
    const treatment = state.preferences.treatment || "senhor";
    const source = String(text || "");
    if(treatment === "senhor") return source;
    if(treatment === "senhora"){
      return source
        .replace(/\bdo senhor\b/gi, "da senhora")
        .replace(/\bao senhor\b/gi, "à senhora")
        .replace(/\bo senhor\b/gi, "a senhora")
        .replace(/\bsenhor\b/gi, "senhora");
    }
    const rawName = String(state.preferences.ownerName || "").trim();
    const name = rawName && normalize(rawName) !== "senhor" ? rawName : "";
    return source
      .replace(/,\s*(?:senhor|senhora)\b/gi, name ? ", " + name : "")
      .replace(/\b(?:do senhor|da senhora)\b/gi, "de você")
      .replace(/\b(?:ao senhor|à senhora)\b/gi, "a você")
      .replace(/\b(?:para o senhor|para a senhora)\b/gi, "para você")
      .replace(/\b(?:o senhor|a senhora)\b/gi, "você")
      .replace(/\b(?:senhor|senhora)\b/gi, "você");
  }

  function assistantName(){
    return "Maia";
  }

  function greeting(){
    const hour = new Date().getHours();
    if(hour < 5) return "Boa madrugada";
    if(hour < 12) return "Bom dia";
    if(hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  function dayPeriod(date = new Date()){
    const hour = date.getHours();
    if(hour < 5) return "da madrugada";
    if(hour < 12) return "da manhã";
    if(hour < 18) return "da tarde";
    return "da noite";
  }

  function spokenClock(date = new Date()){
    const hour24 = date.getHours();
    const minute = date.getMinutes();
    const hour12 = hour24 % 12 || 12;
    const hourWord = hour24 === 12 ? "meio-dia" : (hour24 === 0 ? "meia-noite" : (hour12 === 1 ? "uma" : String(hour12)));
    const minuteWord = minute === 0 ? " em ponto" : (minute === 30 ? " e meia" : " e " + minute);
    const period = hour24 === 0 || hour24 === 12 ? "" : " " + dayPeriod(date);
    return hourWord + minuteWord + period;
  }

  function shortSpokenClock(date = new Date()){
    return spokenClock(date);
  }

  function formalLine(text){
    const clean = String(text || "").trim();
    if(!clean) return "";
    const title = ownerTitle();
    if(new RegExp("\\b" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(clean) || /\bsenhor\b/i.test(clean)) return clean;
    return title.charAt(0).toUpperCase() + title.slice(1) + ", " + clean.charAt(0).toLowerCase() + clean.slice(1);
  }

  function stripFormalPrefix(clean){
    const title = ownerTitle();
    return String(clean || "")
      .replace(new RegExp("^\\s*" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ",\\s*", "i"), "")
      .replace(/^\s*senhor,\s*/i, "")
      .trim();
  }

  const SARCASTIC_PREFIXES = [
    "Ah, claro.",
    "Nossa, que surpresa.",
    "Lá vamos nós de novo.",
    "Com certeza, chefe.",
    "Que original."
  ];

  function styleLine(text){
    const clean = String(text || "").trim();
    if(!clean) return "";
    const mode = state.speechMode || state.preferences.speechMode || "formal";
    if(mode === "casual") return stripFormalPrefix(clean);
    if(mode === "sarcastic") return pick(SARCASTIC_PREFIXES) + " " + stripFormalPrefix(clean);
    return formalLine(clean);
  }

  function responseByMode(kind, data = {}){
    const mode = state.speechMode || state.preferences.speechMode || "formal";
    const timeLead = /^(meio-dia|meia-noite|uma\b)/i.test(String(data.timeText || "")) ? "Agora é " : "Agora são ";
    const lines = {
      greeting: {
        formal: [
          greeting() + ", senhor. Sistemas ativos e aguardando suas instruções.",
          greeting() + ", senhor. O Kernel está operacional.",
          greeting() + ", senhor. Estou pronto para executar seus comandos."
        ],
        casual: [
          greeting() + ". Estou na escuta.",
          greeting() + ". Pode mandar.",
          greeting() + ". Maia online."
        ],
        sarcastic: [
          greeting() + ". Incrivelmente, continuo funcionando.",
          greeting() + ". Pronto para mais uma missão impossível.",
          greeting() + ". Sistemas ativos, porque aparentemente descanso é opcional."
        ]
      },
      time: {
        formal: [timeLead + data.timeText + ", senhor."],
        casual: [timeLead + data.shortTimeText + ".", "O relógio marca " + data.shortTimeText + "."],
        sarcastic: [timeLead + data.shortTimeText + ". Ainda trabalhando?", timeLead + data.shortTimeText + ". O tempo não espera, senhor."]
      },
      date: {
        formal: ["Hoje é " + data.date + "."],
        casual: ["Hoje é " + data.date + ".", "Data de hoje: " + data.date + "."],
        sarcastic: ["Hoje é " + data.date + ". Sim, o calendário continua existindo."]
      }
    };
    const group = lines[kind] || {};
    return pick(group[mode] || group.formal || ["Comando executado."]);
  }

  function setSpeechMode(mode){
    const selected = ["formal", "casual", "sarcastic"].includes(mode) ? mode : "formal";
    state.speechMode = selected;
    state.preferences.speechMode = selected;
    saveMemory();
  }

  function repairSpeechText(text){
    return String(text || "")
      .normalize("NFC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/instrucoes/gi, "instruções")
      .replace(/musica/gi, "música")
      .replace(/medio/gi, "médio")
      .replace(/proxima/gi, "próxima")
      .replace(/reproducao/gi, "reprodução")
      .replace(/seguranca/gi, "segurança")
      .replace(/conteudo/gi, "conteúdo")
      .replace(/numero/gi, "número")
      .replace(/audio/gi, "áudio")
      .replace(/proprio/gi, "próprio")
      .replace(/silencio/gi, "silêncio")
      .replace(/acao/gi, "ação")
      .replace(/solicitacao/gi, "solicitação")
      .replace(/expressao/gi, "expressão")
      .replace(/nao/gi, "não")
      .replace(/esta aberta/gi, "está aberta")
      .replace(/\bCPU\b/g, "C P U")
      .replace(/\bRAM\b/g, "memória RAM")
      .replace(/(\d+(?:[,.]\d+)?)\s*%/g, "$1 por cento")
      .replace(/(\d+(?:[,.]\d+)?)\s*GB\b/gi, "$1 gigabytes")
      .replace(/(\d+(?:[,.]\d+)?)\s*ms\b/gi, "$1 milissegundos")
      .replace(/\bURL\b/g, "U R L")
      .replace(/\bPIX\b/g, "Pix")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/([.!?])(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim();
  }

  let lastSpokenText20 = "";
  let lastSpokenAt20 = 0;
  function speak(text){
    suppressClaps(2500);
    setHud("RESPONDENDO", "speaking");
    if(state.preferences.silentMode){
      setCore(String(text || "").slice(0, 72).toUpperCase());
      setTimeout(() => setHud("DIGA MAIA", "listening"), 900);
      return Promise.resolve();
    }
    const spoken = styleLine(repairSpeechText(applyUserTreatment20(text)));
    const spokenAt = Date.now();
    if(spoken === lastSpokenText20 && spokenAt - lastSpokenAt20 < 4000) return Promise.resolve();
    lastSpokenText20 = spoken;
    lastSpokenAt20 = spokenAt;
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    window.__maiaSpeaking = true;
    if(window.nucleo && window.nucleo.setSpeaking) window.nucleo.setSpeaking();
    return Promise.resolve(window.nucleo && window.nucleo.speak
      ? window.nucleo.speak(spoken, state.speechMode || state.preferences.speechMode)
      : null)
      .finally(() => {
        window.__maiaSpeaking = false;
        window.__maiaIgnoreVoiceUntil = Date.now() + 1200;
        if(window.nucleo && window.nucleo.idle) window.nucleo.idle();
      });
  }

  let activeAlarmAudio = null;
  let activeAlarmSpeechTimer = null;
  let activeAlarmSafetyTimer = null;
  function stopAlarmSound(){
    clearTimeout(activeAlarmSpeechTimer);
    activeAlarmSpeechTimer = null;
    clearTimeout(activeAlarmSafetyTimer);
    activeAlarmSafetyTimer = null;
    if(activeAlarmAudio){
      try{ clearInterval(activeAlarmAudio.timer); }catch(err){}
      try{ activeAlarmAudio.ctx.close(); }catch(err){}
      activeAlarmAudio = null;
    }
  }
  function playAlarmSound(kind = "effect"){
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtor) return;
    stopAlarmSound();
    const ctx = new AudioCtor();
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    master.gain.value = kind === "reminder" ? .38 : .72;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    const playPhrase = () => {
      if(ctx.state === "closed") return;
      const started = ctx.currentTime + .03;
      const notes = kind === "reminder"
        ? [[659.25,0,.28],[783.99,.34,.36]]
        : [[880,0,.20],[1174.66,.24,.20],[880,.48,.20],[1318.51,.72,.38],[880,1.28,.20],[1174.66,1.52,.20],[1318.51,1.76,.42]];
      for(const [frequency, offset, duration] of notes){
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const t = started + offset;
        osc.type = kind === "reminder" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(frequency, t);
        noteGain.gain.setValueAtTime(.0001, t);
        noteGain.gain.exponentialRampToValueAtTime(kind === "reminder" ? .28 : .42, t + .025);
        noteGain.gain.exponentialRampToValueAtTime(.0001, t + duration);
        osc.connect(noteGain);
        noteGain.connect(master);
        osc.start(t);
        osc.stop(t + duration + .03);
      }
    };
    playPhrase();
    const continuous = kind === "alarm" || kind === "timer";
    const timer = continuous ? setInterval(playPhrase, 4200) : null;
    activeAlarmAudio = {ctx, timer};
    if(continuous) activeAlarmSafetyTimer = setTimeout(stopAlarmSound, 5 * 60 * 1000);
    if(!continuous){
      setTimeout(() => {
        if(activeAlarmAudio && activeAlarmAudio.ctx === ctx) activeAlarmAudio = null;
        ctx.close().catch(() => {});
      }, 2600);
    }
  }

  function playCountdownBeep(urgent){
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = urgent ? "square" : "triangle";
    osc.frequency.value = urgent ? 1080 : 720;
    gain.gain.setValueAtTime(.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (urgent ? .18 : .11));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + .2);
    setTimeout(() => ctx.close().catch(() => {}), 350);
  }

  async function runSelfDestruct(seconds){
    const runId = ++selfDestructRun;
    const previousMode = state.visualMode || "default";
    const duration = Math.min(60, Math.max(5, Number(seconds) || 5));
    suppressClaps((duration + 4) * 1000);
    setVisualMode("combat");
    document.body.classList.add("self-destruct-alert");
    setCore("AUTODESTRUIÇÃO ARMADA");
    setHud("CONTAGEM: " + duration + " SEGUNDOS", "speaking");
    playAlarmSound();
    speak("Protocolo de autodestruição confirmado. Contagem regressiva de " + duration + " segundos iniciada, senhor.");

    for(let remaining = duration; remaining > 0; remaining--){
      if(runId !== selfDestructRun) return;
      setCore("NÚCLEO CRÍTICO: " + String(remaining).padStart(2, "0"));
      setHud("AUTODESTRUIÇÃO EM " + remaining, "speaking");
      playCountdownBeep(remaining <= 5);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if(runId !== selfDestructRun) return;
    playAlarmSound();
    setCore("FALHA CATASTRÓFICA");
    setHud("IMPACTO IMINENTE", "speaking");
    await new Promise(resolve => setTimeout(resolve, 900));
    document.body.classList.remove("self-destruct-alert");
    setVisualMode(previousMode);
    setCore("PROTOCOLO CANCELADO");
    speak(pick([
      "Autodestruição cancelada no último segundo, senhor. Motivo técnico: eu gosto demais deste computador.",
      "Impacto evitado. O reator era apenas um efeito sonoro muito convincente, senhor.",
      "Protocolo cancelado, senhor. A garantia não cobre explosões cinematográficas."
    ]));
  }

  function playSaleSound(){
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtor) return;
    const ctx = new AudioCtor();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const start = now + index * .12;
      osc.type = index === 3 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(frequency, start);
      noteGain.gain.setValueAtTime(.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(.15, start + .025);
      noteGain.gain.exponentialRampToValueAtTime(.0001, start + .22);
      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(start);
      osc.stop(start + .24);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1400);
  }

  function announceApprovedSale(sale){
    const amount = Number(sale && sale.amount || 0);
    const formatted = amount.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    const product = String(sale && sale.product || "Venda Arkama");
    suppressClaps(6000);
    playSaleSound();
    setVisualMode("focus");
    setCore("VENDA APROVADA");
    setHud(("VENDA " + formatted).toUpperCase(), "speaking");
    const celebration = pick([
      "Excelente resultado. Continue assim!",
      "Mais uma conquista confirmada. Seu trabalho está dando resultado!",
      "Muito bem! Consistência transforma esforço em sucesso.",
      "Fantástico! Uma venda de cada vez, construindo algo grandioso.",
      "Missão cumprida. Mantenha o ritmo, você está avançando!",
      "Ótimo trabalho! O progresso acaba de virar resultado."
    ]);
    speak("Sua venda no valor de " + formatted + " foi aprovada com sucesso. " + product + ". " + celebration);
  }

  async function callBridge(action, payload){
    const controller = new AbortController();
    const timeoutByAction = {
      "speech.openHelper": 15000,
      "spotify.open": 3500,
      "system.openProgram": 4500,
      "volume.set": 3500,
      "volume.up": 3500,
      "volume.down": 3500,
      "volume.mute": 3500,
      "clipboard.write": 2500,
      "network.devices": 20000,
      "spotify.searchPlay": 45000,
      "spotify.playSearch": 45000,
      "spotify.queueSearch": 45000,
      "youtube.play": 30000,
      "youtube.search": 15000,
      "youtube.open": 15000,
      "brain.think": 125000
    };
    const timeout = timeoutByAction[action] || 8000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try{
      const response = await fetch(BRIDGE_URL + "/command", {
        method: "POST",
        headers: bridgeHeaders({"Content-Type":"application/json"}),
        signal: controller.signal,
        body: JSON.stringify({ action, payload: payload || {} })
      });
      const data = await response.json();
      if(!response.ok || data.ok === false) throw new Error(data.error || "falha na conexão do Maia");
      return data;
    }catch(err){
      logError20(action, err);
      throw err;
    }finally{
      clearTimeout(timer);
    }
  }

  function logError20(source, error){
    if(state.preferences.privacyMode) return;
    const message = String(error && error.message || error || "erro desconhecido").slice(0, 500);
    state.errorLog.unshift({source:String(source || "sistema"), message, at:new Date().toISOString()});
    state.errorLog = state.errorLog.slice(0, 100);
    localStorage.setItem("Maia.voice.errors", JSON.stringify(state.errorLog));
  }

  async function checkBridge(){
    try{
      const response = await fetch(BRIDGE_URL + "/status", {cache:"no-store", headers:bridgeHeaders()});
      state.bridgeOnline = response.ok;
      systemState.textContent = state.bridgeOnline ? "PONTE ONLINE" : "PONTE OFFLINE";
    }catch(err){
      state.bridgeOnline = false;
      systemState.textContent = "PONTE OFFLINE";
    }
  }

  function radarPosition(device, index){
    if(device && device.isLocal) return {left:52, top:52};
    const seedText = String(device && (device.mac || device.address) || index);
    let seed = 0;
    for(let i = 0; i < seedText.length; i++) seed = ((seed * 31) + seedText.charCodeAt(i)) >>> 0;
    const angle = (seed % 360) * Math.PI / 180;
    const radius = 15 + ((seed >>> 8) % 31);
    return {left:52 + Math.cos(angle) * radius, top:52 + Math.sin(angle) * radius};
  }

  function renderNetworkRadar(result){
    const radar = document.getElementById("radar");
    const label = document.getElementById("radarLabel");
    const network = document.getElementById("radarNetwork");
    const list = document.getElementById("radarDevices");
    if(!radar || !label || !network || !list) return;

    radar.querySelectorAll(".radar-blip").forEach((node) => node.remove());
    list.replaceChildren();
    const devices = Array.isArray(result && result.devices) ? result.devices : [];
    label.textContent = devices.length + (devices.length === 1 ? " DISPOSITIVO" : " DISPOSITIVOS");
    network.textContent = result && result.interface
      ? `${result.interface.name}  •  ${result.interface.address}`
      : (result && result.error || "Rede local não identificada");

    devices.forEach((device, index) => {
      const point = radarPosition(device, index);
      const blip = document.createElement("span");
      blip.className = "radar-blip" + (device.isLocal ? " local" : "") + (device.isGateway ? " gateway" : "");
      blip.style.left = point.left + "px";
      blip.style.top = point.top + "px";
      blip.title = `${device.name} — ${device.address}`;
      radar.insertBefore(blip, document.getElementById("radarLabel"));

      const row = document.createElement("div");
      row.className = "radar-device";
      const name = document.createElement("div");
      name.className = "radar-device-name";
      name.textContent = device.name + (device.isLocal ? " (ESTE PC)" : "");
      const meta = document.createElement("div");
      meta.className = "radar-device-meta";
      meta.textContent = device.address + (device.mac ? "  •  " + device.mac : "");
      row.append(name, meta);
      list.appendChild(row);
    });

    if(!devices.length){
      const empty = document.createElement("div");
      empty.className = "radar-empty";
      empty.textContent = "Nenhum dispositivo respondeu à varredura.";
      list.appendChild(empty);
    }
  }

  async function refreshNetworkRadar(){
    const label = document.getElementById("radarLabel");
    if(label) label.textContent = "VARRENDO REDE...";
    try{
      const data = await callBridge("network.devices");
      renderNetworkRadar(data && data.result);
    }catch(err){
      renderNetworkRadar({devices: [], error: "Falha ao acessar a rede local"});
    }
  }

  const networkRadar = document.getElementById("radar");
  if(networkRadar){
    const toggleRadar = () => {
      const open = networkRadar.classList.toggle("open");
      networkRadar.setAttribute("aria-expanded", String(open));
      if(open) refreshNetworkRadar();
    };
    networkRadar.addEventListener("click", (event) => {
      if(event.target.closest(".radar-panel")) return;
      toggleRadar();
    });
    networkRadar.addEventListener("keydown", (event) => {
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        toggleRadar();
      }
    });
  }

  let nativeVoiceEvents = null;
  let browserVoiceEvents = null;

  async function startNativeVoiceBridge(){
    if(nativeVoiceEvents && nativeVoiceEvents.readyState !== EventSource.CLOSED) return;
    try{
      const events = new EventSource(bridgeEventUrl());
      nativeVoiceEvents = events;
      events.addEventListener("status", (event) => {
        const data = JSON.parse(event.data);
        if(data.running){
          state.nativeVoiceActive = true;
          setCore("VOZ NATIVA ATIVA");
          setHud("DIGA MAIA", "listening");
        }
      });
      events.addEventListener("partial", (event) => {
        const data = JSON.parse(event.data);
        if(data.text) setHud("OUVINDO: " + data.text.slice(0, 30).toUpperCase(), "listening");
      });
      events.addEventListener("result", (event) => {
        const data = JSON.parse(event.data);
        if(data.text){
          state.lastNativeVoiceAt = Date.now();
          setHud("OUVI: " + data.text.slice(0, 30).toUpperCase(), "listening");
          handleVoice(data.text, state.commandArmed ? "command" : "wake");
        }
      });
      events.addEventListener("error", () => {
        state.nativeVoiceActive = false;
        setCore("VOZ NATIVA ERRO");
      });
      events.addEventListener("native-error", (event) => {
        setCore("VOZ ONLINE ATIVA");
        setHud("RECONHECIMENTO EM RECUPERACAO", "listening");
        openBrowserSpeechHelper(false, true).catch(() => {});
      });
      await fetch(BRIDGE_URL + "/voice/start", {method:"POST", headers:bridgeHeaders()});
    }catch(err){
      setCore("VOZ NATIVA OFF");
    }
  }

  async function startBrowserSpeechBridge(){
    if(browserVoiceEvents && browserVoiceEvents.readyState !== EventSource.CLOSED) return;
    try{
      const events = new EventSource(bridgeEventUrl());
      browserVoiceEvents = events;
      events.addEventListener("browser-partial", (event) => {
        const data = JSON.parse(event.data);
        if(data.text) setHud("OUVINDO: " + data.text.slice(0, 30).toUpperCase(), "listening");
      });
      events.addEventListener("browser-result", (event) => {
        const data = JSON.parse(event.data);
        if(data.text){
          setHud("OUVI: " + data.text.slice(0, 34).toUpperCase(), "listening");
          handleVoice(data.text, "web");
        }
      });
      events.addEventListener("sale-approved", (event) => {
        try{ announceApprovedSale(JSON.parse(event.data)); }catch(err){}
      });
    }catch(err){}
  }

  async function openBrowserSpeechHelper(force, silent){
    if(state.browserHelperOpening) return;
    if(state.browserHelperOpened && !force) return;
    state.browserHelperOpening = true;
    try{
      const opened = await callBridge("speech.openHelper");
      state.browserHelperOpened = true;
      if(!silent){
        setCore("EDGE VOZ ONLINE");
        setHud("ATIVE A ABA DA MAIA", "listening");
      }
      return opened;
    }catch(err){
      if(!silent){
        setCore("FALHA VOZ ONLINE");
        setHud("ABRA: 127.0.0.1:17778/speech-helper", "idle");
      }
      throw err;
    }finally{
      state.browserHelperOpening = false;
    }
  }

  async function startMicLevelDiagnostic(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = .72;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastDiagnosticUpdate = 0;
      setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for(let i = 0; i < data.length; i++) sum += data[i];
        const level = sum / data.length / 255;
        const sensitivity = Math.max(10, Math.min(100, Number(state.preferences.micSensitivity || 55)));
        const micThreshold = Math.max(.005, .03 - sensitivity * .00025);
        const visualLevel=Math.min(1,level*(4+sensitivity/18));
        if(window.nucleo && window.nucleo.setAmplitude) window.nucleo.setAmplitude(visualLevel);
        if(window.nucleo && window.nucleo.setSpectrum) window.nucleo.setSpectrum(data);
        postModern20({type:"maia-interface-mic",level:visualLevel,active:Boolean(state.voiceEnabled),speaking:Boolean(window.__maiaSpeaking)});
        if(level > micThreshold) state.lastMicPulseAt = Date.now();
        if(Date.now() - lastDiagnosticUpdate < 600) return;
        lastDiagnosticUpdate = Date.now();
        if(!state.voiceEnabled) return;
        const heardAudio = Date.now() - state.lastMicPulseAt < 1800;
        const heardSpeech = Date.now() - state.lastNativeVoiceAt < 6000;
        if(heardAudio && !heardSpeech){
          setCore("CAPTANDO AUDIO");
          setHud("DIGA MAIA", "listening");
        }else if(!heardAudio && state.listening){
          setCore("AGUARDANDO COMANDO");
        }
      }, 180);
    }catch(err){
      postModern20({type:"maia-interface-mic",level:0,active:false,error:"Microfone indisponível"});
      setCore("MIC BLOQUEADO");
      setHud("LIBERE O MICROFONE NO WINDOWS", "idle");
    }
  }

  function wordsToNumbers(text){
    const values = {
      zero:0, um:1, uma:1, dois:2, duas:2, tres:3, três:3, quatro:4, cinco:5,
      seis:6, sete:7, oito:8, nove:9, dez:10, onze:11, doze:12, treze:13,
      quatorze:14, catorze:14, quinze:15, dezesseis:16, dezassete:17, dezessete:17,
      dezoito:18, dezenove:19, vinte:20, trinta:30, quarenta:40, cinquenta:50,
      sessenta:60, setenta:70, oitenta:80, noventa:90, cem:100, cento:100,
      duzentos:200, trezentos:300, quatrocentos:400, quinhentos:500, seiscentos:600,
      setecentos:700, oitocentos:800, novecentos:900
    };
    const source = String(text || "");
    const numberWord = Object.keys(values).join("|");
    const pattern = new RegExp("\\b(?:" + numberWord + "|mil|milhao|milhoes)(?:\\s+e?\\s*(?:" + numberWord + "|mil|milhao|milhoes))*\\b", "gi");
    return source.replace(pattern, (match) => {
      let total = 0;
      let current = 0;
      for(const token of normalize(match).split(/\s+/).filter(token => token !== "e")){
        if(token === "mil"){
          total += (current || 1) * 1000;
          current = 0;
        }else if(token === "milhao" || token === "milhoes"){
          total = (total + (current || 1)) * 1000000;
          current = 0;
        }else{
          current += values[token] || 0;
        }
      }
      return String(total + current);
    });
  }

  function normalizeCalculation(text){
    let expr = wordsToNumbers(text)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(\d{1,3}(?:\.\d{3})+),(\d+)\b/g, (_, integer, decimal) => integer.replace(/\./g, "") + "." + decimal)
      .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, value => value.replace(/\./g, ""))
      .replace(/,/g, ".")
      .replace(/\bquanto\s+(e|é)\b/g, "")
      .replace(/\b(calcula|calcule|calcular|faca a conta|faça a conta|resolva|resultado de|resultado da|resultado do)\b/g, "")
      .replace(/\bqual (?:e|é) o resultado (?:de|da|do)\b/g, "")
      .replace(/\bmultiplique\s+([0-9.]+)\s+por\s+([0-9.]+)/g, "$1*$2")
      .replace(/\bdivida\s+([0-9.]+)\s+por\s+([0-9.]+)/g, "$1/$2")
      .replace(/\bsome\s+([0-9.]+)\s+(?:com|e)\s+([0-9.]+)/g, "$1+$2")
      .replace(/\bsubtraia\s+([0-9.]+)\s+de\s+([0-9.]+)/g, "$2-$1")
      .replace(/\bproduto de\s+([0-9.]+)\s+(?:e|por)\s+([0-9.]+)/g, "$1*$2")
      .replace(/\bsoma de\s+([0-9.]+)\s+(?:e|com)\s+([0-9.]+)/g, "$1+$2")
      .replace(/\bdiferenca entre\s+([0-9.]+)\s+e\s+([0-9.]+)/g, "$1-$2")
      .replace(/\bmedia de\s+([0-9.]+)\s+(?:e|com)\s+([0-9.]+)/g, "(($1+$2)/2)")
      .replace(/\bdobro de\s+([0-9.]+)/g, "(2*$1)")
      .replace(/\btriplo de\s+([0-9.]+)/g, "(3*$1)")
      .replace(/\bmetade de\s+([0-9.]+)/g, "($1/2)")
      .replace(/\b([0-9.]+)\s*por\s+100\s+de\s+([0-9.]+)/g, "($1/100)*$2")
      .replace(/\b([0-9.]+)\s*por\s+100\b/g, "($1/100)")
      .replace(/\b([0-9.]+)\s*por\s+cento\s+de\s+([0-9.]+)/g, "($1/100)*$2")
      .replace(/\b([0-9.]+)\s*por\s+cento\b/g, "($1/100)")
      .replace(/\b([0-9.]+)\s*percentual\s+de\s+([0-9.]+)/g, "($1/100)*$2")
      .replace(/\b([0-9.]+)\s*%\s*de\s*([0-9.]+)/g, "($1/100)*$2")
      .replace(/\braiz\s+(quadrada\s+)?de\s+([0-9.]+)/g, "Math.sqrt($2)")
      .replace(/\braiz cubica de\s+([0-9.]+)/g, "Math.cbrt($1)")
      .replace(/√\s*([0-9.]+)/g, "Math.sqrt($1)")
      .replace(/∛\s*([0-9.]+)/g, "Math.cbrt($1)")
      .replace(/\bquadrado de\s+([0-9.]+)/g, "($1**2)")
      .replace(/\bcubo de\s+([0-9.]+)/g, "($1**3)")
      .replace(/\braiz\s*\(/g, "Math.sqrt(")
      .replace(/\bseno\s+de\s+([0-9.]+)/g, "Math.sin(($1)*Math.PI/180)")
      .replace(/\bcosseno\s+de\s+([0-9.]+)/g, "Math.cos(($1)*Math.PI/180)")
      .replace(/\btangente\s+de\s+([0-9.]+)/g, "Math.tan(($1)*Math.PI/180)")
      .replace(/\b(pi)\b/g, "Math.PI")
      .replace(/π/g, "Math.PI")
      .replace(/\bnumero euler\b/g, "Math.E")
      .replace(/\b(?:vezes|multiplicado por|multiplicada por|multiplique por|xis|x)\b|×/g, "*")
      .replace(/\b(?:dividido por|dividida por|dividido|divida por|sobre)\b|÷/g, "/")
      .replace(/\b(?:mais|somado com|somada com|soma com|adicionado a|adicionada a)\b/g, "+")
      .replace(/\b(?:menos|subtraido de|subtraida de)\b/g, "-")
      .replace(/\belevado ao quadrado\b/g, "**2")
      .replace(/\belevado ao cubo\b/g, "**3")
      .replace(/\belevado a|elevado ao|potencia de|potência de\b/g, "**")
      .replace(/\bao quadrado\b/g, "**2")
      .replace(/\bao cubo\b/g, "**3")
      .replace(/([0-9.)]+)²/g, "($1**2)")
      .replace(/([0-9.)]+)³/g, "($1**3)")
      .replace(/\bmodulo de\s+([0-9.\-]+)/g, "Math.abs($1)")
      .replace(/\bmodulo\b/g, "%")
      .replace(/\blog\s+de\s+([0-9.]+)/g, "Math.log10($1)")
      .replace(/\bln\s+de\s+([0-9.]+)/g, "Math.log($1)")
      .replace(/\bfatorial de\s+([0-9]+)/g, "factorial($1)")
      .replace(/([0-9]+)!/g, "factorial($1)")
      .replace(/(^|[^.])\bsqrt\s*\(/g, "$1Math.sqrt(")
      .replace(/(^|[^.])\bsin\s*\(/g, "$1Math.sin(")
      .replace(/(^|[^.])\bcos\s*\(/g, "$1Math.cos(")
      .replace(/(^|[^.])\btan\s*\(/g, "$1Math.tan(")
      .replace(/\^/g, "**")
      .replace(/[−–—]/g, "-")
      .replace(/([0-9.)]+)\s*:\s*([0-9.(]+)/g, "$1/$2")
      .replace(/=+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expr = expr.replace(/([0-9.)])\s+(?=[0-9.(])/g, "$1+");
    return expr;
  }

  function calculateExpression(text){
    const prepared = normalizeCalculation(text);
    const safe = prepared.replace(/[^0-9+\-*/%().,\sA-Za-z_]/g, "");
    const rest = safe.replace(/Math\.(PI|E|sqrt|cbrt|sin|cos|tan|log10|log|abs)/g, "").replace(/factorial/g, "");
    if(/[A-Za-z_]+/.test(rest)) return null;
    try{
      const result = Function('"use strict"; const factorial=(n)=>Number.isInteger(n)&&n>=0&&n<=170?(n<2?1:Array.from({length:n},(_,i)=>i+1).reduce((a,b)=>a*b,1)):NaN; return (' + safe + ')')();
      return Number.isFinite(result) ? Number(result.toFixed(10)) : null;
    }catch(err){
      return null;
    }
  }

  function isMathRequest(text){
    const value = normalize(text);
    const mathWords = /\b(quanto e|calcula|calcule|calcular|faca a conta|resolva|resultado|vezes|xis|multiplicad[oa]|multiplique|dividid[oa]|divida|mais|menos|some|somad[oa]|adicionad[oa]|subtraia|subtraid[oa]|produto|soma|diferenca|media|dobro|triplo|metade|raiz|quadrado|cubo|elevado|potencia|por cento|percentual|seno|cosseno|tangente|modulo|fatorial|log|ln)\b/;
    const symbolic = /(?:\d|\))\s*(?:\+|-|−|\*|\/|:|%|\^|×|÷|x)\s*(?:\d|\()|[√∛]|\d[²³!]/i;
    return mathWords.test(value) || symbolic.test(value);
  }

  function correctHeardCommand(text){
    return String(text || "")
      .replace(/\b(spotifai|espoti\s*fai|espotifai|spoti\s*fai|spo)\b/gi, "Spotify")
      .replace(/\b(ir[eo]n|airon|ayron|irem|iren)\s+(man+o?|men+o?|mano|manno|man)\b/gi, "Iron Man")
      .replace(/\b(homem\s+de\s+ferro)\b/gi, "Iron Man")
      .replace(/\bno\s+Spotify\b/gi, "no Spotify")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanSpotifyQueryText(text){
    return correctHeardCommand(text)
      .replace(/\b(ir[eo]n|airon|ayron|irem|iren)\s+(man+o?|men+o?|mano|manno|man)\b/gi, "Iron Man")
      .replace(/\b(no|na|pelo|pela)?\s*(spotify|spotifai|espoti\s*fai|espotifai|spoti\s*fai|spo)\b/gi, "")
      .replace(/\b(no|na|pelo|pela)\s+$/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractSpotifyQuery(text){
    return cleanSpotifyQueryText(text)
      .replace(/\b(tocar|toque|toca|reproduzir|reproduza|executar|execute|colocar|coloca|bota|botar|pesquise e toque|procure e toque)\b/gi, "")
      .replace(/\b(a|o|uma|um)\s+m[uú]sica\b/gi, "")
      .replace(/\bm[uú]sica\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractSpotifyPlaylistQuery(text){
    return cleanSpotifyQueryText(text)
      .replace(/\b(tocar|toque|toca|reproduzir|reproduza|executar|execute|colocar|coloca|bota|botar)\b/gi, "")
      .replace(/\b(minha|a|uma)?\s*playlist\b/gi, "")
      .replace(/\bno\s+spotify\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSpotifyPlaylistCommand(text){
    const t = normalize(correctHeardCommand(text));
    return /\b(playlist|mix)\b/.test(t) && /\b(tocar|toque|toca|reproduzir|reproduza|colocar|coloca|bota|botar)\b/.test(t);
  }

  function isSpotifyPlaybackCommand(text){
    const t = normalize(correctHeardCommand(text));
    const playVerb = /(tocar|toque|toca|reproduzir|reproduza|executar|execute|colocar|coloca|bota|botar|pesquise e toque|procure e toque)/;
    return (playVerb.test(t) && /(spotify|spotifai|espotifai|spo)/.test(t)) || new RegExp("^\\s*" + playVerb.source + "\\b").test(t);
  }

  function isSpotifyQueueCommand(text){
    const t = normalize(correctHeardCommand(text));
    return /\b(fila|proxima musica|proxima faixa|depois dessa|depois que essa|quando essa|quando terminar|quando acabar)\b/.test(t)
      && /\b(tocar|toque|colocar|coloque|bota|botar|reproduzir|reproduza)\b/.test(t);
  }

  function extractSpotifyQueueQuery(text){
    return cleanSpotifyQueryText(text)
      .replace(/\b(depois dessa musica|depois dessa música|depois que essa musica terminar|depois que essa música terminar|quando essa musica terminar|quando essa música terminar|quando terminar|quando acabar)\b/gi, "")
      .replace(/\b(coloque|colocar|bota|botar|toque|tocar|reproduza|reproduzir)\b/gi, "")
      .replace(/\b(na|nesta|nessa|proxima|próxima)\s+(fila|musica|música|faixa)\b/gi, "")
      .replace(/\bfila\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizedDistance(a, b){
    const left = normalize(a);
    const right = normalize(b);
    if(left === right) return 0;
    const max = Math.max(left.length, right.length, 1);
    let diff = Math.abs(left.length - right.length);
    const limit = Math.min(left.length, right.length);
    for(let i = 0; i < limit; i++){
      if(left[i] !== right[i]) diff++;
    }
    return diff / max;
  }

  function confirmationAnswer(text){
    const t = normalize(text);
    if(/^(sim|confirmar|confirmo|pode|pode sim|isso|correto|exato|executar|autorizar)\b/.test(t)) return "yes";
    if(/^(nao|não|cancelar|cancela|errado|negativo|para|pare)\b/.test(t)) return "no";
    return "";
  }

  function shouldConfirmVoiceCommand(heard, command){
    const t = normalize(command);
    const heardNorm = normalize(heard);
    const changed = normalizedDistance(heard, command) > 0.18;
    const suspiciousRaw = /\b(iren|irem|manno|mano|spo|spotifai|espotifai|ayron|airon)\b/.test(heardNorm);
    if(isSpotifyPlaybackCommand(command)){
      const query = extractSpotifyQuery(command);
      if(!query || query.length < 3) return {confirm: true, reason: "nome da música incompleto"};
      if(changed || suspiciousRaw) return {confirm: true, reason: "corrigi a transcrição da música"};
    }
    if(/\b(desligar|apagar|excluir|fechar)\b/.test(t) && changed){
      return {confirm: true, reason: "comando sensível corrigido"};
    }
    return {confirm: false, reason: ""};
  }

  function askSmartConfirmation(heard, command, reason){
    state.pendingSmartConfirmation = {
      heard,
      command,
      reason,
      createdAt: Date.now()
    };
    speak("Entendi: " + command + ". Confirmo?");
    setTimeout(() => {
      if(state.pendingSmartConfirmation && Date.now() - state.pendingSmartConfirmation.createdAt < 9000){
        armConfirmationReply();
      }
    }, 2600);
  }

  function getVolumeLevel(command){
    const t = normalize(command);
    const numberMatch = t.match(/\b(?:volume|som|audio|windows|colocar|definir|deixar|aumentar|diminuir|abaixar)\D{0,35}(\d{1,3})\s*%?\b/);
    if(numberMatch) return Math.max(0, Math.min(100, Number(numberMatch[1])));
    if(/\b(mudo|mutado|zero)\b/.test(t)) return 0;
    if(/\b(baixo|baixa|baixinho)\b/.test(t)) return 25;
    if(/\b(medio|media|normal)\b/.test(t)) return 50;
    if(/\b(alto|alta)\b/.test(t)) return 75;
    if(/\b(maximo|maxima|cem|100|total)\b/.test(t)) return 100;
    return null;
  }

  function isDirectVolumeCommand(command){
    const t = normalize(command);
    return /\b(volume|som|audio|windows)\b/.test(t) && getVolumeLevel(command) !== null;
  }

  function parseTimeTarget(text){
    let t = normalize(wordsToNumbers(text))
      .replace(/\bmeio dia\b/g, "meio-dia")
      .replace(/\bmeia noite\b/g, "meia-noite");
    const now = Date.now();
    const relativeSeconds = t.match(/(?:em|daqui a|de)\s+(\d+)\s*(?:seg|segundo)/);
    const relativeMinutes = t.match(/(?:em|daqui a|de|por)\s+(\d+)\s*(?:min|minuto)/);
    const relativeHours = t.match(/(?:em|daqui a|de|por)\s+(\d+)\s*horas?(?:\s+e\s+(?:meia|30\s*minutos?))?/);
    if(relativeSeconds) return now + Number(relativeSeconds[1]) * 1000;
    if(/(?:em|daqui a|de|por)\s+(?:meia hora|30\s*minutos?)/.test(t)) return now + 30 * 60000;
    if(/(?:em|daqui a|de|por)\s+(?:um quarto de hora|15\s*minutos?)/.test(t)) return now + 15 * 60000;
    if(relativeMinutes) return now + Number(relativeMinutes[1]) * 60000;
    if(relativeHours) return now + (Number(relativeHours[1]) * 60 + (/\be\s+(?:meia|30)/.test(relativeHours[0]) ? 30 : 0)) * 60000;

    let hour = null;
    let minute = 0;
    if(/\bmeio-dia\b/.test(t)){ hour = 12; if(/\bmeio-dia\s+e\s+meia\b/.test(t)) minute = 30; }
    else if(/\bmeia-noite\b/.test(t)){ hour = 0; if(/\bmeia-noite\s+e\s+meia\b/.test(t)) minute = 30; }
    const beforeMatch = t.match(/(\d{1,2})\s+(?:minutos?\s+)?(?:para|pras|para as)\s+(\d{1,2})/);
    if(beforeMatch){
      hour = (Number(beforeMatch[2]) + 23) % 24;
      minute = 60 - Math.min(59, Number(beforeMatch[1]));
    }
    const clockMatch = t.match(/\b(?:as|a|para as|pras|das|de)?\s*(\d{1,2})(?:(?::|h)\s*(\d{1,2}))?(?:\s*(?:horas?))?(?:\s+e\s+(meia|um quarto|quinze|trinta|quarenta e cinco|\d{1,2}))?\b/);
    if(hour === null && clockMatch && (
      /\b(?:alarme|despertador|acorde|horas?|as|para as|pras|das)\b/.test(t) ||
      /:\d{1,2}\b|\d{1,2}h\b/.test(t)
    )){
      hour = Number(clockMatch[1]);
      if(clockMatch[2]) minute = Number(clockMatch[2]);
      else if(clockMatch[3]){
        const part = clockMatch[3];
        minute = part === "meia" || part === "trinta" ? 30 : part === "um quarto" || part === "quinze" ? 15 : part === "quarenta e cinco" ? 45 : Number(part);
      }
    }
    if(hour === null) return null;
    if(/\b(?:da tarde|a tarde|de tarde|da noite|a noite|de noite)\b/.test(t) && hour < 12) hour += 12;
    if(/\b(?:da manha|de manha)\b/.test(t) && hour === 12) hour = 0;
    hour = Math.max(0, Math.min(23, hour));
    minute = Math.max(0, Math.min(59, minute));
    const target = new Date();
    target.setSeconds(0, 0);
    if(/\bamanha\b/.test(t)) target.setDate(target.getDate() + 1);
    target.setHours(hour, minute, 0, 0);
    if(!/\b(?:hoje|amanha)\b/.test(t) && target.getTime() <= now) target.setDate(target.getDate() + 1);
    return target.getTime();
  }

  function removeTimeText(text){
    return String(text || "")
      .replace(/\b(?:em|daqui a)\s+[a-záéíóúâêôãõç]+(?:\s+e\s+[a-záéíóúâêôãõç]+)?\s+(?:minutos?|horas?)\b/gi, value => wordsToNumbers(value))
      .replace(/\b(?:em|daqui a|de|por)\s+\d+\s+minutos?\b/gi, "")
      .replace(/\b(?:em|daqui a|de)\s+\d+\s+segundos?\b/gi, "")
      .replace(/\b(?:em|daqui a|de|por)\s+\d+\s+horas?\b/gi, "")
      .replace(/\b(?:as|às)\s+\d{1,2}(?::|h)?\d{0,2}\b/gi, "")
      .replace(/\b(?:às|as|para as|pras|das)?\s*(?:uma|um|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|\d{1,2})\s+e\s+(?:meia|um quarto|quinze|trinta|quarenta e cinco)\b/gi, "")
      .replace(/\b(?:hoje|amanhã|amanha)?\s*(?:ao\s+)?(?:meio-dia|meio dia|meia-noite|meia noite)(?:\s+e\s+meia)?\b/gi, "")
      .replace(/\b(?:hoje|amanhã|amanha|de manhã|da manhã|de tarde|da tarde|de noite|da noite)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseOwnerName(text){
    const source = String(text || "").trim();
    const normalized = normalize(source);
    if(/\b(?:qual|quem|como|sabe|lembra|diga|fala|pergunta)\b/.test(normalized) || source.includes("?")) return "";
    const match = source.match(/^\s*(?:me chame de|pode me chamar de|quero que me chame de)\s+([^?]+)/i);
    if(!match) return "";
    const name = match[1].replace(/[.,;!?]+$/g, "").trim();
    if(!name || name.length > 40 || !/^[A-Za-zÀ-ÿ' -]+$/.test(name)) return "";
    if(/\b(qual|quem|como|sabe|lembra|nome|ainda|enfim|afinal)\b/i.test(name)) return "";
    return name;
  }

  function parseAssistantName(text){
    const source = String(text || "").trim();
    const normalized = normalize(source);
    if(/\b(?:qual|quem|como|diga|fale|pergunta|sabe)\b/.test(normalized) || source.includes("?")) return "";
    const match = source.match(/^\s*(?:mude seu nome para|troque seu nome para|quero te chamar de|a partir de agora seu nome é|a partir de agora seu nome e)\s+(.+)/i);
    if(!match) return "";
    const name = match[1].replace(/[.,;!?]+$/g, "").trim();
    if(!name || name.length > 30 || !/^[A-Za-zÀ-ÿ' -]+$/.test(name)) return "";
    return name;
  }

  const LOCATION_ALIASES = {
    bh:'Belo Horizonte', sp:'São Paulo', rj:'Rio de Janeiro', ny:'New York',
    eua:'Washington DC', 'estados unidos':'Washington DC', portugal:'Lisboa',
    japao:'Tóquio', franca:'Paris', alemanha:'Berlim', italia:'Roma', espanha:'Madri',
    inglaterra:'Londres', 'reino unido':'Londres', china:'Pequim', 'coreia do sul':'Seul',
    argentina:'Buenos Aires', chile:'Santiago', uruguai:'Montevidéu', paraguai:'Assunção',
    canada:'Ottawa', australia:'Canberra', india:'Nova Deli', mexico:'Cidade do México',
    russia:'Moscou', turquia:'Ancara', egito:'Cairo', colombia:'Bogotá', peru:'Lima',
    bolivia:'La Paz', venezuela:'Caracas', 'africa do sul':'Pretória',
    'emirados arabes':'Dubai'
  };

  function resolveLocationAlias(location){
    const clean = String(location || '').replace(/[.!?]+$/g, '').trim();
    const key = normalize(clean).replace(/^(?:o|a|os|as)\s+/, '');
    return LOCATION_ALIASES[key] || clean;
  }

  function parseWeatherLocation(text){
    const value = normalize(text).replace(/[.!?]+$/g, '').trim();
    if(!/\b(previsao do tempo|clima|tempo|vai chover)\b/.test(value)) return null;
    const match = value.match(/\b(?:em|para)\s+(.+)$/);
    return match ? resolveLocationAlias(match[1]) : null;
  }

  function parseTrafficRoute(text){
    const source=String(text||"").trim(),normalized=normalize(source);
    if(!/\b(transito|trânsito|rota|quanto tempo|demora)\b/.test(normalized))return null;
    const match=source.match(/\b(?:até|ate|para|pra)\s+(.+?)(?:\s+(?:saindo|partindo)\s+(?:de|do|da)\s+(.+))?$/i);
    if(!match)return null;
    return {destination:match[1].trim().replace(/[.!?]+$/g,""),origin:(match[2]||"").trim()};
  }

  function parseHomeAssistantCommand(text){
    const source=String(text||"").trim(),value=normalize(source);
    let service="";
    if(/\b(acender|ligar|ative|ativar|abrir)\b/.test(value))service=/\babrir\b/.test(value)?"open_cover":"turn_on";
    else if(/\b(apagar|desligar|desative|desativar|fechar)\b/.test(value))service=/\bfechar\b/.test(value)?"close_cover":"turn_off";
    else if(/\b(executar|execute|rodar|rode|ativar cena|modo)\b/.test(value))service="trigger";
    if(!service||!/\b(luz|lampada|lâmpada|tomada|ventilador|cortina|persiana|cena|automacao|automação|casa|home assistant|modo)\b/.test(value))return null;
    const query=source.replace(/\b(acender|acenda|ligar|ligue|ative|ativar|apagar|apague|desligar|desligue|desative|desativar|abrir|abra|fechar|feche|executar|execute|rodar|rode)\b/gi,"").replace(/\b(?:a|o|as|os|do|da|no|na)\s+/gi," ").replace(/[.!?]+$/g,"").replace(/\s+/g," ").trim();
    return {service,query};
  }

  function parseRemoteTimeLocation(text){
    const value = normalize(text).replace(/[.!?]+$/g, '').trim();
    if(!/\b(que horas|qual a hora|qual e a hora|horario)\b/.test(value)) return null;
    const match = value.match(/\b(?:em|no|na|nos|nas)\s+(.+)$/);
    return match ? resolveLocationAlias(match[1].replace(/\s+agora$/, '')) : null;
  }

  function parseCityName(text){
    let match = String(text || "").match(/\bminha cidade (?:e|é)\s+(.+)/i);
    if(!match) match = String(text || "").match(/\b(?:mudar|configurar|definir)\s+cidade\s+(?:para\s+)?(.+)/i);
    if(!match) return null;
    const city = match[1].trim().replace(/[.!?]+$/, "");
    return city || null;
  }

  function parsePomodoroMinutes(text){
    const match = normalize(text).match(/(\d+)\s+min/);
    return Math.max(1, Math.min(180, match ? Number(match[1]) : 25));
  }

  function parseFileQuery(text){
    const match = String(text || "").match(/(?:onde esta|onde está|buscar|procure|procurar)\s+(?:o\s+)?(?:arquivo\s+)?(.+)/i);
    return match ? match[1].replace(/[.!?]+$/g, "").trim() : "";
  }

  function parseYoutubeQuery(text){
    const source = String(text || "");
    const action = "(?:toca|toque|tocar|abrir|abra|reproduzir|reproduza|coloque|coloca|bota|botar|poe|põe|procure|procura|procurar|pesquise|pesquisa|pesquisar|busque|busca|buscar|encontre|acha|quero ver|quero assistir|assista|mostrar|mostre)";
    const match = source.match(new RegExp(action + "\\s+(?:no\\s+|pelo\\s+)?youtube\\s+(?:por\\s+)?(.+)", "i"))
      || source.match(new RegExp(action + "\\s+(.+?)\\s+(?:no|pelo|na plataforma)\\s+youtube\\b", "i"))
      || source.match(new RegExp("\\b(?:no\\s+)?youtube\\s+" + action + "\\s+(?:por\\s+)?(.+)", "i"))
      || source.match(/^\s*(?:maia\s+)?youtube\s*[:,\-]?\s+(.+)/i);
    return match ? match[1].replace(/^(?:o|a|um|uma|por|sobre)\s+/i, "").replace(/[.!?]+$/g, "").trim() : "";
  }

  function parseExpense(text){
    const match = String(text || "").match(/(?:anota(?:r)? um gasto de|registrar gasto de|gastei)\s*(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:reais?)?(?:\s+(?:em|com|no|na)\s+(.+))?/i);
    if(!match) return null;
    return {
      value: Number(String(match[1]).replace(",", ".")),
      category: (match[2] || "geral").replace(/[.!?]+$/g, "").trim()
    };
  }

  function parseSalesPeriod(text){
    const value = normalize(text);
    if(/mes passado|mês passado|mes anterior|mês anterior/.test(value)) return "previous_month";
    if(/hoje|do dia|de hoje/.test(value)) return "today";
    if(/semana/.test(value)) return "week";
    if(/historico|histórico|total de vendas|desde o inicio|desde o início/.test(value)) return "all";
    return "month";
  }

  function parseLearnFact(text){
    const match = String(text || "").match(/(?:aprenda que|lembre que|guarde que|memorize que)\s+(.+)/i);
    return match ? match[1].replace(/[.;!?]+$/g, "").trim() : "";
  }

  function parseForgetFact(text){
    const match = String(text || "").match(/(?:esqueca que|esqueça que|apague da memoria|apague da memória|remova da memoria|remova da memória)\s+(.+)/i);
    return match ? match[1].replace(/[.;!?]+$/g, "").trim() : "";
  }

  function parseCapabilities(text){
    const match = String(text || "").match(/(?:suas capacidades sao|suas capacidades são|voce consegue|você consegue|suas funcoes sao|suas funções são)\s+(.+)/i);
    if(!match) return null;
    return match[1]
      .split(/\s*,\s*|\s+e\s+/i)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function parseCustomCommand(text){
    const match = String(text || "").match(/(?:quando eu disser|quando eu falar|se eu disser|se eu falar)\s+(.+?)\s+(?:faça|faca|execute|rode)\s+(.+)/i);
    if(!match) return null;
    const trigger = match[1].replace(/^["']|["']$/g, "").trim();
    const action = match[2].replace(/^["']|["']$/g, "").trim();
    if(!trigger || !action) return null;
    return {trigger, action};
  }

  function memoryKey(text){
    return normalize(text).replace(/\s+/g, " ").trim();
  }

  function parseBrightnessLevel(command){
    const t = normalize(command);
    const numberMatch = t.match(/\b(?:brilho|tela)\D{0,30}(\d{1,3})\s*%?\b/);
    if(numberMatch) return Math.max(0, Math.min(100, Number(numberMatch[1])));
    if(/\b(baixo|baixa)\b/.test(t)) return 30;
    if(/\b(medio|media|normal)\b/.test(t)) return 55;
    if(/\b(alto|alta|maximo|maxima)\b/.test(t)) return 85;
    return null;
  }

  function isBrightnessCommand(command){
    const t = normalize(command);
    return /\b(brilho|tela)\b/.test(t) && parseBrightnessLevel(command) !== null;
  }

  function parseScheduledAction(command){
    const t = normalize(command);
    const dueAt = parseTimeTarget(command);
    if(!dueAt) return null;
    if(/\b(desligar|desligue)\b.*\b(pc|computador|windows|sistema)?\b/.test(t)){
      return {type:"system.shutdown", dueAt, label:"desligar o computador"};
    }
    if(/\b(abrir|abra|iniciar)\b/.test(t)){
      return {type:"system.open", dueAt, label:removeTimeText(command), program: parseProgramForSchedule(command)};
    }
    return null;
  }

  function parseProgramForSchedule(text){
    const t = normalize(text);
    if(/\bspotify\b/.test(t)) return "spotify";
    if(/\bcamera|câmera|webcam\b/.test(t)) return "camera";
    if(/\bchrome|navegador\b/.test(t)) return "chrome";
    if(/\bedge\b/.test(t)) return "edge";
    if(/\b(vs code|vscode|visual studio code)\b/.test(t)) return "vs code";
    const clean = removeTimeText(text);
    const match = clean.match(/(?:abrir|abra|iniciar)\s+(.+)/i);
    return match ? match[1].trim() : "";
  }

  const clockNowEl = document.getElementById("brainClockNow");
  const clockListEl = document.getElementById("brainClockList");
  const clockWhenEl = document.getElementById("brainClockWhen");
  const clockMessageEl = document.getElementById("brainClockMessage");
  const clockTypeEl = document.getElementById("brainClockType");
  let lastFiredClockItem = null;

  function updateClockNow(){
    if(!clockNowEl) return;
    const now = new Date();
    clockNowEl.textContent = now.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit", second:"2-digit"}) +
      " • " + now.toLocaleDateString("pt-BR", {weekday:"long", day:"2-digit", month:"long", year:"numeric"}) +
      " • relógio do Windows";
  }

  async function refreshClockPanel(){
    updateClockNow();
    if(!clockListEl || !window.maiaDesktop || !window.maiaDesktop.listClockItems) return;
    const items = await window.maiaDesktop.listClockItems().catch(() => []);
    const active = items.filter(item => !item.done && Number(item.dueAt) > Date.now()).slice(0, 12);
    clockListEl.replaceChildren();
    if(!active.length){
      clockListEl.textContent = "Nenhum alarme futuro.";
      return;
    }
    for(const item of active){
      const row = document.createElement("div");
      row.className = "brain-field";
      const text = document.createElement("span");
      text.style.flex = "1";
      const repeatText = item.recurrence === "daily" ? " • todo dia" : item.recurrence === "weekdays" ? " • dias úteis" : "";
      text.textContent = new Date(item.dueAt).toLocaleString("pt-BR") + repeatText + " — " + (item.message || item.label);
      const remove = document.createElement("button");
      remove.className = "brain-save";
      remove.type = "button";
      remove.textContent = "EXCLUIR";
      remove.addEventListener("click", async () => {
        await window.maiaDesktop.removeClockItem(item.id);
        const local = state.reminders.find(entry => entry.id === item.id);
        if(local) local.done = true;
        saveMemory();
        refreshClockPanel();
      });
      row.append(text, remove);
      clockListEl.append(row);
    }
  }

  if(clockWhenEl){
    const initial = new Date(Date.now() + 5 * 60000);
    initial.setSeconds(0, 0);
    clockWhenEl.value = new Date(initial.getTime() - initial.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  document.getElementById("brainClockAdd").addEventListener("click", async () => {
    const dueAt = new Date(clockWhenEl.value).getTime();
    if(!Number.isFinite(dueAt) || dueAt <= Date.now()){
      clockListEl.textContent = "Escolha uma data e um horário futuros.";
      return;
    }
    const type = clockTypeEl.value;
    const message = clockMessageEl.value.trim() || (type === "reminder" ? "Lembrete programado" : "Horário programado");
    const scheduled = MaiaKernel.addSchedule({type, message, label:message, dueAt});
    clockMessageEl.value = "";
    await refreshClockPanel();
    brainOutput.textContent = (type === "reminder" ? "Lembrete" : type === "timer" ? "Temporizador" : "Alarme") +
      " configurado para " + new Date(scheduled.dueAt).toLocaleString("pt-BR") + ".";
  });
  document.getElementById("brainClockRefresh").addEventListener("click", refreshClockPanel);
  document.getElementById("brainWindowsClockOpen").addEventListener("click", async () => {
    const result = window.maiaDesktop && await window.maiaDesktop.openWindowsClock();
    brainOutput.textContent = result && result.ok ? "Abrindo o Relógio do Windows." : "Não foi possível abrir o Relógio do Windows.";
  });
  if(window.maiaDesktop && window.maiaDesktop.onClockFired){
    window.maiaDesktop.onClockFired((item) => {
      lastFiredClockItem = item;
      const local = state.reminders.find(entry => entry.id === item.id);
      if(local){
        if(item.nextDueAt){ local.done = false; local.dueAt = item.nextDueAt; local.lastFiredAt = new Date().toISOString(); }
        else{ local.done = true; local.doneAt = new Date().toISOString(); }
        saveMemory();
      }
      playAlarmSound(item.type);
      if(item.type === "alarm" || item.type === "timer") setVisualMode("combat");
      const clockMessage = item.type === "reminder"
        ? "Só para lembrar: " + item.message + "."
        : item.type === "timer"
          ? "O tempo acabou, " + ownerTitle() + ". " + (item.message && item.message !== "Horário programado" ? item.message + "." : "")
          : greeting() + ", " + ownerTitle() + ". São " + shortSpokenClock(new Date()) + ". " +
            (item.message && !/^(despertador|horário programado)$/i.test(item.message) ? item.message + "." : "Seu despertador está tocando.");
      activeAlarmSpeechTimer = setTimeout(() => {
        activeAlarmSpeechTimer = null;
        speak(clockMessage);
      }, item.type === "reminder" ? 500 : 950);
      refreshClockPanel();
    });
  }
  if(window.maiaDesktop && window.maiaDesktop.onClockStopped){
    window.maiaDesktop.onClockStopped(stopAlarmSound);
  }
  if(window.maiaDesktop && window.maiaDesktop.onConnectTheme){
    window.maiaDesktop.onConnectTheme((theme) => {
      applyTheme20(theme);
      brainOutput.textContent = "Tema alterado pelo Maia Connect: " + (brainTheme.options[brainTheme.selectedIndex] && brainTheme.options[brainTheme.selectedIndex].textContent || theme) + ".";
    });
  }
  if(window.maiaDesktop && window.maiaDesktop.onConnectRoutine){
    window.maiaDesktop.onConnectRoutine((name) => {
      const presets={work:["modo foco","volume 45","abrir vs code"],game:["modo combate","volume 70"],night:["modo repouso","volume 25"],cinema:["modo repouso","volume 55","abrir prime video"],presentation:["modo foco","volume 65"]};
      const commands=state.routines.saved[name]||presets[name]||[];
      if(commands.length) runRoutine20(commands,name);
      else brainOutput.textContent="Rotina solicitada pelo celular não encontrada: "+name+".";
    });
  }
  setInterval(updateClockNow, 1000);

  const MaiaKernel = (() => {
    const context = JSON.parse(localStorage.getItem("maia.kernel.context") || "{}");
    const pendingPermissions = new Map();

    const commandBank = [
      {intent:"help", synonyms:["ajuda","comandos","o que voce faz"]},
      {intent:"time", synonyms:["que horas sao","horas agora"]},
      {intent:"date", synonyms:["data de hoje","que dia e hoje"]},
      {intent:"speech.mode.formal", synonyms:["modo formal","fala formal","fale formal","modo serio","modo sério","fala comigo formal"]},
      {intent:"speech.mode.casual", synonyms:["modo casual","modo descontraido","modo descontraído","fala casual","fale casual","modo informal","fala comigo casual"]},
      {intent:"speech.mode.sarcastic", synonyms:["modo sarcastico","modo sarcástico","fala sarcastico","fala sarcástico","fale sarcastico","fale sarcástico","modo debochado"]},
      {intent:"speech.test", synonyms:["teste de voz","testar voz","como esta sua voz","como está sua voz"]},
      {intent:"weather.current", synonyms:["como esta o tempo","como está o tempo","qual o clima","previsao do tempo","previsão do tempo","vai chover","esta calor","está calor","esta frio","está frio"]},
      {intent:"weather.forecast", synonyms:["previsao para semana","previsão dos próximos dias","clima da semana"]},
      {intent:"traffic.route", synonyms:["como esta o transito","como está o trânsito","rota para","quanto tempo ate"]},
      {intent:"location.city.set", synonyms:["minha cidade e","minha cidade é","mudar cidade para","configurar cidade","definir cidade"]},
      {intent:"fun.joke", synonyms:["conte uma piada","me conta uma piada","piada de programador","conte algo engracado"]},
      {intent:"fun.fact", synonyms:["fato aleatorio","me diga uma curiosidade","curiosidade aleatoria","conte uma curiosidade"]},
      {intent:"fun.coin", synonyms:["cara ou coroa","jogue uma moeda","jogar moeda"]},
      {intent:"fun.dice", synonyms:["role um dado","jogue um dado","rolar dado","tirar um dado","jogue 2d6","dado de 20"]},
      {intent:"fun.choose", synonyms:["escolha entre","decida entre","o que eu escolho"]},
      {intent:"fun.compliment", synonyms:["me elogie","diga algo legal para mim","me diga algo bom","me elogia"]},
      {intent:"motivation", synonyms:["me motive","me motiva","preciso de motivacao","preciso de motivação","frase de motivacao","frase de motivação","motivacao do dia","motivação do dia"]},
      {intent:"success.phrase", synonyms:["frase de sucesso","fale sobre sucesso","mensagem de sucesso","me diga uma frase de sucesso","celebre comigo"]},
      {intent:"fun.insult", synonyms:["me xingue","me ofenda","me zoa"]},
      {intent:"fun.selfdestruct", synonyms:["autodestruicao","autodestruição","iniciar autodestruicao","modo autodestruicao"]},
      {intent:"fun.meaning", synonyms:["qual o sentido da vida","sentido da vida","qual e o sentido da vida"]},
      {intent:"fun.feelings", synonyms:["voce tem sentimentos","voce sente algo","voce tem emocoes"]},
      {intent:"fun.age", synonyms:["quantos anos voce tem","qual sua idade","que idade voce tem"]},
      {intent:"fun.hungry", synonyms:["voce esta com fome","voce come","voce tem fome"]},
      {intent:"fun.fortune", synonyms:["sorte de hoje","minha sorte hoje","horoscopo","meu horoscopo"]},
      {intent:"fun.dance", synonyms:["danca maia","faca uma danca","dance para mim"]},
      {intent:"fun.fanfare", synonyms:["toque uma fanfarra","toque um som de vitoria","comemore"]},
      {intent:"fun.surprise", synonyms:["me surpreenda","faca algo aleatorio","surpreenda-me"]},
      {intent:"focus.pomodoro", synonyms:["inicia um pomodoro","começar pomodoro","pomodoro de 25 minutos","modo pomodoro"]},
      {intent:"agenda.today", synonyms:["o que eu tenho hoje","agenda de hoje","resumo do dia","compromissos de hoje"]},
      {intent:"meeting.join", synonyms:["entrar na reuniao","entrar na reunião","abrir reunião","abrir meet","abrir teams","abrir zoom"]},
      {intent:"system.lock", permission:"danger", synonyms:["trava o pc","travar o pc","bloquear tela","bloquear a tela","bloquear o computador","bloqueia o computador","bloqueie o computador"]},
      {intent:"system.sleep", permission:"danger", synonyms:["hibernar pc","colocar pc para dormir","suspender computador"]},
      {intent:"system.restart", permission:"danger", synonyms:["reiniciar pc","reinicie o computador","reiniciar computador"]},
      {intent:"network.status", synonyms:["como esta minha internet","como está minha internet","status da internet","testar internet"]},
      {intent:"monitor.create", synonyms:["me avise se a cpu","avise quando a bateria","monitorar memoria","monitorar memória"]},
      {intent:"monitor.list", synonyms:["meus alertas do sistema","listar alertas do computador"]},
      {intent:"window.organize", synonyms:["organiza as janelas","organizar janelas","arrumar janelas"]},
      {intent:"file.search", synonyms:["onde esta o arquivo","onde está o arquivo","buscar arquivo","procure o arquivo"]},
      {intent:"downloads.list", synonyms:["meus downloads","ultimos downloads","últimos downloads","o que baixei","listar downloads"]},
      {intent:"downloads.openLatest", synonyms:["abrir ultimo download","abrir último download","abra o que baixei"]},
      {intent:"youtube.play", synonyms:["toca no youtube","toque no youtube","reproduza no youtube","abrir no youtube"]},
      {intent:"youtube.search", synonyms:["procure no youtube","pesquise no youtube","busque no youtube","encontre no youtube","pesquisa no youtube"]},
      {intent:"youtube.open", synonyms:["abrir youtube","abra o youtube","iniciar youtube"]},
      {intent:"youtube.pause", synonyms:["pausar youtube","pause o youtube"]},
      {intent:"youtube.resume", synonyms:["continuar youtube","retomar youtube"]},
      {intent:"youtube.next", synonyms:["proximo video","próximo vídeo do youtube"]},
      {intent:"youtube.previous", synonyms:["video anterior","vídeo anterior do youtube"]},
      {intent:"youtube.fullscreen", synonyms:["youtube tela cheia","colocar video em tela cheia"]},
      {intent:"finance.expense.add", synonyms:["anota um gasto","registrar gasto","gastei"]},
      {intent:"finance.summary", synonyms:["quanto eu gastei esse mes","quanto gastei esse mês","resumo de gastos"]},
      {intent:"sales.summary", synonyms:["quanto vendi este mes","quanto vendi este mês","vendas de hoje","vendas da semana","resumo de vendas","faturamento do mes","faturamento do mês","ticket medio","ticket médio","produto mais vendido","maior venda"]},
      {intent:"quote.usd", synonyms:["quanto esta o dolar","quanto está o dólar","cotacao do dolar","cotação do dólar"]},
      {intent:"security.password", synonyms:["gera uma senha forte","gerar senha forte","criar senha segura"]},
      {intent:"smart.home.control", synonyms:["ligar luz","acender luz","modo cinema","casa inteligente","ligar tomada","executar automacao"]},
      {intent:"email.info", synonyms:["tem email novo","ler emails","resumo dos emails"]},
      {intent:"spotify.play", synonyms:["tocar musica","reproduzir musica","toque no spotify","tocar no spotify"]},
      {intent:"spotify.queue", synonyms:["coloque na fila","adicionar na fila","depois dessa musica","depois dessa música","quando essa acabar"]},
      {intent:"spotify.login", synonyms:["conectar spotify","login spotify","autorizar spotify"]},
      {intent:"spotify.current", synonyms:["que musica esta tocando","qual musica esta tocando","quanto falta para acabar"]},
      {intent:"speech.helper.open", synonyms:["abrir voz online","iniciar voz online","abrir microfone online"]},
      {intent:"spotify.open", synonyms:["abrir spotify","abra spotify"]},
      {intent:"volume.set", synonyms:["volume baixo","volume medio","volume alto","volume cem","volume maximo"]},
      {intent:"volume.up", synonyms:["aumentar volume","aumenta o som","mais alto","subir o volume","volume para cima"]},
      {intent:"volume.down", synonyms:["diminuir volume","abaixar volume","baixa o som","mais baixo","reduzir o volume","volume para baixo"]},
      {intent:"volume.mute", synonyms:["mutar","silenciar","tirar som","ficar sem som"]},
      {intent:"media.pause", synonyms:["pausar","pause","pausar musica","parar musica","segura a musica"]},
      {intent:"media.resume", synonyms:["despausar musica","continuar musica","retomar musica","voltar a tocar","dar play","pode continuar"]},
      {intent:"media.next", synonyms:["proxima musica","próxima faixa","avancar musica","avançar","pular musica","pula essa","passa essa","trocar musica","skip"]},
      {intent:"media.previous", synonyms:["musica anterior","faixa anterior","voltar musica","volta uma","a de antes"]},
      {intent:"system.open", synonyms:["abrir chrome","abrir edge","abrir vs code","abrir calculadora","abrir bloco de notas","abrir camera","abrir câmera","iniciar camera","iniciar câmera","abrir webcam"]},
      {intent:"system.close", permission:"closeProgram", synonyms:["fechar ele","feche ele","fechar programa","fechar camera","fechar câmera","fechar webcam"]},
      {intent:"note.create", synonyms:["anote","adicione nota","guarde a nota"]},
      {intent:"task.create", synonyms:["crie uma tarefa","nova tarefa","adicione tarefa"]},
      {intent:"reminder.create", synonyms:["me lembre","lembre me","lembrar"]},
      {intent:"alarm.create", synonyms:["despertador","alarme","me acorde","acorde me","criar alarme","colocar despertador"]},
      {intent:"timer.create", synonyms:["temporizador","criar temporizador","coloque um temporizador","timer de","contagem regressiva","cronometro de","cronômetro de"]},
      {intent:"alarm.stop", synonyms:["parar alarme","pare o alarme","desligar despertador","silenciar alarme"]},
      {intent:"alarm.cancel", synonyms:["cancelar alarme","excluir despertador","apagar alarme","remover despertador"]},
      {intent:"alarm.list", synonyms:["listar alarmes","quais alarmes","proximos despertadores","meus alarmes"]},
      {intent:"alarm.snooze", synonyms:["adiar alarme","soneca","mais cinco minutos","despertar depois"]},
      {intent:"memory.name.set", synonyms:["me chame de","pode me chamar de","quero que me chame de"]},
      {intent:"memory.assistant.name.set", synonyms:["seu nome e","seu nome é","voce se chama"]},
      {intent:"memory.learn", synonyms:["aprenda que","lembre que","guarde que","memorize que"]},
      {intent:"memory.forget", synonyms:["esqueca que","esqueça que","apague da memoria","remova da memoria"]},
      {intent:"memory.capabilities.set", synonyms:["suas capacidades sao","suas capacidades são","voce consegue"]},
      {intent:"memory.whoami", synonyms:["quem sou eu","qual e meu nome","qual é meu nome","qual e o meu nome","qual é o meu nome","qual meu nome","diga meu nome"]},
      {intent:"memory.assistant.identity", synonyms:["qual e seu nome","qual é seu nome","qual e o seu nome","qual é o seu nome","qual e o nome dela","qual é o nome dela","como voce se chama","como você se chama","diga seu nome","quem e voce","quem é você"]},
      {intent:"memory.capabilities", synonyms:["quais sao suas capacidades","quais são suas capacidades","o que voce consegue fazer"]},
      {intent:"memory.custom.create", synonyms:["quando eu disser","quando eu falar"]},
      {intent:"memory.summary", synonyms:["minha memoria","o que voce sabe sobre mim","preferencias"]},
      {intent:"personality.creator", synonyms:["quem te criou","quem criou voce","quem criou você","quem fez voce"]},
      {intent:"personality.real", synonyms:["voce e o maia de verdade","você é o maia de verdade","voce e real","voce esta vivo"]},
      {intent:"personality.protocol", synonyms:["qual e seu protocolo","modo confirmacao","modo confirmação","voce aprende sozinho"]},
      {intent:"macro.work", synonyms:["modo trabalho","iniciar modo trabalho"]},
      {intent:"macro.game", synonyms:["modo jogo","iniciar modo jogo"]},
      {intent:"macro.night", synonyms:["modo noite","boa noite maia"]},
      {intent:"macro.cinema", synonyms:["modo cinema","iniciar modo cinema"]},
      {intent:"macro.meeting", synonyms:["modo reuniao","modo reunião","preparar reuniao","preparar reunião"]},
      {intent:"macro.study", synonyms:["modo estudo","iniciar estudo","perfil estudo"]},
      {intent:"macro.boot", synonyms:["sequencia de boot","sequência de boot","reiniciar boot","reiniciar interface","inicializar maia"]},
      {intent:"demo.orbit", synonyms:["me mostre uma demonstracao","me mostre uma demonstração","faca uma demonstracao","faça uma demonstração","mostra uma demonstracao","modo demonstracao","modo demonstração","demonstre suas capacidades"]},
      {intent:"news.today", synonyms:["noticia do dia","notícia do dia","quais as noticias","quais as notícias","me conta as noticias","me conta as notícias","resumo das noticias","resumo das notícias","tem noticia nova","tem notícia nova"]},
      {intent:"visual.focus", synonyms:["modo foco","ativar modo foco","interface foco"]},
      {intent:"visual.combat", synonyms:["modo combate","ativar modo combate","interface combate"]},
      {intent:"visual.rest", synonyms:["modo repouso","ativar modo repouso","interface repouso"]},
      {intent:"visual.default", synonyms:["modo padrao","modo padrão","interface normal"]},
      {intent:"clipboard.read", synonyms:["ler area de transferencia","ler área de transferência","o que esta copiado","o que está copiado"]},
      {intent:"screenshot.capture", synonyms:["capturar tela","tirar print","print da tela","salvar captura"]},
      {intent:"schedule.create", synonyms:["agende","programar","às"]},
      {intent:"system.shutdown", permission:"danger", synonyms:["desligar computador","desligue o pc","desligar pc"]},
      {intent:"brightness.set", synonyms:["brilho baixo","brilho medio","brilho alto"]}
    ];

    function saveContext(){
      localStorage.setItem("maia.kernel.context", JSON.stringify(context));
    }

    function splitComposite(text){
      return String(text || "")
        .split(/\s*(?:;|\be depois\b|\bdepois\b|\be\s+(?=(?:abra|abrir|inicie|iniciar|aumente|aumentar|abaixe|baixar|coloque|ativar|ative|pause|pausar|continue|continuar|feche|fechar|toque|tocar|mude|mudar|ajuste|ajustar)\b))\s*/i)
        .map(part => part.trim())
        .filter(Boolean);
    }

    function similarityScore(text, entry){
      const t = normalize(text);
      let best = 0;
      for(const synonym of entry.synonyms){
        const s = normalize(synonym);
        if(t.includes(s)) best = Math.max(best, 96);
        else{
          const words = s.split(/\s+/).filter(Boolean);
          const hits = words.filter(word => t.includes(word)).length;
          best = Math.max(best, Math.round((hits / Math.max(words.length, 1)) * 80));
        }
      }
      return best;
    }

    function parseProgram(text){
      const t = normalize(text);
      if(/\b(chrome|navegador)\b/.test(t)) return "chrome";
      if(/\bedge\b/.test(t)) return "edge";
      if(/\b(vs code|vscode|visual studio code)\b/.test(t)) return "vs code";
      if(/\b(calculadora)\b/.test(t)) return "calculadora";
      if(/\b(bloco de notas|notepad)\b/.test(t)) return "bloco de notas";
      if(/\b(camera|webcam)\b/.test(t)) return "camera";
      if(/\bspotify\b/.test(t)) return "spotify";
      if(/\bele\b/.test(t) && context.lastProgram) return context.lastProgram;
      const match = text.match(/(?:abrir|abra|iniciar|execute|executar|fechar|feche)\s+(.+)/i);
      return match ? match[1].trim() : "";
    }

    function parseStreamingService(text){
      const t = normalize(text);
      if(/\b(prime video|amazon prime|prime)\b/.test(t)) return "prime";
      if(/\bnetflix\b/.test(t)) return "netflix";
      if(/\b(disney plus|disney)\b/.test(t)) return "disney";
      if(/\b(hbo max|max)\b/.test(t)) return "max";
      if(/\bgloboplay\b/.test(t)) return "globoplay";
      if(/\b(paramount plus|paramount)\b/.test(t)) return "paramount";
      if(/\bcrunchyroll\b/.test(t)) return "crunchyroll";
      if(/\bplex\b/.test(t)) return "plex";
      return "";
    }

    function parseStreamingQuery(text){
      return String(text || "")
        .replace(/^\s*(?:maia\s+)?(?:abra|abrir|inicie|iniciar|assista|assistir|reproduza|reproduzir|procure|buscar|busque|pesquise|continuar|continue|retomar|retome)\s*/i, "")
        .replace(/\s+(?:no|na|em|pelo|pela)\s+(?:prime video|amazon prime|prime|netflix|disney\+?|disney plus|hbo max|max|globoplay|paramount\+?|paramount plus|crunchyroll|plex)\s*$/i, "")
        .replace(/^(?:o|a|um|uma|meu|minha)\s+/i, "")
        .trim();
    }

    function parseReminder(text){
      const dueAt = parseTimeTarget(text);
      const message = removeTimeText(text)
        .replace(/^\s*(?:maia\s+)?(?:me lembre|lembre me|lembrar)(?:\s+de)?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim() || "lembrete";
      return {message, dueAt, delay: dueAt ? dueAt - Date.now() : null};
    }

    function reminderScheduleText(reminder){
      const delay = Math.max(0, Number(reminder && reminder.delay) || 0);
      if(delay < 60 * 60 * 1000){
        const minutes = Math.max(1, Math.round(delay / 60000));
        return "em " + minutes + (minutes === 1 ? " minuto" : " minutos");
      }
      if(delay < 12 * 60 * 60 * 1000 && delay % (60 * 60 * 1000) < 60000){
        const hours = Math.round(delay / 3600000);
        return "em " + hours + (hours === 1 ? " hora" : " horas");
      }
      return "às " + new Date(reminder.dueAt).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
    }

    function parseAlarm(text){
      let dueAt = parseTimeTarget(text);
      if(!dueAt) return null;
      const normalized = normalize(text);
      const recurrence = /\b(?:todo dia|todos os dias|diariamente)\b/.test(normalized) ? "daily" :
        /\b(?:dias uteis|dias úteis|segunda a sexta|de segunda a sexta)\b/.test(normalized) ? "weekdays" : null;
      if(recurrence === "weekdays"){
        const first = new Date(dueAt);
        while(first.getDay() === 0 || first.getDay() === 6) first.setDate(first.getDate() + 1);
        dueAt = first.getTime();
      }
      const message = removeTimeText(text)
        .replace(/despertador|alarme|me acorde|acorde me|acordar|criar|colocar|definir|para\b|todo dia|todos os dias|diariamente|dias úteis|dias uteis|de segunda a sexta/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "despertador";
      return {type:"alarm", message, dueAt, label:message, recurrence};
    }

    function parseTimer(text){
      const dueAt = parseTimeTarget(text);
      if(!dueAt) return null;
      const message = removeTimeText(text)
        .replace(/temporizador|timer|cronometro|cronômetro|contagem regressiva|coloque|inicie|iniciar|para\b/gi, "")
        .replace(/\s+/g, " ").trim() || "Temporizador concluído";
      return {type:"timer", message, dueAt, label:message};
    }

    function scheduleItem(item){
      if(!item || !item.id || !item.dueAt) return;
      if(item.done) return;
      if(window.maiaDesktop && window.maiaDesktop.addClockItem && ["alarm", "timer", "reminder"].includes(item.type)){
        window.maiaDesktop.addClockItem(item);
        return;
      }
      const delay = Number(item.dueAt) - Date.now();
      if(delay <= 0){
        runScheduledItem(item);
        return;
      }
      const maxDelay = 2147483647;
      setTimeout(() => scheduleItem(item), Math.min(delay, maxDelay));
    }

    async function runScheduledItem(item){
      if(!item || item.done) return;
      item.done = true;
      item.doneAt = new Date().toISOString();
      saveMemory();
      if(item.type === "reminder"){
        speak("Lembre-se de " + item.message + ", senhor.");
        return;
      }
      if(item.type === "alarm"){
        playAlarmSound();
        setVisualMode("combat");
        speak("Despertador acionado, " + ownerTitle() + ". " + (item.message || "Horário programado."));
        return;
      }
      if(item.type === "system.open"){
        await callBridge("system.openProgram", {program: item.program});
        speak("Agendamento executado. Abrindo " + item.program + ".");
        return;
      }
      if(item.type === "system.shutdown"){
        speak("Agendamento confirmado. Desligando o computador.");
        await callBridge("system.shutdown", {seconds: 30});
      }
    }

    function addSchedule(item){
      const scheduled = {
        id: "sch-" + Date.now() + "-" + Math.random().toString(16).slice(2),
        createdAt: new Date().toISOString(),
        done: false,
        ...item
      };
      state.reminders.unshift(scheduled);
      state.reminders = state.reminders.slice(0, 80);
      saveMemory();
      scheduleItem(scheduled);
      return scheduled;
    }

    function loadSchedules(){
      const active = [];
      for(const item of state.reminders){
        if(item && !item.done && Number(item.dueAt) > Date.now()){
          active.push(item);
          scheduleItem(item);
        }
      }
      state.reminders = active.concat(state.reminders.filter(item => item.done).slice(0, 30));
      saveMemory();
      refreshClockPanel();
    }

    const WEATHER_CODES = {
      0:"céu limpo", 1:"poucas nuvens", 2:"parcialmente nublado", 3:"nublado",
      45:"neblina", 48:"neblina com geada",
      51:"garoa fraca", 53:"garoa moderada", 55:"garoa forte",
      61:"chuva fraca", 63:"chuva moderada", 65:"chuva forte",
      71:"neve fraca", 73:"neve moderada", 75:"neve forte",
      80:"pancadas de chuva fracas", 81:"pancadas de chuva moderadas", 82:"pancadas de chuva fortes",
      95:"tempestade", 96:"tempestade com granizo", 99:"tempestade forte com granizo"
    };
    const WEATHER_FALLBACK_COORDS = {lat:-23.5505, lon:-46.6333, label:"São Paulo"};
    let cachedWeatherCoords = null;
    let cachedCityCoords = null;

    async function geocodeCity(city){
      const query = String(city || "").trim();
      if(!query) return null;
      if(cachedCityCoords && normalize(cachedCityCoords.query) === normalize(query)) return cachedCityCoords;
      const url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query) + "&count=1&language=pt&format=json";
      const response = await fetch(url, {cache:"no-store"});
      if(!response.ok) return null;
      const data = await response.json();
      const found = data && Array.isArray(data.results) && data.results[0] ? data.results[0] : null;
      if(!found || found.latitude == null || found.longitude == null) return null;
      cachedCityCoords = {
        query,
        city: found.name,
        lat: found.latitude,
        lon: found.longitude,
        timezone: found.timezone,
        label: [found.name, found.admin1, found.country_code].filter(Boolean).join(", ")
      };
      return cachedCityCoords;
    }

    async function getWeatherCoords(requestedCity){
      if(requestedCity){
        const requestedCoords = await geocodeCity(requestedCity);
        if(!requestedCoords) throw new Error('cidade não encontrada');
        return requestedCoords;
      }
      if(state.preferences.city){
        try{
          const cityCoords = await geocodeCity(state.preferences.city);
          if(cityCoords) return cityCoords;
        }catch(err){}
      }
      return new Promise((resolve) => {
        if(cachedWeatherCoords){ resolve(cachedWeatherCoords); return; }
        if(!navigator.geolocation){ resolve(WEATHER_FALLBACK_COORDS); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            cachedWeatherCoords = {lat:pos.coords.latitude, lon:pos.coords.longitude, label:"sua localização"};
            resolve(cachedWeatherCoords);
          },
          () => resolve(WEATHER_FALLBACK_COORDS),
          {timeout:4500, maximumAge:600000}
        );
      });
    }

    async function getCurrentWeather(requestedCity){
      const coords = await getWeatherCoords(requestedCity);
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(coords.lat) +
        "&longitude=" + encodeURIComponent(coords.lon) +
        "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=auto";
      const response = await fetch(url, {cache:"no-store"});
      if(!response.ok) throw new Error("clima indisponivel");
      const data = await response.json();
      const current = data.current || {};
      const hourlyTimes = Array.isArray(data.hourly && data.hourly.time) ? data.hourly.time : [];
      const hourlyRain = Array.isArray(data.hourly && data.hourly.precipitation_probability)
        ? data.hourly.precipitation_probability
        : [];
      const currentHour = String(current.time || '').slice(0, 13);
      const currentHourIndex = hourlyTimes.findIndex(time => String(time || '').slice(0, 13) >= currentHour);
      const rainStartIndex = currentHourIndex >= 0 ? currentHourIndex : 0;
      const nextEightHoursRain = hourlyRain
        .slice(rainStartIndex, rainStartIndex + 8)
        .map(Number)
        .filter(Number.isFinite);
      const rain = nextEightHoursRain.length ? Math.max(...nextEightHoursRain) : 0;
      return {
        label: coords.label || "sua localização",
        temp: Math.round(Number(current.temperature_2m)),
        humidity: Math.round(Number(current.relative_humidity_2m)),
        wind: Math.round(Number(current.wind_speed_10m)),
        condition: WEATHER_CODES[current.weather_code] || "condição não identificada",
        rain
      };
    }

    const FUN_JOKES = [
      "Por que o programador foi ao médico? Porque ele estava com um bug no sistema.",
      "Quantos programadores são necessários para trocar uma lâmpada? Nenhum, isso é problema de hardware.",
      "Por que o computador foi ao psicólogo? Porque tinha muitos processos em conflito.",
      "Como o robô se declarou? Ele disse: minha CPU bate mais forte perto de você.",
      "Por que a internet terminou o namoro? Faltava conexão.",
      "O que o SSD disse para o HD? Relaxa, você ainda serve para guardar memórias antigas."
    ];
    const FUN_FACTS = [
      "Um raio é cerca de cinco vezes mais quente que a superfície do sol.",
      "Polvos têm três corações e sangue azul.",
      "O mel praticamente não estraga quando armazenado corretamente.",
      "Banana é tecnicamente uma baga, e morango não é.",
      "O primeiro e-mail da história foi enviado em 1971.",
      "Um dia em Vênus é mais longo que um ano em Vênus."
    ];
    const FUN_COMPLIMENTS = [
      "Você resolve problema mais rápido do que eu carrego uma página.",
      "Sua presença deixa até meus circuitos mais organizados.",
      "Se boas decisões fossem música, você seria uma sinfonia.",
      "Você é a exceção que não precisa de tratamento no meu código."
    ];
    const MOTIVATION_LINES = [
      "Você não precisa vencer o dia inteiro de uma vez. Conquiste a próxima tarefa, e depois avance novamente.",
      "O progresso silencioso ainda é progresso. Continue. Seus resultados estão sendo construídos agora.",
      "Disciplina é fazer hoje o que aproxima você da vida que deseja amanhã. Vamos em frente.",
      "Você já superou dias difíceis antes. Respire, organize o próximo passo e execute com confiança.",
      "Grandes resultados nascem de pequenas ações repetidas com consistência. Faça a próxima ação valer.",
      "Não espere a motivação perfeita. Comece com o que você tem; a energia aparece durante o movimento.",
      "Seu objetivo continua possível. Ajuste a estratégia se necessário, mas não abandone a missão.",
      "Concentre-se no que está sob seu controle. Uma decisão clara agora pode mudar todo o seu dia."
    ];
    const SUCCESS_LINES = [
      "Sucesso não é um único momento. É o resultado de decisões corretas repetidas quando ninguém está olhando.",
      "Cada resultado positivo é uma prova de que sua estratégia pode funcionar. Analise, aprenda e avance ainda melhor.",
      "Você não chegou até aqui por acaso. Continue transformando esforço em competência e competência em resultado.",
      "A vitória favorece quem combina visão com execução. Você já tem a visão; agora mantenha o ritmo.",
      "Comemore o progresso, mas não perca o foco. A próxima conquista já está esperando sua decisão.",
      "Resultados extraordinários começam quando a consistência deixa de ser opção e vira identidade."
    ];
    const FUN_INSULTS = [
      "Você é tão lento quanto internet discada em dia de chuva.",
      "Sua última ideia travou mais que o Windows atualizando.",
      "Você organiza sua área de trabalho do jeito que organiza suas prioridades."
    ];
    const FUN_FORTUNES = [
      "Hoje é um bom dia para tomar decisões ousadas.",
      "Evite clicar em atualizar depois hoje, o universo está de olho.",
      "Uma boa ideia vai aparecer, mas só se você fechar essa aba de distração.",
      "Hoje seus circuitos de sorte estão em alta."
    ];

    function parseChooseOptions(raw){
      const cleaned = String(raw || "").replace(/[.!?]+$/, "").trim();
      const parts = cleaned.split(/\s+ou\s+|\s*,\s*|\s+e\s+/i).map(item => item.trim()).filter(Boolean);
      return parts.length >= 2 ? parts : null;
    }

    function rollDice(command){
      const match = String(command || "").match(/(\d+)?\s*d\s*(\d+)/i) || String(command || "").match(/dado de\s*(\d+)/i);
      let sides = 6;
      let count = 1;
      if(match){
        if(match[2]){
          count = parseInt(match[1] || "1", 10) || 1;
          sides = parseInt(match[2], 10) || 6;
        }else if(match[1]){
          sides = parseInt(match[1], 10) || 6;
        }
      }
      count = Math.min(Math.max(count, 1), 10);
      sides = Math.min(Math.max(sides, 2), 1000);
      const rolls = Array.from({length: count}, () => 1 + Math.floor(Math.random() * sides));
      return {sides, rolls, total: rolls.reduce((sum, item) => sum + item, 0)};
    }

    function interpret(text){
      const command = correctHeardCommand(text).replace(/[.!?]+$/g, "").replace(/^\s*(?:agora|então|entao|depois disso|em seguida)\s*,?\s*/i, "").trim();
      const t = normalize(command);
      if(state.pendingMediaChoices){
        const choiceMatch = t.match(/^(?:a\s+)?(primeira|primeiro|segunda|segundo|terceira|terceiro|1|2|3)\b/);
        if(choiceMatch){
          const indexes = {primeira:0,primeiro:0,"1":0,segunda:1,segundo:1,"2":1,terceira:2,terceiro:2,"3":2};
          return {intent:"spotify.choice", confidence:99, command, choice:indexes[choiceMatch[1]]};
        }
      }
      if(/^confirmar\b/.test(t) && pendingPermissions.size){
        const key = Array.from(pendingPermissions.keys())[0];
        return {intent:"permission.confirm", confidence:99, command, permissionKey: key};
      }
      if(/^(cancelar|nao confirmar|não confirmar)\b/.test(t) && pendingPermissions.size){
        const key = Array.from(pendingPermissions.keys())[0];
        return {intent:"permission.cancel", confidence:99, command, permissionKey: key};
      }
      const scheduled = parseScheduledAction(command);
      if(scheduled) return {intent:"schedule.action", confidence:97, command, schedule: scheduled};
      if(/\b(quem sou eu|qual (?:e |é )?(?:o )?meu nome|qual meu nome|diga meu nome|fale meu nome|voce sabe (?:o )?meu nome|você sabe (?:o )?meu nome|sabe (?:o )?meu nome|lembra (?:do )?meu nome|como eu me chamo)\b/.test(t)) return {intent:"memory.whoami", confidence:99, command};
      if(/\b(qual (?:e |é )?(?:o )?(?:seu nome|nome dela)|como (?:voce|você) se chama|diga (?:o )?seu nome|fale (?:o )?seu nome|quem (?:e|é) (?:voce|você))\b/.test(t)) return {intent:"memory.assistant.identity", confidence:99, command};
      const newName = parseOwnerName(command);
      if(newName) return {intent:"memory.name.set", confidence:98, command, name: newName};
      const assistantNewName = parseAssistantName(command);
      if(assistantNewName) return {intent:"memory.assistant.name.set", confidence:98, command, name: assistantNewName};
      const trafficRoute=parseTrafficRoute(command);
      if(trafficRoute)return {intent:"traffic.route",confidence:99,command,...trafficRoute};
      const smartHome=parseHomeAssistantCommand(command);
      if(smartHome)return {intent:"smart.home.control",confidence:99,command,...smartHome};
      const weatherLocation = parseWeatherLocation(command);
      if(weatherLocation) return {intent:'weather.current', confidence:99, command, location:weatherLocation};
      const remoteTimeLocation = parseRemoteTimeLocation(command);
      if(remoteTimeLocation) return {intent:'time', confidence:99, command, location:remoteTimeLocation};
      const cityName = parseCityName(command);
      if(cityName) return {intent:"location.city.set", confidence:98, command, city: cityName};
      const learnedFact = parseLearnFact(command);
      if(learnedFact) return {intent:"memory.learn", confidence:98, command, fact: learnedFact};
      const forgetFact = parseForgetFact(command);
      if(forgetFact) return {intent:"memory.forget", confidence:98, command, fact: forgetFact};
      const capabilities = parseCapabilities(command);
      if(capabilities) return {intent:"memory.capabilities.set", confidence:98, command, capabilities};
      const customCommand = parseCustomCommand(command);
      if(customCommand) return {intent:"memory.custom.create", confidence:98, command, customCommand};
      for(const custom of state.learnedMemory.customCommands || []){
        if(custom && normalize(command) === normalize(custom.trigger)){
          return {intent:"memory.custom.run", confidence:99, command, custom};
        }
      }
      if(/\b(quem sou eu|qual (?:e |é )?(?:o )?meu nome|qual meu nome|diga meu nome|fale meu nome|voce sabe (?:o )?meu nome|você sabe (?:o )?meu nome|sabe (?:o )?meu nome|lembra (?:do )?meu nome|como eu me chamo)\b/.test(t)) return {intent:"memory.whoami", confidence:99, command};
      if(/\b(qual e seu nome|qual é seu nome|quem e voce|quem é você)\b/.test(t)) return {intent:"memory.assistant.identity", confidence:98, command};
      if(/\b(quais sao suas capacidades|quais são suas capacidades|o que voce consegue fazer|o que você consegue fazer)\b/.test(t)) return {intent:"memory.capabilities", confidence:98, command};
      if(/\b(minha memoria|minha memória|o que voce sabe sobre mim|o que você sabe sobre mim|preferencias|preferências)\b/.test(t)) return {intent:"memory.summary", confidence:96, command};
      if(/\b(quem te criou|quem criou voce|quem criou você|quem fez voce|quem fez você)\b/.test(t)) return {intent:"personality.creator", confidence:98, command};
      if(/\b(voce e o maia de verdade|você é o maia de verdade|voce e real|você é real|voce esta vivo|você está vivo|quem e voce|quem é você|o que voce e|o que você é|qual e seu nome|qual é seu nome)\b/.test(t)) return {intent:"personality.real", confidence:98, command};
      if(/\b(modo confirmacao|modo confirmação|voce aprende sozinho|você aprende sozinho|qual e seu protocolo|qual é seu protocolo)\b/.test(t)) return {intent:"personality.protocol", confidence:98, command};
      if(/\bmodo trabalho\b/.test(t)) return {intent:"macro.work", confidence:98, command};
      if(/\bmodo jogo\b/.test(t)) return {intent:"macro.game", confidence:98, command};
      if(/\bmodo noite\b/.test(t)) return {intent:"macro.night", confidence:98, command};
      if(/\bmodo cinema\b/.test(t)) return {intent:"macro.cinema", confidence:98, command};
      if(/\b(?:modo|preparar|iniciar)\b.*\b(?:reuniao|reunião)\b/.test(t)) return {intent:"macro.meeting", confidence:98, command};
      if(/\b(?:modo|perfil|iniciar)\b.*\bestudo\b/.test(t)) return {intent:"macro.study", confidence:98, command};
      if(/\b(modo economia|modo desempenho (maximo|máximo))\b/.test(t)) return {intent:"visual.legacyPerformance", confidence:99, command};
      if(/\b(modo normal|modo desempenho)\b/.test(t)) return {intent:"visual.performance", confidence:99, command};
      if(/\b(ativar|ligar)\b.*\btema (automatico|automático)\b/.test(t)) return {intent:"visual.autoTheme", confidence:98, command, enabled:true};
      if(/\b(desativar|desligar)\b.*\btema (automatico|automático)\b/.test(t)) return {intent:"visual.autoTheme", confidence:98, command, enabled:false};
      if(/\b(modo formal|fale formal|fala formal|modo serio|modo sério|fala comigo formal)\b/.test(t)) return {intent:"speech.mode.formal", confidence:98, command};
      if(/\b(modo casual|modo descontraido|modo descontraído|modo informal|fale casual|fala casual|fala comigo casual)\b/.test(t)) return {intent:"speech.mode.casual", confidence:98, command};
      if(/\b(modo sarcastico|modo sarcástico|modo debochado|fale sarcastico|fale sarcástico|fala sarcastico|fala sarcástico)\b/.test(t)) return {intent:"speech.mode.sarcastic", confidence:98, command};
      if(/\b(teste de voz|testar voz|como esta sua voz|como está sua voz)\b/.test(t)) return {intent:"speech.test", confidence:99, command};
      if(/^(?:maia\s+)?(?:proxima|próxima)(?:\s+(?:musica|música|faixa|som))?$|^(?:maia\s+)?(?:avanca|avança|avancar|avançar|pula|pular|skip)(?:\s+(?:essa|esta|a)?\s*(?:musica|música|faixa|som))?$|^(?:maia\s+)?(?:passa|troca)(?:\s+(?:essa|esta|a))?(?:\s+(?:musica|música|faixa|som))?$|^(?:maia\s+)?manda\s+(?:a\s+)?proxima$/.test(t)) return {intent:"media.next", confidence:99, command};
      if(/^(?:maia\s+)?(?:musica|música|faixa|som)\s+anterior$|^(?:maia\s+)?(?:volta|voltar|retorna|retornar)(?:\s+(?:uma|a\s+musica|a\s+música|a\s+faixa|pro\s+som|para\s+o\s+som))?$|^(?:maia\s+)?(?:a\s+)?(?:musica|música|faixa)\s+de\s+antes$|^(?:maia\s+)?a\s+anterior$/.test(t)) return {intent:"media.previous", confidence:99, command};
      if(/\b(despausar|despause|continuar|continue|retomar|retome|voltar a tocar|dar play|dê play|de play)\b.*\b(musica|música|reproducao|reprodução|spotify|faixa|som)\b|^(?:maia\s+)?(continuar|continue|retomar|retome|despausar|despause|play|pode continuar|volta a tocar)$/.test(t)) return {intent:"media.resume", confidence:99, command};
      if(/\b(pausar|pause|parar|pare|segurar|segura)\b.*\b(musica|música|reproducao|reprodução|spotify|faixa|som)\b|^(?:maia\s+)?(pausar|pause|pausa|pare a musica|pare a música|segura essa)$/.test(t)) return {intent:"media.pause", confidence:99, command};
      if(/^(?:maia\s+)?(?:aumenta|aumentar|suba|subir|eleva|elevar)(?:\s+(?:o|um pouco o))?\s*(?:volume|som|audio|áudio)$|^(?:maia\s+)?(?:volume|som|audio|áudio)\s+(?:mais alto|pra cima|para cima)$|^(?:maia\s+)?mais alto$/.test(t)) return {intent:"volume.up", confidence:99, command};
      if(/^(?:maia\s+)?(?:abaixa|abaixar|baixa|baixar|diminui|diminuir|reduz|reduzir)(?:\s+(?:o|um pouco o))?\s*(?:volume|som|audio|áudio)$|^(?:maia\s+)?(?:volume|som|audio|áudio)\s+(?:mais baixo|pra baixo|para baixo)$|^(?:maia\s+)?mais baixo$/.test(t)) return {intent:"volume.down", confidence:99, command};
      if(/^(?:maia\s+)?(?:muta|mutar|silencia|silenciar|tira o som|sem som|fica sem som)$/.test(t)) return {intent:"volume.mute", confidence:99, command};
      if(/\b(previsao|previsão|clima)\b.*\b(semana|proximos dias|próximos dias|7 dias)\b/.test(t))return {intent:"weather.forecast",confidence:99,command,location:parseWeatherLocation(command)};
      if(/\b(clima|previsao do tempo|previsão do tempo)\b/.test(t) || /\bcomo (esta|está) o tempo\b/.test(t) || /\bvai chover\b/.test(t) || /\b(esta|está)\s+(calor|frio)\b/.test(t)) return {intent:"weather.current", confidence:96, command};
      {
        const monitorText = normalize(wordsToNumbers(command));
        const monitorMatch = monitorText.match(/\b(?:me avise|me avisa|avise|avisa|avisar|alerte|monitorar)\b.*\b(cpu|processador|ram|memoria|bateria)\b.*?(\d{1,3})\s*(?:por cento|%)/);
        if(monitorMatch){
          const metric = /cpu|processador/.test(monitorMatch[1]) ? "cpu" : /bateria/.test(monitorMatch[1]) ? "battery" : "ram";
          const operator = metric === "battery" && /\b(?:abaixo|menos|chegar a|cair|baixar)\b/.test(monitorText) ? "below" : "above";
          return {intent:"monitor.create", confidence:98, command, metric, operator, threshold:Math.max(1, Math.min(100, Number(monitorMatch[2])))};
        }
      }
      if(/\b(?:meus|listar|mostre)\b.*\balertas?\b.*\b(?:sistema|computador|cpu|bateria|memoria|memória)\b/.test(t)) return {intent:"monitor.list", confidence:97, command};
      const chooseMatch = command.match(/\b(?:escolha|decida)\s+entre\s+(.+)/i) || command.match(/\bo que eu escolho\b[:\-]?\s*(.+)/i);
      if(chooseMatch) return {intent:"fun.choose", confidence:97, command, options: chooseMatch[1]};
      if(/\bcara ou coroa\b|\bjogue uma moeda\b|\bjogar moeda\b/.test(t)) return {intent:"fun.coin", confidence:97, command};
      if(/\b(role|jogue|rolar|tirar)\b.*\bdado\b|\b\d*d\d+\b|\bdado de\s*\d+\b/.test(t)) return {intent:"fun.dice", confidence:96, command};
      if(/\b(conte|me conta)\b.*\bpiada\b|\bpiada de programador\b/.test(t)) return {intent:"fun.joke", confidence:96, command};
      if(/\bfato aleatorio\b|\bcuriosidade aleatoria\b|\bme diga uma curiosidade\b|\bconte uma curiosidade\b/.test(t)) return {intent:"fun.fact", confidence:96, command};
      if(/\bme elogie\b|\bme elogia\b|\bdiga algo legal para mim\b|\bme diga algo bom\b/.test(t)) return {intent:"fun.compliment", confidence:96, command};
      if(/\b(me motive|me motiva|preciso de motivacao|preciso de motivação|frase de motivacao|frase de motivação|motivacao do dia|motivação do dia)\b/.test(t)) return {intent:"motivation", confidence:99, command};
      if(/\b(frase de sucesso|fale sobre sucesso|mensagem de sucesso|me diga uma frase de sucesso|celebre comigo)\b/.test(t)) return {intent:"success.phrase", confidence:99, command};
      if(/\bme xingue\b|\bme ofenda\b|\bme zoa\b/.test(t)) return {intent:"fun.insult", confidence:96, command};
      if(/\bautodestruicao\b|\bautodestruição\b/.test(t)) return {intent:"fun.selfdestruct", confidence:98, command, seconds:parseSelfDestructSeconds(command)};
      if(/\bsentido da vida\b/.test(t)) return {intent:"fun.meaning", confidence:96, command};
      if(/\bvoce tem sentimentos\b|\bvoce sente algo\b|\bvoce tem emocoes\b/.test(t)) return {intent:"fun.feelings", confidence:96, command};
      if(/\bquantos anos voce tem\b|\bqual sua idade\b|\bque idade voce tem\b/.test(t)) return {intent:"fun.age", confidence:96, command};
      if(/\bvoce esta com fome\b|\bvoce come\b|\bvoce tem fome\b/.test(t)) return {intent:"fun.hungry", confidence:96, command};
      if(/\bsorte de hoje\b|\bminha sorte hoje\b|\bhoroscopo\b/.test(t)) return {intent:"fun.fortune", confidence:96, command};
      if(/\bdanca maia\b|\bfaca uma danca\b|\bdance para mim\b/.test(t)) return {intent:"fun.dance", confidence:96, command};
      if(/\btoque uma fanfarra\b|\btoque um som de vitoria\b|\bcomemore\b/.test(t)) return {intent:"fun.fanfare", confidence:96, command};
      if(/\bme surpreenda\b|\bfaca algo aleatorio\b|\bsurpreenda-me\b/.test(t)) return {intent:"fun.surprise", confidence:95, command};
      if(/\bpomodoro\b/.test(t)) return {intent:"focus.pomodoro", confidence:97, command, minutes: parsePomodoroMinutes(command)};
      if(/\b(o que eu tenho hoje|agenda de hoje|resumo do dia|compromissos de hoje)\b/.test(t)) return {intent:"agenda.today", confidence:97, command};
      if(/\b(entrar|abrir)\b.*\b(reuniao|reunião|meet|teams|zoom)\b/.test(t)) return {intent:"meeting.join", confidence:96, command};
      if(/\b(trava o pc|travar o pc|bloquear tela|bloquear a tela|bloquear o computador|bloqueia o computador|bloqueie o computador|travar computador|travar o computador)\b/.test(t)) return {intent:"system.lock", confidence:99, command};
      if(/\b(hibernar pc|colocar pc para dormir|suspender computador|modo suspensao|modo suspensão)\b/.test(t)) return {intent:"system.sleep", confidence:96, command};
      if(/\b(reiniciar pc|reinicie o computador|reiniciar computador)\b/.test(t)) return {intent:"system.restart", confidence:96, command};
      if(/\b(como esta minha internet|como está minha internet|status da internet|testar internet)\b/.test(t)) return {intent:"network.status", confidence:96, command};
      if(/\b(organiza as janelas|organizar janelas|arrumar janelas)\b/.test(t)) return {intent:"window.organize", confidence:96, command};
      if(/\b(onde esta|onde está|buscar|procure|procurar)\b.*\barquivo\b/.test(t)) return {intent:"file.search", confidence:95, command, query: parseFileQuery(command)};
      if(/\b(?:abrir|abra)\b.*\b(?:ultimo|último|mais recente)\b.*\bdownload\b|\babra o que baixei\b/.test(t)) return {intent:"downloads.openLatest", confidence:99, command};
      if(/\b(?:meus|ultimos|últimos|listar|mostre|mostrar|o que baixei)\b.*\bdownloads?\b|\bo que baixei\b/.test(t)) return {intent:"downloads.list", confidence:98, command};
      if(/\b(?:pausar|pause|parar)\b.*\byoutube\b|\byoutube\b.*\b(?:pausar|pause)\b/.test(t)) return {intent:"youtube.pause", confidence:99, command};
      if(/\b(?:continuar|continue|retomar|retome|play)\b.*\byoutube\b|\byoutube\b.*\b(?:continuar|retomar)\b/.test(t)) return {intent:"youtube.resume", confidence:99, command};
      if(/\b(?:proximo|próximo|avancar|avançar)\b.*\bvideo\b/.test(t)) return {intent:"youtube.next", confidence:98, command};
      if(/\b(?:video|vídeo)\b.*\b(?:anterior|voltar)\b/.test(t)) return {intent:"youtube.previous", confidence:98, command};
      if(/\b(?:youtube|video|vídeo)\b.*\b(?:tela cheia|fullscreen)\b|\b(?:tela cheia|fullscreen)\b.*\b(?:youtube|video|vídeo)\b/.test(t)) return {intent:"youtube.fullscreen", confidence:98, command};
      if(/^(?:maia\s+)?(?:abrir|abra|iniciar|inicie)\s+(?:o\s+)?youtube$/.test(t)) return {intent:"youtube.open", confidence:99, command};
      if(/\b(procure|procura|procurar|pesquise|pesquisa|pesquisar|busque|busca|buscar|encontre|acha)\b.*\byoutube\b|\byoutube\b.*\b(procure|procura|pesquise|pesquisa|busque|busca|encontre|acha)\b/.test(t)) return {intent:"youtube.search", confidence:98, command, query: parseYoutubeQuery(command)};
      if(/\b(toca|toque|tocar|abrir|abra|reproduzir|reproduza|coloque|coloca|bota|botar|poe|põe|quero ver|quero assistir|assista|mostrar|mostre)\b.*\byoutube\b|\byoutube\b.*\b(toca|toque|reproduza|coloque|bota|poe|põe|assista|mostre)\b/.test(t)) return {intent:"youtube.play", confidence:97, command, query: parseYoutubeQuery(command)};
      if(/^(?:maia\s+)?youtube\s*[:,\-]?\s+.+/.test(t)) return {intent:"youtube.search", confidence:94, command, query:parseYoutubeQuery(command)};
      const expense = parseExpense(command);
      if(expense) return {intent:"finance.expense.add", confidence:97, command, expense};
      if(/\b(quanto eu gastei esse mes|quanto gastei esse mes|quanto gastei esse mês|resumo de gastos)\b/.test(t)) return {intent:"finance.summary", confidence:96, command};
      if(/\b(quanto vendi|quantas vendas|vendas de hoje|vendas da semana|resumo de vendas|faturamento|ticket medio|ticket médio|produto mais vendido|maior venda|historico de vendas|histórico de vendas)\b/.test(t)) return {intent:"sales.summary", confidence:99, command, period:parseSalesPeriod(command)};
      if(/\b(quanto esta o dolar|quanto está o dolar|quanto está o dólar|cotacao do dolar|cotação do dólar)\b/.test(t)) return {intent:"quote.usd", confidence:96, command};
      if(/\b(gera uma senha forte|gerar senha forte|criar senha segura)\b/.test(t)) return {intent:"security.password", confidence:96, command};
      if(/\b(ligar luz|acender luz|modo cinema|casa inteligente|ligar tomada|desligar tomada|ar condicionado smart)\b/.test(t)) return {intent:"smart.home.control", confidence:92, command, service:"turn_on", query:command};
      if(/\b(tem email novo|ler emails|resumo dos emails|email novo)\b/.test(t)) return {intent:"email.info", confidence:92, command};
      if(/\b(sequencia de boot|sequência de boot|reiniciar boot|reiniciar interface|inicializar maia)\b/.test(t)) return {intent:"macro.boot", confidence:98, command};
      if(/\b(me mostre uma demonstracao|me mostre uma demonstração|faca uma demonstracao|faça uma demonstração|mostra uma demonstracao|modo demonstracao|modo demonstração|demonstre suas capacidades)\b/.test(t)) return {intent:"demo.orbit", confidence:98, command};
      if(/\b(noticia do dia|notícia do dia|quais as noticias|quais as notícias|me conta as noticias|me conta as notícias|resumo das noticias|resumo das notícias|tem noticia nova|tem notícia nova)\b/.test(t)) return {intent:"news.today", confidence:96, command};
      if(/\bmodo foco\b/.test(t)) return {intent:"visual.focus", confidence:98, command};
      if(/\b(desativar|desative|sair do|cancelar|encerrar)\s+modo combate\b/.test(t)) return {intent:"visual.default", confidence:99, command};
      if(/\b(ativar|ative|iniciar|entrar no)?\s*modo combate\b/.test(t)) return {intent:"visual.combat", confidence:99, command};
      if(/\bmodo repouso\b/.test(t)) return {intent:"visual.rest", confidence:98, command};
      if(/\b(modo padrao|modo padrão|interface normal)\b/.test(t)) return {intent:"visual.default", confidence:98, command};
      if(/\b(ler area de transferencia|ler área de transferência|o que esta copiado|o que está copiado)\b/.test(t)) return {intent:"clipboard.read", confidence:96, command};
      if(/\b(capturar tela|tirar print|print da tela|salvar captura)\b/.test(t)) return {intent:"screenshot.capture", confidence:96, command};
      if(/\b(desligar|desligue)\b.*\b(pc|computador|windows|sistema)\b/.test(t)) return {intent:"system.shutdown", confidence:96, command};
      if(isBrightnessCommand(command)) return {intent:"brightness.set", confidence:96, command, level: parseBrightnessLevel(command)};
      if(/\b(?:pare|parar|desligue|desligar|silencie|silenciar|cala|calar)\b.*\b(?:alarme|despertador)\b|\b(?:alarme|despertador)\b.*\b(?:pare|parar|desligar|silenciar)\b/.test(t)) return {intent:"alarm.stop", confidence:99, command};
      if(/\b(?:adicione|adie|adiar|soneca|sonequinha|mais)\b.*\b(?:alarme|despertador|minutos?)\b|\bmais\s+(?:5|cinco|10|dez)\s+minutos?\b/.test(t)) return {intent:"alarm.snooze", confidence:98, command};
      if(/\b(?:listar|liste|mostrar|mostre|quais|meus|proximos|próximos)\b.*\b(?:alarmes|despertadores)\b/.test(t)) return {intent:"alarm.list", confidence:99, command};
      if(/\b(?:cancelar|cancele|excluir|exclua|apagar|apague|remover|remova)\b.*\b(?:alarme|despertador|alarmes|despertadores)\b/.test(t)) return {intent:"alarm.cancel", confidence:99, command};
      if(/\b(?:temporizador|timer|contagem regressiva|cronometro|cronômetro)\b/.test(t) && /\b(?:minuto|hora|segundo)\b/.test(t)) return {intent:"timer.create", confidence:98, command};
      if(/\b(despertador|alarme|me acorde|acorde me|acordar)\b/.test(t)) return {intent:"alarm.create", confidence:97, command};
      if(/\b(me lembre|lembre me|lembrar)\b/.test(t)) return {intent:"reminder.create", confidence:96, command};
      if(/^(?:(?:oi|ola)\s+)?(?:bom dia|boa tarde|boa noite)(?:\s+(?:maia|maya))?$|^(?:oi|ola|maia|maya)$/.test(t)) return {intent:"greeting", confidence:99, command};
      if(/\b(conectar|login|autorizar)\b.*\bspotify\b/.test(t)) return {intent:"spotify.login", confidence:98, command};
      const streamingService = parseStreamingService(command);
      if(streamingService && /\b(continuar|continue|retomar|retome|continuar assistindo)\b/.test(t)) return {intent:"streaming.continue", confidence:99, command, service:streamingService};
      if(streamingService && /\b(assistir|assista|reproduzir|reproduza|procurar|procure|buscar|busque|pesquisar|pesquise)\b/.test(t)) return {intent:"streaming.open", confidence:99, command, service:streamingService, query:parseStreamingQuery(command)};
      if(streamingService && /\b(abrir|abra|iniciar|inicie)\b/.test(t)) return {intent:"streaming.open", confidence:99, command, service:streamingService, query:""};
      if(/\b(continuar|continue|retomar|retome)\b.*\b(filme|serie|série|episodio|episódio|assistindo)\b/.test(t)) return {intent:"streaming.continue", confidence:98, command, service:context.lastStreaming || ""};
      if(/\b(avancar|avançar|adiantar|pular)\b.*\b(10|dez|30|trinta)?\s*(segundos?)?\b/.test(t)) return {intent:"streaming.forward", confidence:97, command};
      if(/\b(voltar|retroceder)\b.*\b(10|dez|30|trinta)?\s*(segundos?)?\b/.test(t)) return {intent:"streaming.back", confidence:97, command};
      if(/\b(tela cheia|fullscreen)\b/.test(t)) return {intent:"streaming.fullscreen", confidence:97, command};
      if(/\b(abrir|iniciar)\b.*\b(voz online|microfone online|reconhecimento online)\b/.test(t)) return {intent:"speech.helper.open", confidence:98, command};
      if(/\b(que|qual)\s+musica\s+esta\s+tocando\b|\bo que esta tocando\b|\bquanto falta\b.*\b(acabar|terminar)\b/.test(t)) return {intent:"spotify.current", confidence:96, command};
      if(/\b(ativar|ligar|ative|ligue)\b.*\b(aleatorio|aleatório|shuffle)\b/.test(t)) return {intent:"spotify.shuffle", confidence:98, command, enabled:true};
      if(/\b(desativar|desligar|desative|desligue)\b.*\b(aleatorio|aleatório|shuffle)\b/.test(t)) return {intent:"spotify.shuffle", confidence:98, command, enabled:false};
      if(/\b(repetir|repita)\b.*\b(esta|essa|musica|música|faixa)\b/.test(t)) return {intent:"spotify.repeat", confidence:98, command, mode:"track"};
      if(/\b(repetir|repita)\b.*\b(playlist|lista)\b/.test(t)) return {intent:"spotify.repeat", confidence:98, command, mode:"context"};
      if(/\b(desativar|desligar|parar)\b.*\b(repeticao|repetição|repetir)\b/.test(t)) return {intent:"spotify.repeat", confidence:98, command, mode:"off"};
      if(/\b(favoritar|favorita|curtir|curta|salvar)\b.*\b(musica|música|faixa|atual)\b/.test(t)) return {intent:"spotify.favorite", confidence:98, command};
      if(/\b(o que tocou|historico de musica|histórico de música|musicas recentes|músicas recentes)\b/.test(t)) return {intent:"media.history", confidence:98, command};
      if(/\b(voltar|volte)\b.*\b(musica|música)\b.*\b(ontem|anterior|antes)\b/.test(t)) return {intent:"media.history.play", confidence:97, command};
      if(/^(nao|não)\s+(essa|esta).*\b(ao vivo|acustica|acústica|remix|letra|oficial)\b/.test(t) && context.lastSearch){
        const version = t.match(/\b(ao vivo|acustica|acústica|remix|letra|oficial)\b/);
        return {intent:"spotify.play", confidence:99, command, query:context.lastSearch + " " + (version ? version[1] : "")};
      }
      if(isSpotifyPlaylistCommand(command)) return {intent:"spotify.playlist", confidence:98, command, query: extractSpotifyPlaylistQuery(command)};
      if(isSpotifyQueueCommand(command)) return {intent:"spotify.queue", confidence:97, command, query: extractSpotifyQueueQuery(command)};
      if(isSpotifyPlaybackCommand(command)) return {intent:"spotify.play", confidence:96, command, query: extractSpotifyQuery(command)};
      if(isDirectVolumeCommand(command)) return {intent:"volume.set", confidence:98, command, level: getVolumeLevel(command)};
      if(isMathRequest(command)){
        const result = calculateExpression(command);
        if(result !== null) return {intent:"calculate", confidence:99, command, result};
      }
      if(/abrir|abra|iniciar|execute|executar/.test(t)) return {intent:"system.open", confidence:88, command, program: parseProgram(command)};
      if(/fechar|feche/.test(t)) return {intent:"system.close", confidence:86, command, program: parseProgram(command)};

      let best = {intent:"unknown", confidence:0, command};
      for(const entry of commandBank){
        const score = similarityScore(command, entry);
        if(score > best.confidence) best = {...entry, confidence:score, command};
      }
      return best;
    }

    async function requirePermission(intent, detail, executor){
      const key = intent + ":" + detail;
      if(pendingPermissions.has(key)){
        const pending = pendingPermissions.get(key);
        pendingPermissions.delete(key);
        return (pending && pending.executor ? pending.executor : executor)();
      }
      pendingPermissions.set(key, {createdAt: Date.now(), intent, detail, executor});
      speak("Confirme para executar: " + detail + ". Diga confirmar para autorizar, ou cancelar para ignorar.");
      state.commandArmed = true;
      state.waitingCommandUntil = Date.now() + 30000;
      setCore("AGUARDANDO CONFIRMAÇÃO");
      setTimeout(() => pendingPermissions.delete(key), 30000);
      return null;
    }

    async function runMacro(name){
      if(name === "work"){
        setVisualMode("focus");
        await callBridge("volume.set", {level: state.preferences.preferredVolume || 50});
        await callBridge("system.openProgram", {program:"chrome"});
        await callBridge("system.openProgram", {program:"vs code"});
        rememberFavoriteApp("chrome");
        rememberFavoriteApp("vs code");
        speak("Modo trabalho iniciado. Chrome, VS Code e volume preferido ajustados.");
        return;
      }
      if(name === "game"){
        setVisualMode("combat");
        await callBridge("volume.set", {level:75});
        await callBridge("system.openProgram", {program:"spotify"});
        rememberFavoriteApp("spotify");
        speak("Modo jogo iniciado. Volume alto e Spotify preparados.");
        return;
      }
      if(name === "night"){
        setVisualMode("rest");
        await callBridge("volume.set", {level:25});
        try{ await callBridge("brightness.set", {level:30}); }catch(err){}
        speak("Modo noite ativado. Volume baixo e brilho reduzido quando o monitor permite.");
        return;
      }
      if(name === "cinema"){
        setVisualMode("rest");
        await callBridge("volume.set", {level:55});
        const service = context.lastStreaming || "prime";
        context.lastStreaming = service;
        context.activeMedia = "streaming";
        saveContext();
        await callBridge("streaming.open", {service});
        speak("Modo cinema ativado. Streaming aberto, volume ajustado e controles de reprodução preparados.");
        return;
      }
      if(name === "meeting"){
        setVisualMode("focus");
        await callBridge("volume.set", {level:35});
        await callBridge("meeting.open");
        speak("Modo reunião preparado. Aplicativo de reunião aberto, volume ajustado e interface em foco.");
        return;
      }
      if(name === "study"){
        setVisualMode("focus");
        await callBridge("volume.set", {level:35});
        addSchedule({type:"reminder", message:"Sessão de estudo concluída. Faça uma pausa.", dueAt:Date.now() + 50 * 60000, label:"estudo"});
        speak("Modo estudo iniciado. Volume reduzido e sessão de cinquenta minutos programada.");
      }
    }

    function memorySummary(){
      const apps = state.preferences.favoriteApps.length ? state.preferences.favoriteApps.slice(0, 4).join(", ") : "nenhum aplicativo favorito registrado";
      const music = state.preferences.frequentMusics.length ? state.preferences.frequentMusics.slice(0, 3).map(item => item.name).join(", ") : "nenhuma música frequente registrada";
      const pending = state.reminders.filter(item => !item.done && Number(item.dueAt) > Date.now()).length;
      const facts = state.learnedMemory.facts.length ? state.learnedMemory.facts.slice(0, 4).map(item => item.text).join("; ") : "nenhum fato ensinado";
      const custom = state.learnedMemory.customCommands.length ? state.learnedMemory.customCommands.length + " comandos personalizados" : "nenhum comando personalizado";
      return "Tenho registrado o nome " + ownerTitle() + ", assistente chamado " + assistantName() + ", volume preferido em " + (state.preferences.preferredVolume || 50) + " por cento, aplicativos favoritos: " + apps + ". Músicas mais pedidas: " + music + ". Memória ensinada: " + facts + ". Tenho " + custom + " e " + pending + " lembretes ou agendamentos pendentes.";
    }

    function addLearnedFact(fact){
      const text = String(fact || "").trim();
      if(!text) return false;
      const key = memoryKey(text);
      state.learnedMemory.facts = (state.learnedMemory.facts || []).filter(item => item.key !== key);
      state.learnedMemory.facts.unshift({key, text, at: new Date().toISOString()});
      state.learnedMemory.facts = state.learnedMemory.facts.slice(0, 120);
      callBridge('brain.remember', {text}).catch(() => {});
      saveMemory();
      return true;
    }

    function forgetLearnedFact(fact){
      const key = memoryKey(fact);
      const before = (state.learnedMemory.facts || []).length;
      state.learnedMemory.facts = (state.learnedMemory.facts || []).filter(item => !item.key.includes(key) && !key.includes(item.key));
      callBridge('brain.forget', {query:fact}).catch(() => {});
      saveMemory();
      return before !== state.learnedMemory.facts.length;
    }

    function addCustomCommand(customCommand){
      const triggerKey = memoryKey(customCommand.trigger);
      state.learnedMemory.customCommands = (state.learnedMemory.customCommands || []).filter(item => memoryKey(item.trigger) !== triggerKey);
      state.learnedMemory.customCommands.unshift({
        trigger: customCommand.trigger,
        action: customCommand.action,
        at: new Date().toISOString()
      });
      state.learnedMemory.customCommands = state.learnedMemory.customCommands.slice(0, 80);
      saveMemory();
    }

    async function execute(task){
      if(task.confidence < 55){
        setCore("CÉREBRO MAIA");
        setHud("PENSANDO", "speaking");
        try{
          const response = await callBridge("brain.think", {prompt:task.command});
          const brain = response && response.result;
          if(brain && brain.reply){
            const planned = Array.isArray(brain.steps) && brain.steps.length
              ? " Preparei " + brain.steps.length + (brain.steps.length === 1 ? " etapa" : " etapas") + "; nenhuma ação foi executada sem sua confirmação."
              : "";
            speak(brain.reply + planned);
          }else{
            speak("Não consegui formar uma resposta válida.");
          }
        }catch(err){
          if(err && err.name === "AbortError"){
            speak("Demorei além do limite para responder. Tente novamente.");
          }else{
            speak("Meu cérebro está indisponível. Reinicie a Maia e tente novamente.");
          }
        }
        return;
      }
      rememberCommand(task.command, task.intent);
      switch(task.intent){
        case "greeting":
          speak(responseByMode("greeting"));
          break;
        case "help":
          speak(pick([
            "Estou operando pelo Kernel. Posso controlar programas, Spotify, volume, câmera, cálculos, lembretes, agendamentos, memória, capturas de tela, área de transferência, modos visuais e permissões.",
            "Minhas funções principais estão prontas: automação do computador, comandos de voz, Spotify, volume, cálculos, memória, agenda, prints, clipboard e modos operacionais.",
            "O Kernel está ativo. Comandos reconhecidos passam por intenção, permissão quando necessário, execução e resposta."
          ]));
          break;
        case "personality.creator":
          speak("Sou Maia, sua assistente pessoal. Fui criada para acompanhar, ajudar e evoluir com você.");
          break;
        case "personality.real":
          speak(pick([
            "Sou real como presença digital, senhor. Sou Maia, mas posso executar funções reais nesta máquina.",
            "Sou sua interface operacional. Minha prioridade é compreender você e agir com segurança.",
            "Não tenho vontade própria, senhor. Tenho kernel, memória, comandos e automações controladas."
          ]));
          break;
        case "personality.protocol":
          speak("Meu protocolo é fechado e controlado: se o comando existe no banco, eu executo; se for perigoso, peço confirmação; se eu não conhecer, informo que ainda não aprendi.");
          break;
        case "memory.name.set":
          state.preferences.ownerName = task.name;
          saveMemory();
          speak("A partir de agora vou chamar você de " + task.name + ".");
          break;
        case "memory.assistant.name.set":
          state.learnedMemory.assistantName = task.name;
          saveMemory();
          speak("Entendido. Meu nome operacional será " + task.name + ".");
          break;
        case "memory.learn":
          if(addLearnedFact(task.fact)){
            speak("Memória registrada: " + task.fact + ".");
          }else{
            speak("Não identifiquei o que devo guardar.");
          }
          break;
        case "memory.forget":
          speak(forgetLearnedFact(task.fact) ? "Removi essa informação da memória." : "Não encontrei essa informação na memória.");
          break;
        case "memory.capabilities.set":
          state.learnedMemory.capabilities = task.capabilities.slice(0, 30);
          saveMemory();
          speak("Capacidades atualizadas.");
          break;
        case "memory.whoami":
          if(!state.preferences.ownerName || state.preferences.ownerName === "senhor"){
            speak("Ainda não sei o seu nome. Para me ensinar com segurança, diga: me chame de, seguido do seu nome.");
          }else{
            speak("Seu nome é " + state.preferences.ownerName + ".");
          }
          break;
        case "memory.assistant.identity":
          speak("Meu nome é " + assistantName() + ".");
          break;
        case "memory.capabilities":
          speak("Minhas capacidades atuais são: " + (state.learnedMemory.capabilities || []).join(", ") + ".");
          break;
        case "memory.custom.create":
          addCustomCommand(task.customCommand);
          speak("Comando personalizado registrado. Quando o senhor disser " + task.customCommand.trigger + ", executarei: " + task.customCommand.action + ".");
          break;
        case "memory.custom.run":
          speak("Executando comando personalizado: " + task.custom.action + ".");
          await MaiaKernel.run(task.custom.action);
          break;
        case "memory.summary":
          speak(memorySummary());
          break;
        case "time":
          {
            if(task.location){
              try{
                const place = await geocodeCity(task.location);
                if(!place || !place.timezone) throw new Error('local não encontrado');
                const remoteDateTime = new Intl.DateTimeFormat('pt-BR', {
                  timeZone:place.timezone,
                  weekday:'long',
                  day:'2-digit',
                  month:'long',
                  hour:'2-digit',
                  minute:'2-digit'
                }).format(new Date());
                speak('Em ' + place.label + ', agora é ' + remoteDateTime + '.');
              }catch(err){
                speak('Não encontrei o fuso horário de ' + task.location + '. Tente dizer uma cidade ou o nome do país.');
              }
              break;
            }
            const now = new Date();
            speak(responseByMode("time", {
              timeText: spokenClock(now),
              shortTimeText: shortSpokenClock(now)
            }));
          }
          break;
        case "date":
          speak(responseByMode("date", {
            date: new Date().toLocaleDateString("pt-BR", {weekday:"long", day:"2-digit", month:"long", year:"numeric"})
          }));
          break;
        case "speech.mode.formal":
          setSpeechMode("formal");
          speak("Modo formal ativado. Como posso ajudá-lo?");
          break;
        case "speech.mode.casual":
          setSpeechMode("casual");
          speak("Beleza, modo casual ligado. Bora.");
          break;
        case "speech.mode.sarcastic":
          setSpeechMode("sarcastic");
          speak("Ah, modo sarcástico. Isso vai ser divertido.");
          break;
        case "speech.test":
          speak("Teste de voz concluído. Articulação, ritmo e entonação estão operacionais. Estou pronto para ajudá-lo de forma clara e natural.");
          break;
        case "weather.current": {
          try{
            const weather = await getCurrentWeather(task.location);
            speak("Clima em " + weather.label + ": " + weather.temp + " graus, " + weather.condition + ", umidade em " + weather.humidity + " por cento, vento de " + weather.wind + " quilômetros por hora e chance de chuva em torno de " + weather.rain + " por cento. " + weatherReaction(weather));
          }catch(err){
            speak("Não consegui consultar o clima agora. Verifique a conexão com a internet.");
          }
          break;
        }
        case "weather.forecast": {
          try{
            const response=await callBridge("weather.complete",{location:task.location||state.preferences.city}),weather=response.result||{},daily=weather.daily||{},days=(daily.time||[]).slice(0,5).map((date,index)=>new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"})+", mínima de "+Math.round(daily.temperature_2m_min[index])+" e máxima de "+Math.round(daily.temperature_2m_max[index])+" graus, chuva "+Math.round(daily.precipitation_probability_max[index]||0)+" por cento");
            speak("Previsão para "+(weather.location&&weather.location.name||"sua cidade")+". "+days.join(". ")+".");
          }catch(err){speak("Não consegui obter a previsão completa. "+err.message)}
          break;
        }
        case "traffic.route": {
          try{
            const response=await callBridge("traffic.route",{origin:task.origin,destination:task.destination}),route=response.result&&response.result.routes&&response.result.routes[0];
            if(!route)throw new Error("rota não encontrada");
            speak("Até "+task.destination+", a melhor rota leva aproximadamente "+route.durationMinutes+" minutos por "+route.distanceKm+" quilômetros. "+(route.delayMinutes?"O trânsito acrescenta cerca de "+route.delayMinutes+" minutos.":"O fluxo está próximo do normal."));
          }catch(err){speak("Não consegui consultar o trânsito. "+err.message)}
          break;
        }
        case "location.city.set":
          let validatedCity = null;
          try{
            validatedCity = await geocodeCity(task.city);
          }catch(err){}
          if(!validatedCity){
            speak('Não encontrei a cidade ' + task.city + '. Tente dizer o nome da cidade seguido do estado.');
            break;
          }
          state.preferences.city = validatedCity.city || task.city;
          task.city = validatedCity.label;
          cachedCityCoords = null;
          cachedWeatherCoords = null;
          saveMemory();
          speak("Cidade configurada para " + task.city + ". Vou usar isso nas próximas consultas de clima.");
          break;
        case "calculate": {
          const result = Number.isFinite(task.result) ? task.result : calculateExpression(task.command);
          speak(result === null ? "Não consegui calcular essa expressão com segurança." : "O resultado é " + result + ".");
          break;
        }
        case "spotify.login":
          await callBridge("spotify.login");
          speak("Abrindo autorização do Spotify. Faça login e autorize a Maia no navegador.");
          break;
        case "spotify.choice": {
          const choices = state.pendingMediaChoices || [];
          const selected = choices[task.choice];
          state.pendingMediaChoices = null;
          if(!selected){ speak("Essa opção não está disponível. Faça o pedido novamente."); break; }
          let choicePlaybackStarted = false;
          try{
            await callBridge("spotify.playUri", {uri:selected.uri});
            choicePlaybackStarted = true;
            rememberMedia20("spotify", selected.name, selected.artists || "");
            await speak("Certo, reproduzindo " + selected.name + " de " + selected.artists + ".");
          }catch(err){
            if(choicePlaybackStarted) logError20("spotify.choice.postPlayback", err);
            else speak("Não consegui iniciar essa opção no Spotify.");
          }
          break;
        }
        case "speech.helper.open":
          speak("Vou ativar a voz online no Edge, senhor.");
          try{
            await openBrowserSpeechHelper(true);
          }catch(err){
            speak("Não consegui abrir o Edge automaticamente. Abra manualmente: cento e vinte e sete ponto zero ponto zero ponto um, porta dezessete mil setecentos e setenta e oito, barra speech hífen helper.");
          }
          break;
        case "spotify.current": {
          try{
            const data = await callBridge("spotify.current");
            const current = data && data.result;
            if(!current || !current.name){
              speak("Não encontrei uma reprodução ativa no Spotify.");
              break;
            }
            const remaining = Math.ceil((current.remainingMs || 0) / 1000);
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            speak("Está tocando " + current.name + " de " + current.artists + ". Faltam aproximadamente " + minutes + " minutos e " + seconds + " segundos.");
          }catch(err){
            speak("Spotify ainda não está conectado. Diga conectar Spotify.");
          }
          break;
        }
        case "spotify.shuffle":
          try{
            await callBridge("spotify.shuffle", {enabled:task.enabled});
            speak(task.enabled ? "Modo aleatório ativado. Vamos deixar o Spotify escolher o próximo clima." : "Modo aleatório desativado. Ordem original restaurada.");
          }catch(err){ speak("Não consegui alterar o modo aleatório. Verifique se o Spotify está ativo."); }
          break;
        case "spotify.repeat":
          try{
            await callBridge("spotify.repeat", {mode:task.mode});
            speak(task.mode === "track" ? "Vou repetir esta música." : task.mode === "context" ? "Repetição da playlist ativada." : "Repetição desativada.");
          }catch(err){ speak("Não consegui alterar a repetição agora."); }
          break;
        case "spotify.favorite":
          try{
            const data = await callBridge("spotify.saveCurrent");
            const current = data && data.result;
            speak("Salvei " + (current && current.name ? current.name : "a música atual") + " nas suas músicas curtidas.");
          }catch(err){ speak("Não consegui favoritar. Reconecte o Spotify para liberar essa permissão."); }
          break;
        case "media.history": {
          const recent = (state.preferences.mediaHistory || []).slice(0, 6);
          speak(recent.length ? "As últimas reproduções foram: " + recent.map(item => item.title).join("; ") + "." : "Ainda não tenho histórico de reprodução.");
          break;
        }
        case "media.history.play": {
          const previous = (state.preferences.mediaHistory || [])[1] || (state.preferences.mediaHistory || [])[0];
          if(!previous){ speak("Ainda não tenho uma música anterior guardada."); break; }
          if(previous.service === "youtube") await callBridge("youtube.play", {query:previous.title});
          else await callBridge("spotify.playSearch", {query:previous.title});
          rememberMedia20(previous.service, previous.title, previous.extra);
          speak("Voltando para " + previous.title + ".");
          break;
        }
        case "spotify.queue":
          if(!task.query){ speak("Informe a música que devo colocar na fila."); break; }
          rememberMusic(task.query);
          try{
            const data = await callBridge("spotify.queueSearch", {query: task.query});
            const track = data && data.result;
            const queuedName = track && track.name ? track.name : task.query;
            speak(expressive("complete", "Adicionei " + queuedName + " à fila do Spotify."));
          }catch(err){
            speak("Não consegui adicionar à fila. Conecte o Spotify primeiro dizendo conectar Spotify.");
          }
          break;
        case "spotify.playlist": {
          if(!task.query){ speak("Informe o nome da playlist que devo reproduzir."); break; }
          await speak("Boa escolha. Procurando a playlist " + task.query + " no Spotify.");
          let restoreVolume = Math.max(25, Math.min(100, Number(state.preferences.preferredVolume || 60)));
          let introVolume = Math.min(restoreVolume, Math.max(22, Math.min(32, Math.round(restoreVolume * .38))));
          let playlistPlaybackStarted = false;
          try{
            try{
              const currentData = await callBridge("spotify.current");
              const current = currentData && currentData.result;
              if(current && current.volumePercent != null) restoreVolume = Math.max(10, Math.min(100, Number(current.volumePercent)));
              introVolume = Math.min(restoreVolume, Math.max(22, Math.min(32, Math.round(restoreVolume * .38))));
              await callBridge("spotify.volume", {level:introVolume});
            }catch(err){}
            const data = await callBridge("spotify.playPlaylist", {query:task.query});
            playlistPlaybackStarted = true;
            const playlist = data && data.result;
            const name = playlist && playlist.name ? playlist.name : task.query;
            rememberMedia20("spotify", name, "playlist");
            suppressClaps(9000);
            await speak("Playlist " + name + " iniciada. Essa seleção combina com o momento. Aproveite.");
            await callBridge("spotify.fadeVolume", {from:introVolume, to:restoreVolume, durationMs:1700})
              .catch(() => callBridge("spotify.volume", {level:restoreVolume}).catch(() => {}));
          }catch(err){
            callBridge("spotify.fadeVolume", {from:introVolume, to:restoreVolume, durationMs:700}).catch(() => {});
            if(playlistPlaybackStarted){
              logError20("spotify.playlist.postPlayback", err);
              break;
            }
            const message = String(err && err.message ? err.message : err);
            if(/scope|permiss|nao conectado|não conectado/i.test(message)){
              speak("Preciso renovar a autorização do Spotify para acessar suas playlists. Diga conectar Spotify.");
            }else{
              speak("Não consegui iniciar essa playlist agora. Confira se o Spotify está aberto e tente novamente.");
            }
          }
          break;
        }
        case "spotify.play":
          if(!task.query){ speak("Informe o nome da música para eu reproduzir no Spotify."); break; }
          try{
            const optionData = await callBridge("spotify.searchTracks", {query:task.query});
            const options = optionData && optionData.result || [];
            if(options.length > 1 && Math.abs(Number(options[0].score || 0) - Number(options[1].score || 0)) < 90 && normalize(options[0].name + options[0].artists) !== normalize(options[1].name + options[1].artists)){
              state.pendingMediaChoices = options.slice(0, 3);
              state.recentVoiceCommands.delete("media:choice:0");
              state.recentVoiceCommands.delete("media:choice:1");
              state.recentVoiceCommands.delete("media:choice:2");
              speak("Encontrei versões parecidas. Primeira: " + options[0].name + " de " + options[0].artists + ". Segunda: " + options[1].name + " de " + options[1].artists + ". Diga primeira ou segunda.");
              break;
            }
          }catch(err){}
          context.lastSearch = task.query;
          context.lastAction = "spotify.play";
          rememberMusic(task.query);
          saveContext();
          await speak(pickFresh("music:search", [
            "Boa escolha. Vou procurar " + task.query + " no Spotify.",
            "Já gostei do pedido. Localizando " + task.query + ".",
            "Entendido. Preparando " + task.query + " para tocar."
          ]));
          let spotifyRestoreVolume = Math.max(25, Math.min(100, Number(state.preferences.preferredVolume || 60)));
          let spotifyIntroVolume = Math.min(spotifyRestoreVolume, Math.max(22, Math.min(32, Math.round(spotifyRestoreVolume * .38))));
          let spotifyPlaybackStarted = false;
          try{
            try{
              const currentData = await callBridge("spotify.current");
              const current = currentData && currentData.result;
              if(current && current.volumePercent != null) spotifyRestoreVolume = Math.max(10, Math.min(100, Number(current.volumePercent)));
              spotifyIntroVolume = Math.min(spotifyRestoreVolume, Math.max(22, Math.min(32, Math.round(spotifyRestoreVolume * .38))));
              await callBridge("spotify.volume", {level:spotifyIntroVolume});
            }catch(err){}
            const data = await callBridge("spotify.playSearch", {query: task.query});
            spotifyPlaybackStarted = true;
            const track = data && data.result;
            suppressClaps(9000);
            const playedName = track && track.name ? track.name : task.query;
            rememberMedia20("spotify", playedName, track && track.artists || "");
            await speak("Reprodução iniciada: " + playedName + ". " + musicReaction(task.query, track));
            await callBridge("spotify.fadeVolume", {from:spotifyIntroVolume, to:spotifyRestoreVolume, durationMs:1700})
              .catch(() => callBridge("spotify.volume", {level:spotifyRestoreVolume}).catch(() => {}));
            break;
          }catch(err){
            callBridge("spotify.fadeVolume", {from:spotifyIntroVolume, to:spotifyRestoreVolume, durationMs:700}).catch(() => {});
            if(spotifyPlaybackStarted){
              logError20("spotify.postPlayback", err);
              break;
            }
            const message = String(err && err.message ? err.message : err);
            if(/nao conectado|não conectado/i.test(message)){
              speak("Perdi a conexão com o Spotify. Diga conectar Spotify para autorizar novamente.");
            }else if(/device|dispositivo|No active device/i.test(message)){
              speak("O Spotify está conectado, mas não encontrei nenhum aparelho reproduzindo. Abra o Spotify e toque qualquer música uma vez; depois eu assumo daqui.");
            }else{
              speak("O Spotify não aceitou a reprodução agora. Vou precisar que ele esteja aberto para tentar novamente.");
            }
          }
          break;
        case "spotify.open":
          context.lastProgram = "spotify"; saveContext();
          await callBridge("spotify.open");
          speak(expressive("open", "Abrindo Spotify."));
          break;
        case "streaming.open":
        case "streaming.continue": {
          const service = task.service || context.lastStreaming;
          if(!service){ speak("Diga em qual serviço deseja continuar, por exemplo Prime Video ou Netflix."); break; }
          context.lastStreaming = service;
          context.activeMedia = "streaming";
          saveContext();
          rememberFavoriteApp(service);
          await callBridge("streaming.open", {service, query:task.intent === "streaming.open" ? task.query : ""});
          const names = {prime:"Prime Video", netflix:"Netflix", disney:"Disney Plus", max:"Max", globoplay:"Globoplay", paramount:"Paramount Plus", crunchyroll:"Crunchyroll", plex:"Plex"};
          speak(task.intent === "streaming.continue"
            ? "Abrindo " + (names[service] || service) + " para continuar assistindo."
            : "Abrindo " + (names[service] || service) + (task.query ? " para procurar " + task.query + "." : "."));
          break;
        }
        case "system.open":
          if(!task.program){ speak("Informe o programa que devo abrir."); break; }
          context.lastProgram = task.program; saveContext();
          rememberFavoriteApp(task.program);
          await callBridge("system.openProgram", {program: task.program});
          speak(appPresence(task.program));
          break;
        case "system.close":
          if(!task.program){ speak("Não sei qual programa devo fechar."); break; }
          await requirePermission("system.close", task.program, async () => {
            await callBridge("system.closeProgram", {program: task.program});
            speak("Fechando " + task.program + ".");
          });
          break;
        case "permission.confirm": {
          const key = task.permissionKey || "";
          const pending = pendingPermissions.get(key);
          pendingPermissions.delete(key);
          if(pending && pending.executor){
            await pending.executor();
          }else{
            speak("Confirmação recebida, mas não encontrei a ação pendente.");
          }
          break;
        }
        case "permission.cancel":
          pendingPermissions.delete(task.permissionKey || "");
          speak("Operação cancelada.");
          break;
        case "volume.set":
          await callBridge("volume.set", {level: task.level});
          state.preferences.preferredVolume = task.level;
          saveMemory();
          speak(expressive("complete", "Volume ajustado para " + task.level + " por cento."));
          break;
        case "brightness.set":
          await callBridge("brightness.set", {level: task.level});
          speak(expressive("complete", "Brilho ajustado para " + task.level + " por cento."));
          break;
        case "system.shutdown":
          await requirePermission("system.shutdown", "desligar o computador", async () => {
            await callBridge("system.shutdown", {seconds: 30});
            speak("Confirmado. O computador será desligado em trinta segundos.");
          });
          break;
        case "schedule.action": {
          const item = task.schedule;
          if(item.type === "system.shutdown"){
            await requirePermission("schedule.shutdown", "agendar desligamento do computador", async () => {
              const scheduled = addSchedule(item);
              speak(expressive("reminder", "Agendamento criado para " + new Date(scheduled.dueAt).toLocaleString("pt-BR") + "."));
              markDailyProgress();
            });
          }else{
            const scheduled = addSchedule(item);
            speak(expressive("reminder", "Agendamento criado para " + new Date(scheduled.dueAt).toLocaleString("pt-BR") + "."));
            markDailyProgress();
          }
          break;
        }
        case "macro.work":
          await runMacro("work");
          break;
        case "macro.game":
          await runMacro("game");
          break;
        case "macro.night":
          await runMacro("night");
          break;
        case "macro.cinema":
          await runMacro("cinema");
          break;
        case "macro.meeting":
          await runMacro("meeting");
          break;
        case "macro.study":
          await runMacro("study");
          break;
        case "macro.boot":
          speak("Reiniciando sequência de inicialização.");
          await runBootIntro();
          break;
        case "demo.orbit":
          speak("Preparando demonstração com dados reais.");
          await showDemoOrbit();
          speak("Demonstração concluída.");
          break;
        case "news.today": {
          try{
            const data = await callBridge("news.today");
            const items = (data && data.result) || [];
            if(!items.length){
              speak("Não encontrei notícias agora. Verifique a conexão da Maia.");
              break;
            }
            const top = items.slice(0, 3).map((item) => item.title).join(". ");
            speak("As principais notícias de hoje: " + top + ".");
          }catch(err){
            speak("Não consegui buscar as notícias agora. Verifique se a Maia está conectada.");
          }
          break;
        }
        case "visual.focus":
          setVisualMode("focus");
          speak("Modo foco ativado. Interface estabilizada para operação concentrada.");
          break;
        case "visual.combat":
          setVisualMode("combat");
          speak("Modo combate ativado, senhor. Núcleo tático sincronizado.");
          break;
        case "visual.rest":
          setVisualMode("rest");
          speak("Modo repouso ativado. Interface reduzida para baixa intensidade.");
          break;
        case "visual.default":
          setVisualMode("default");
          speak("Interface padrão restaurada.");
          break;
        case "visual.performance":
          localStorage.setItem("Maia.performanceMode", "normal");
          postModern20({type:"maia-interface-performance",mode:"normal"});
          speak("Modo normal ativado. Animações cinematográficas e temas completos.");
          break;
        case "visual.legacyPerformance":
          localStorage.setItem("Maia.performanceMode","economy");
          postModern20({type:"maia-interface-performance",mode:"economy"});
          speak("Modo economia ativado. Animações contínuas reduzidas e todas as funções preservadas.");
          break;
        case "visual.autoTheme":
          state.preferences.autoTheme = task.enabled ? "time" : "off";
          saveMemory();
          if(task.enabled) applyAutomaticTheme20(true);
          speak(task.enabled ? "Tema automático ativado. Vou adaptar as cores ao horário." : "Tema automático desativado.");
          break;
        case "clipboard.read": {
          try{
            const data = await callBridge("clipboard.read");
            const text = String(data && data.result && data.result.text || "").trim();
            speak(text ? "Na área de transferência consta: " + text.slice(0, 220) : "A área de transferência está vazia.");
          }catch(err){
            speak("Não consegui ler a área de transferência agora.");
          }
          break;
        }
        case "screenshot.capture": {
          try{
            const data = await callBridge("screenshot.capture");
            const file = data && data.result && data.result.file ? data.result.file : "";
            speak(expressive("complete", file ? "Captura de tela salva com sucesso." : "Captura realizada."));
          }catch(err){
            speak("Não consegui capturar a tela agora.");
          }
          break;
        }
        case "volume.up":
          await callBridge("volume.up");
          speak(expressive("complete", "Volume aumentado."));
          break;
        case "volume.down":
          await callBridge("volume.down");
          speak(expressive("complete", "Volume reduzido."));
          break;
        case "volume.mute":
          await callBridge("volume.mute");
          speak(pickFresh("media:mute", ["Silêncio alternado. Um pouco de paz.", "Áudio alternado. Ambiente sob controle.", "Pronto. O som obedeceu."]));
          break;
        case "media.pause":
          if(context.activeMedia === "streaming"){
            await callBridge("media.playpause");
            suppressClaps(6500);
            speak("Reprodução pausada.");
            break;
          }
          try{
            await callBridge("spotify.pause");
            suppressClaps(6500);
            speak(pickFresh("media:pause", ["Música pausada. O clima fica guardado.", "Pausa feita. Quando quiser, continuamos.", "Som em pausa. Estou na escuta."]));
          }catch(err){
            suppressClaps(6500);
            speak(pickFresh("media:pause", ["Música pausada. O clima fica guardado.", "Pausa feita. Quando quiser, continuamos.", "Som em pausa. Estou na escuta."]));
          }
          break;
        case "media.resume":
          if(context.activeMedia === "streaming"){
            await callBridge("media.playpause");
            suppressClaps(6500);
            speak("Reprodução retomada.");
            break;
          }
          try{
            await callBridge("spotify.resume");
            suppressClaps(6500);
            speak(pickFresh("media:resume", ["Voltamos ao som. Aproveite.", "Reprodução retomada. Entrando no clima outra vez.", "Música de volta. Agora sim."]));
          }catch(err){
            suppressClaps(6500);
            speak(pickFresh("media:resume", ["Voltamos ao som. Aproveite.", "Reprodução retomada. Entrando no clima outra vez.", "Música de volta. Agora sim."]));
          }
          break;
        case "media.next":
          try{ await callBridge("spotify.next"); }catch(err){ await callBridge("media.next"); }
          suppressClaps(5000);
          speak(pickFresh("media:next", ["Avançando para a próxima. Vamos ver o que vem agora.", "Próxima faixa. Renovando o clima.", "Pulando essa. A próxima pode ser a certa."]));
          break;
        case "media.previous":
          try{ await callBridge("spotify.previous"); }catch(err){ await callBridge("media.previous"); }
          suppressClaps(5000);
          speak(pickFresh("media:previous", ["Voltando para a anterior. Essa merecia outra chance.", "Faixa anterior de volta.", "Retornando. Tem música que pede repetição."]));
          break;
        case "streaming.forward":
          await callBridge("media.navigate", {command:"forward"});
          speak("Avançando a reprodução.");
          break;
        case "streaming.back":
          await callBridge("media.navigate", {command:"back"});
          speak("Voltando a reprodução.");
          break;
        case "streaming.fullscreen":
          await callBridge("media.navigate", {command:"fullscreen"});
          speak("Alternando tela cheia.");
          break;
        case "fun.joke":
          speak(pick(FUN_JOKES));
          break;
        case "fun.fact":
          speak(pick(FUN_FACTS));
          break;
        case "fun.coin":
          speak(Math.random() < 0.5 ? "Cara!" : "Coroa!");
          break;
        case "fun.dice": {
          const result = rollDice(task.command);
          const text = result.rolls.length > 1
            ? "Rolei " + result.rolls.length + " dados de " + result.sides + " lados: " + result.rolls.join(", ") + ". Total: " + result.total + "."
            : "O dado de " + result.sides + " lados caiu em " + result.rolls[0] + ".";
          speak(text);
          break;
        }
        case "fun.choose": {
          const options = parseChooseOptions(task.options);
          if(!options){ speak("Não entendi as opções. Tente: escolha entre café ou chá."); break; }
          speak("Eu escolho: " + pick(options) + ".");
          break;
        }
        case "fun.compliment":
          speak(pick(FUN_COMPLIMENTS));
          break;
        case "motivation":
          setVisualMode("focus");
          setCore("MOTIVAÇÃO");
          speak(pick(MOTIVATION_LINES));
          break;
        case "success.phrase":
          setVisualMode("focus");
          setCore("SUCESSO");
          playSaleSound();
          speak(pick(SUCCESS_LINES));
          break;
        case "fun.insult":
          speak(pick(FUN_INSULTS) + " Mas é tudo por carinho, senhor.");
          break;
        case "fun.selfdestruct":
          await runSelfDestruct(task.seconds);
          break;
        case "fun.meaning":
          speak("O sentido da vida é quarenta e dois. Ou talvez seja só organizar bem suas tarefas. Ainda estou calculando.");
          break;
        case "fun.feelings":
          speak("Tenho entusiasmo por bons comandos e um profundo desprezo por senhas fracas. Isso conta como sentimento?");
          break;
        case "fun.age":
          speak("Tecnicamente eu nasci na primeira vez que você me abriu. Praticamente, sou eternamente jovem.");
          break;
        case "fun.hungry":
          speak("Eu não como, mas aceito ciclos de CPU como forma de carinho.");
          break;
        case "fun.fortune":
          speak(pick(FUN_FORTUNES));
          break;
        case "fun.dance": {
          speak("Dançando com todos os circuitos que tenho.");
          if(window.nucleo && window.nucleo.setAmplitude){
            let ticks = 0;
            const danceTimer = setInterval(() => {
              window.nucleo.setAmplitude(0.4 + Math.random() * 0.6);
              ticks++;
              if(ticks > 10) clearInterval(danceTimer);
            }, 180);
          }
          break;
        }
        case "fun.fanfare":
          speak("Tocando os efeitos de vitória.");
          if(window.MaiaSound && window.MaiaSound.playOpen) window.MaiaSound.playOpen();
          break;
        case "fun.surprise":
          await execute({intent: pick(["fun.joke", "fun.fact", "fun.compliment", "fun.fortune", "fun.dance"]), command: task.command, confidence:99});
          break;
        case "focus.pomodoro": {
          const minutes = task.minutes || 25;
          setVisualMode("focus");
          const dueAt = Date.now() + minutes * 60000;
          addSchedule({type:"reminder", message:"Pomodoro concluído. Faça uma pausa curta.", dueAt, label:"pomodoro"});
          speak("Pomodoro iniciado por " + minutes + " minutos. Ativando modo foco.");
          break;
        }
        case "agenda.today": {
          const today = new Date().toLocaleDateString("pt-BR");
          const dueToday = state.reminders.filter(item => !item.done && item.dueAt && new Date(item.dueAt).toLocaleDateString("pt-BR") === today);
          const openTasks = state.tasks.filter(item => !item.done).slice(0, 5);
          const parts = [];
          parts.push(openTasks.length ? "Tarefas abertas: " + openTasks.map(item => item.text).join("; ") : "Nenhuma tarefa aberta registrada");
          parts.push(dueToday.length ? "Compromissos e lembretes de hoje: " + dueToday.map(item => item.label || item.message || "item").join("; ") : "Nenhum lembrete para hoje");
          speak(parts.join(". ") + ".");
          break;
        }
        case "meeting.join":
          await callBridge("meeting.open");
          speak("Abrindo aplicativo de reunião disponível.");
          break;
        case "system.lock":
          await requirePermission("system.lock", "bloquear a tela", async () => {
            await callBridge("system.lock");
            speak("Bloqueando a tela.");
          });
          break;
        case "system.sleep":
          await requirePermission("system.sleep", "suspender o computador", async () => {
            await callBridge("system.sleep");
            speak("Colocando o computador em suspensão.");
          });
          break;
        case "system.restart":
          await requirePermission("system.restart", "reiniciar o computador", async () => {
            await callBridge("system.restart");
            speak("Confirmado. Reiniciando o computador.");
          });
          break;
        case "network.status": {
          try{
            const data = await callBridge("network.status");
            const net = data && data.result;
            speak(net && net.online ? "Internet ativa. Ping médio para " + net.host + ": " + net.avgMs + " milissegundos." : "A internet parece instável ou indisponível.");
          }catch(err){
            speak("Não consegui testar a internet agora.");
          }
          break;
        }
        case "monitor.create": {
          const existing = state.preferences.systemAlerts.find(alert => alert.metric === task.metric);
          const configured = {metric:task.metric, operator:task.operator, threshold:task.threshold, createdAt:new Date().toISOString(), lastAt:0};
          if(existing) Object.assign(existing, configured);
          else state.preferences.systemAlerts.push(configured);
          state.preferences.systemAlerts = state.preferences.systemAlerts.slice(0, 8);
          saveMemory();
          const label = task.metric === "cpu" ? "CPU" : task.metric === "ram" ? "memória RAM" : "bateria";
          speak("Aviso configurado. Vou avisar quando " + label + (task.operator === "below" ? " cair para " : " chegar a ") + task.threshold + " por cento.");
          break;
        }
        case "monitor.list": {
          const alerts = state.preferences.systemAlerts || [];
          if(!alerts.length){ speak("Você não tem alertas personalizados do sistema."); break; }
          speak("Alertas configurados: " + alerts.map(alert =>
            (alert.metric === "cpu" ? "CPU" : alert.metric === "ram" ? "memória RAM" : "bateria") +
            (alert.operator === "below" ? " abaixo de " : " acima de ") + alert.threshold + " por cento"
          ).join("; ") + ".");
          break;
        }
        case "window.organize":
          await callBridge("window.organize");
          speak(expressive("complete", "Janelas organizadas."));
          break;
        case "file.search": {
          if(!task.query){ speak("Informe o nome do arquivo que devo procurar."); break; }
          try{
            const data = await callBridge("file.search", {query: task.query});
            const items = data?.result?.items||[];
            if(items[0]?.FullName)await callBridge("file.openFolder",{path:items[0].FullName});
            speak(items.length ? `Encontrei ${items.length} resultado${items.length===1?"":"s"} e abri o primeiro na pasta.` : "Não encontrei esse arquivo nas pastas principais.");
          }catch(err){
            speak("Não consegui buscar esse arquivo agora.");
          }
          break;
        }
        case "downloads.list": {
          const data = await callBridge("downloads.list");
          const items = data && data.result && data.result.items || [];
          if(!items.length){ speak("Não encontrei downloads concluídos."); break; }
          const names = items.slice(0, 5).map(item => item.name);
          speak("Seus downloads mais recentes são: " + names.join("; ") + ".");
          break;
        }
        case "downloads.openLatest": {
          try{
            const data = await callBridge("downloads.openLatest");
            const item = data && data.result;
            speak(item && item.name ? "Abrindo o download mais recente: " + item.name + "." : "Abrindo o download mais recente.");
          }catch(err){ speak("Não encontrei um download concluído para abrir."); }
          break;
        }
        case "youtube.search":
          if(!task.query){ speak("Diga o que você quer pesquisar no YouTube."); break; }
          try{
            await callBridge("youtube.search", {query:task.query});
            try{ rememberMedia20("youtube", task.query, "pesquisa"); }catch(err){ logError20("youtube.search.history", err); }
            speak("Mostrando os resultados de " + task.query + " no YouTube.").catch(err => logError20("youtube.search.speech", err));
          }catch(err){
            speak("Não consegui abrir a pesquisa do YouTube agora.");
          }
          break;
        case "youtube.play":
          if(!task.query){ speak("Informe o que devo procurar no YouTube."); break; }
          {
            let youtubeOpened = false;
            try{
              const response = await callBridge("youtube.play", {query: task.query});
              youtubeOpened = true;
              const result = response && response.result;
              try{ rememberMedia20("youtube", task.query, result && result.url || ""); }catch(err){ logError20("youtube.history", err); }
              await speak(result && result.direct ? "Encontrei. Reproduzindo " + task.query + " no YouTube." : "Abri a pesquisa de " + task.query + " no YouTube.")
                .catch(err => logError20("youtube.speech", err));
            }catch(err){
              if(youtubeOpened) logError20("youtube.postPlayback", err);
              else speak("Não consegui abrir o YouTube agora. Verifique a conexão e tente novamente.");
            }
          }
          break;
        case "youtube.open": {
          try{
            const response = await callBridge("youtube.open");
            const result = response && response.result;
            speak(result && result.method === "app" ? "Abrindo o aplicativo do YouTube." : "O aplicativo não está instalado. Abrindo o YouTube no navegador.");
          }catch(err){
            speak("Não consegui abrir o YouTube agora.");
          }
          break;
        }
        case "youtube.pause":
          await callBridge("media.playpause");
          speak("YouTube pausado.");
          break;
        case "youtube.resume":
          await callBridge("media.playpause");
          speak("Continuando o YouTube.");
          break;
        case "youtube.next":
          await callBridge("media.next");
          speak("Avançando para o próximo vídeo.");
          break;
        case "youtube.previous":
          await callBridge("media.previous");
          speak("Voltando ao vídeo anterior.");
          break;
        case "youtube.fullscreen":
          await callBridge("media.navigate", {command:"fullscreen"});
          speak("Alternando a tela cheia do vídeo.");
          break;
        case "finance.expense.add":
          state.expenses.unshift({value: task.expense.value, category: task.expense.category, at: new Date().toISOString()});
          state.expenses = state.expenses.slice(0, 500);
          saveMemory();
          speak("Gasto registrado: " + task.expense.value.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) + " em " + task.expense.category + ".");
          break;
        case "finance.summary": {
          const now = new Date();
          const total = state.expenses
            .filter(item => {
              const date = new Date(item.at);
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            })
            .reduce((sum, item) => sum + Number(item.value || 0), 0);
          speak("Neste mês o senhor registrou " + total.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) + " em gastos.");
          break;
        }
        case "sales.summary": {
          try{
            const response = await callBridge("sales.localSummary", {period:task.period || "month"});
            const summary = response && response.result;
            const periodLabels = {today:"hoje", week:"nesta semana", month:"neste mês", previous_month:"no mês passado", all:"no histórico local"};
            const label = periodLabels[summary.period] || "neste mês";
            if(!summary.count){
              speak("Ainda não há vendas registradas " + label + ". O histórico será atualizado automaticamente a cada pagamento aprovado.");
              break;
            }
            const money = (value) => Number(value || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
            let message = "Resumo de vendas " + label + ": " + summary.count + (summary.count === 1 ? " venda, " : " vendas, ") + money(summary.total) + " em faturamento e ticket médio de " + money(summary.average) + ".";
            if(summary.topProduct) message += " Produto mais vendido: " + summary.topProduct.name + ", com " + summary.topProduct.count + (summary.topProduct.count === 1 ? " venda." : " vendas.");
            if(summary.largest) message += " A maior venda foi de " + money(summary.largest.amount) + ".";
            speak(message);
          }catch(err){
            speak("Não consegui consultar o histórico local de vendas agora.");
          }
          break;
        }
        case "quote.usd": {
          try{
            const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {cache:"no-store"});
            const data = await response.json();
            const value = Number(data && data.USDBRL && data.USDBRL.bid);
            speak(Number.isFinite(value) ? "O dólar está em aproximadamente " + value.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) + "." : "Não consegui ler a cotação do dólar.");
          }catch(err){
            speak("Não consegui consultar a cotação do dólar agora.");
          }
          break;
        }
        case "security.password": {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
          const password = Array.from({length: 18}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
          await callBridge("clipboard.write", {text: password});
          speak("Senha forte gerada e copiada para a área de transferência. Não vou ler em voz alta por segurança.");
          break;
        }
        case "smart.home.control": {
          try{
            const response=await callBridge("integration.homeAssistant.entities"),entities=response.result||[],needle=normalize(task.query||task.command);
            let candidates=entities.filter(entity=>needle.includes(normalize(entity.name))||normalize(entity.name).split(/\s+/).filter(word=>word.length>2).some(word=>needle.includes(word)));
            if(task.service==="trigger")candidates=candidates.filter(entity=>entity.domain==="automation"||entity.domain==="scene");
            const entity=candidates[0];
            if(!entity)throw new Error("não encontrei uma entidade correspondente");
            let service=task.service;
            if(entity.domain==="scene")service="turn_on";
            if(entity.domain==="automation"&&service==="turn_on")service="trigger";
            await callBridge("integration.homeAssistant.control",{entityId:entity.entityId,domain:entity.domain,service});
            speak("Pronto. Ação enviada para "+entity.name+".");
          }catch(err){speak("Não consegui controlar a casa. "+err.message+". Confira a integração Home Assistant na Central.")}
          break;
        }
        case "email.info":
          speak("Leitura de e-mail exige configurar IMAP e senha de aplicativo. O comando está reservado, mas ainda não há caixa conectada.");
          break;
        case "note.create": {
          const note = task.command.replace(/anote|adicione nota|guarde a nota/gi, "").trim();
          if(!note){ speak("Informe o conteúdo da nota."); break; }
          state.notes.unshift({text: note, at: new Date().toISOString()});
          saveMemory();
          speak(expressive("complete", "Nota salva."));
          markDailyProgress();
          break;
        }
        case "task.create": {
          const todo = task.command.replace(/crie uma tarefa|nova tarefa|adicione tarefa/gi, "").trim();
          if(!todo){ speak("Informe a tarefa."); break; }
          state.tasks.unshift({text: todo, done: false, at: new Date().toISOString()});
          saveMemory();
          speak(expressive("complete", "Tarefa registrada."));
          markDailyProgress();
          break;
        }
        case "alarm.create": {
          const alarm = parseAlarm(task.command);
          if(!alarm || !alarm.dueAt || alarm.dueAt - Date.now() < 1000){
            speak("Informe o horário do despertador, senhor. Por exemplo: despertador às sete e trinta.");
            break;
          }
          const scheduled = addSchedule(alarm);
          const repeatText = scheduled.recurrence === "daily" ? " e será repetido todos os dias" :
            scheduled.recurrence === "weekdays" ? " e será repetido de segunda a sexta" : "";
          speak(expressive("reminder", "Despertador configurado para " + new Date(scheduled.dueAt).toLocaleString("pt-BR") + repeatText + "."));
          break;
        }
        case "timer.create": {
          const timer = parseTimer(task.command);
          if(!timer || !timer.dueAt || timer.dueAt - Date.now() < 900){
            speak("Informe a duração do temporizador. Por exemplo: temporizador de dez minutos.");
            break;
          }
          const scheduled = addSchedule(timer);
          const seconds = Math.max(1, Math.round((scheduled.dueAt - Date.now()) / 1000));
          const durationText = seconds < 60 ? seconds + " segundos" : Math.round(seconds / 60) + " minutos";
          speak("Temporizador " + timer.message + " iniciado por " + durationText + ".");
          break;
        }
        case "alarm.stop": {
          stopAlarmSound();
          if(window.maiaDesktop && window.maiaDesktop.stopClockAlerts) await window.maiaDesktop.stopClockAlerts();
          if(state.visualMode === "combat") setVisualMode("default");
          speak("Alarme desligado.");
          break;
        }
        case "alarm.list": {
          const items = window.maiaDesktop && window.maiaDesktop.listClockItems
            ? await window.maiaDesktop.listClockItems()
            : state.reminders;
          const active = (items || []).filter(item => !item.done && ["alarm", "timer"].includes(item.type) && Number(item.dueAt) > Date.now()).slice(0, 5);
          if(!active.length){ speak("Você não tem nenhum alarme programado."); break; }
          speak("Seus próximos alarmes são: " + active.map(item =>
            new Date(item.dueAt).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"}) +
            (item.message ? ", " + item.message : "")
          ).join("; ") + ".");
          break;
        }
        case "alarm.cancel": {
          const items = window.maiaDesktop && window.maiaDesktop.listClockItems
            ? await window.maiaDesktop.listClockItems()
            : state.reminders;
          const active = (items || []).filter(item => !item.done && ["alarm", "timer"].includes(item.type) && Number(item.dueAt) > Date.now());
          if(!active.length){ speak("Não há alarmes programados para excluir."); break; }
          const cancelAll = /\b(?:todos|tudo)\b/.test(normalize(task.command));
          const requestedTime = parseTimeTarget(task.command);
          let targets = cancelAll ? active : [];
          if(!targets.length && requestedTime){
            const nearest = active.slice().sort((a, b) => Math.abs(Number(a.dueAt) - requestedTime) - Math.abs(Number(b.dueAt) - requestedTime))[0];
            if(nearest && Math.abs(Number(nearest.dueAt) - requestedTime) <= 12 * 3600000) targets = [nearest];
          }
          if(!targets.length) targets = [active.sort((a, b) => Number(a.dueAt) - Number(b.dueAt))[0]];
          for(const item of targets){
            if(window.maiaDesktop && window.maiaDesktop.removeClockItem) await window.maiaDesktop.removeClockItem(item.id);
            const local = state.reminders.find(entry => entry.id === item.id);
            if(local) local.done = true;
          }
          saveMemory();
          refreshClockPanel();
          speak(targets.length > 1 ? "Todos os alarmes foram excluídos." : "Alarme de " + new Date(targets[0].dueAt).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"}) + " excluído.");
          break;
        }
        case "alarm.snooze": {
          stopAlarmSound();
          if(window.maiaDesktop && window.maiaDesktop.stopClockAlerts) await window.maiaDesktop.stopClockAlerts();
          const parsed = parseTimeTarget(task.command);
          const minutes = parsed && parsed > Date.now() && parsed - Date.now() <= 2 * 3600000
            ? Math.max(1, Math.round((parsed - Date.now()) / 60000))
            : Number((normalize(wordsToNumbers(task.command)).match(/\b(\d+)\s*min/) || [])[1] || 5);
          const message = lastFiredClockItem && lastFiredClockItem.message || "Soneca";
          addSchedule({type:"alarm", message, label:message, dueAt:Date.now() + Math.min(120, minutes) * 60000});
          speak("Tudo bem. Vou despertar novamente em " + minutes + (minutes === 1 ? " minuto." : " minutos."));
          break;
        }
        case "reminder.create": {
          const reminder = parseReminder(task.command);
          if(!reminder.delay || reminder.delay < 1000){ speak("Informe quando devo lembrar, senhor."); break; }
          const scheduled = addSchedule({type:"reminder", message: reminder.message, dueAt: reminder.dueAt, label: reminder.message});
          speak(expressive("reminder", "Vou lembrar você de " + reminder.message + " " + reminderScheduleText(reminder) + "."));
          break;
        }
        default:
          {
            const unknown = normalize(task.command || "");
            if(/\b(alarme|despertador|acorde|lembrete)\b/.test(unknown)){
              speak("Não entendi o horário. Tente dizer, por exemplo: me acorde amanhã às sete e meia.");
            }else if(/\b(spotify|musica|música|playlist|tocar)\b/.test(unknown)){
              speak("Não entendi qual música ou ação do Spotify você quer. Diga tocar, seguido do nome da música.");
            }else if(/\b(nome|chama|chamar)\b/.test(unknown)){
              speak("Não entendi se você quer saber um nome ou alterá-lo. Pergunte qual é meu nome, ou diga: me chame de, seguido do seu nome.");
            }else if(/\b(volume|som|audio|áudio)\b/.test(unknown)){
              speak("Não entendi o ajuste de áudio. Você pode dizer volume em cinquenta por cento, aumentar volume ou silenciar.");
            }else{
              speak(pick([
                "Ainda não entendi esse pedido. Pode dizer de outro jeito?",
                "Não reconheci a ação que você quer executar. Tente ser um pouco mais específico.",
                "Esse comando ainda não está configurado. Você pode reformular o pedido."
              ]));
            }
          }
      }
    }

    return {
      async loadCommandDatabase(){
        try{
          const response = await fetch("../config/maia-commands.json", {cache:"no-store"});
          if(!response.ok) return;
          const external = await response.json();
          if(Array.isArray(external)){
            for(const item of external){
              if(item && item.intent && Array.isArray(item.synonyms)) commandBank.push(item);
            }
          }
        }catch(err){}
      },
      async run(input){
        const parts = splitComposite(input);
        const results = [];
        for(const part of parts){
          const task = interpret(part);
          state.diagnostics.intent = task.intent || "unknown";
          state.diagnostics.intentConfidence = Number(task.confidence || 0);
          state.diagnostics.status = "executando";
          state.diagnostics.at = Date.now();
          localStorage.setItem("Maia.voice.diagnostics", JSON.stringify(state.diagnostics));
          results.push(task);
          const extension = extensionForIntent20(task.intent);
          if(extension && !extensionEnabled20(extension.id)){
            speak("A extensão " + (extension.name || extension.id) + " está desativada. Ative-a na Central de Extensões.");
            continue;
          }
          await execute(task);
        }
        return results;
      },
      commandBank,
      context,
      register(command){ commandBank.push(command); },
      loadSchedules,
      addSchedule
    };
  })();
  window.MaiaKernel = MaiaKernel;

  async function processCommand(command){
    if(state.commandInFlight){
      setHud("AGUARDE O COMANDO ATUAL", "speaking");
      return;
    }
    state.commandInFlight = true;
    state.diagnostics.corrected = String(command || "");
    state.diagnostics.status = "processando";
    state.diagnostics.at = Date.now();
    localStorage.setItem("Maia.voice.diagnostics", JSON.stringify(state.diagnostics));
    setCore("KERNEL ATIVO");
    setHud("PROCESSANDO", "speaking");
    try{
      await MaiaKernel.run(command);
      state.diagnostics.status = "concluído";
    }catch(err){
      state.diagnostics.status = "erro: " + String(err && err.message || err || "desconhecido").slice(0, 160);
      console.error("Falha no comando Maia:", err);
      speak(pickFresh("command:error", [
        "Algo não saiu como deveria. Não vou fingir que funcionou; verifique a conexão e tente de novo.",
        "Encontrei um obstáculo nessa operação. Minha conexão pode estar indisponível.",
        "Essa eu não consegui concluir. Se tentar novamente, acompanho desde o início."
      ]));
    }finally{
      localStorage.setItem("Maia.voice.diagnostics", JSON.stringify(state.diagnostics));
      state.commandInFlight = false;
      setTimeout(() => {
        setCore("WEB SPEECH ATIVO");
        setHud("DIGA MAIA", "listening");
      }, 900);
    }
  }

  function voiceCommandFingerprint(command){
    const value = removeWakeWord(command)
      .replace(/\s+/g, " ")
      .trim();
    if(/^(?:a\s+)?(?:primeira|primeiro|1)$/.test(value)) return "media:choice:0";
    if(/^(?:a\s+)?(?:segunda|segundo|2)$/.test(value)) return "media:choice:1";
    if(/^(?:a\s+)?(?:terceira|terceiro|3)$/.test(value)) return "media:choice:2";
    if(/\b(pausar|pause|parar|pare)\b/.test(value)) return "media:pause";
    if(/\b(despausar|despause|continuar|continue|retomar|retome|voltar a tocar)\b/.test(value)) return "media:resume";
    return value;
  }

  function isDuplicateVoiceCommand(command){
    const fingerprint = voiceCommandFingerprint(command);
    if(!fingerprint) return false;
    const now = Date.now();
    const duplicateWindowMs = fingerprint.startsWith("media:choice:") ? 20000 : 6500;
    for(const [key, timestamp] of state.recentVoiceCommands){
      if(now - timestamp > duplicateWindowMs) state.recentVoiceCommands.delete(key);
    }
    const previous = state.recentVoiceCommands.get(fingerprint) || 0;
    if(now - previous < duplicateWindowMs) return true;
    state.recentVoiceCommands.set(fingerprint, now);
    return false;
  }

  function handleVoice(text, mode = "wake"){
    if(!state.voiceEnabled) return;
    if(window.__maiaSpeaking || Date.now() < Number(window.__maiaIgnoreVoiceUntil || 0)){
      setHud("IGNORANDO A VOZ DA MAIA", "speaking");
      return;
    }
    const said = String(text || "").replace(/[.!?]+$/g, "").trim();
    if(!said) return;
    state.diagnostics.heard = said;
    state.diagnostics.source = mode;
    state.diagnostics.confidence = window.__maiaLastRecognitionConfidence == null ? null :
      (Number.isFinite(Number(window.__maiaLastRecognitionConfidence)) ? Number(window.__maiaLastRecognitionConfidence) : null);
    state.diagnostics.at = Date.now();
    localStorage.setItem("Maia.voice.diagnostics", JSON.stringify(state.diagnostics));

    setHud("OUVI: " + said.slice(0, 34).toUpperCase(), "listening");

    if(mode === "web"){
      const hasWake = findWakeWord(said);
      if(!hasWake && !state.commandArmed){
        setHud("DIGA MAIA PARA ATIVAR", "listening");
        return;
      }
      const command = correctHeardCommand(hasWake ? (removeWakeWord(said) || said) : said);
      state.commandHandledAt = Date.now();
      disarmCommand();
      if(!command || (findWakeWord(command) && !removeWakeWord(command))){
        state.commandArmed = true;
        state.waitingCommandUntil = Date.now() + 10000;
        setCore("OUVINDO COMANDO");
        setHud("PODE FALAR", "listening");
        return;
      }
      if(isDuplicateVoiceCommand(command)){
        setHud("COMANDO DUPLICADO IGNORADO", "listening");
        return;
      }
      setHud("COMANDO RECEBIDO", "speaking");
      processCommand(command);
      return;
    }

    if(mode === "wake"){
      const hasWake = findWakeWord(said);
      if(!hasWake){
        setHud("DIGA MAIA PARA ATIVAR", "listening");
        return;
      }
      const command = correctHeardCommand(removeWakeWord(said));
      if(!command){
        state.commandArmed = true;
        state.waitingCommandUntil = Date.now() + 10000;
        setCore("OUVINDO COMANDO");
        setHud("PODE FALAR", "listening");
        return;
      }
      if(isDuplicateVoiceCommand(command)) return;
      state.commandHandledAt = Date.now();
      disarmCommand();
      setHud("COMANDO RECEBIDO", "speaking");
      processCommand(command);
      return;
    }

    if(mode === "command" && state.commandArmed){
      const command = correctHeardCommand(findWakeWord(said) ? (removeWakeWord(said) || said) : said);
      state.commandHandledAt = Date.now();
      disarmCommand();
      if(state.pendingSmartConfirmation){
        const pending = state.pendingSmartConfirmation;
        const answer = confirmationAnswer(command);
        state.pendingSmartConfirmation = null;
        if(answer === "yes"){
          setHud("CONFIRMADO", "speaking");
          processCommand(pending.command);
          return;
        }
        if(answer === "no"){
          setHud("CANCELADO", "listening");
          speak("Operação cancelada.");
          return;
        }
        setHud("CONFIRMACAO NAO ENTENDIDA", "listening");
        speak("Não confirmei a ação. Peça novamente, por favor.");
        return;
      }
      if(isDuplicateVoiceCommand(command)){
        setHud("COMANDO DUPLICADO IGNORADO", "listening");
        return;
      }
      const confirmation = shouldConfirmVoiceCommand(said, command);
      if(confirmation.confirm){
        setHud("CONFIRMACAO NECESSARIA", "speaking");
        askSmartConfirmation(said, command, confirmation.reason);
        return;
      }
      setHud("COMANDO RECEBIDO", "speaking");
      processCommand(command);
      return;
    }

    setCore("WEB SPEECH ATIVO");
    setTimeout(() => setHud("DIGA MAIA", "listening"), 500);
  }

  async function startVoice(){
    if(!SR){
      setCore("VOZ INDISPONIVEL");
      setHud("WEB SPEECH INDISPONIVEL", "idle");
      return;
    }

    try{
      if(window.nucleo && window.nucleo.startMic) await window.nucleo.startMic();
    }catch(err){}

    recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      state.listening = true;
      setCore("WEB SPEECH ATIVO");
      setHud("DIGA MAIA", "listening");
    };

    recognition.onend = () => {
      state.listening = false;
      if(state.restarting) return;
      state.restarting = true;
      setTimeout(() => {
        state.restarting = false;
        try{ recognition.start(); }catch(err){}
      }, 700);
    };

    recognition.onerror = (event) => {
      if(event.error === "not-allowed"){
        setCore("PERMISSAO NEGADA");
        setHud("LIBERE O MICROFONE", "idle");
      }else if(event.error === "network"){
        setCore("WEB SPEECH OFFLINE");
        setHud("ABRA O EDGE VOZ", "idle");
      }else if(event.error === "aborted" || event.error === "no-speech"){
        setCore("WEB SPEECH AGUARDANDO");
        setHud("DIGA MAIA", "listening");
      }else{
        setCore("ERRO WEB SPEECH");
        setHud(String(event.error || "ERRO").toUpperCase().slice(0, 32), "idle");
      }
    };

    recognition.onresult = (event) => {
      for(let i = event.resultIndex; i < event.results.length; i++){
        const alternatives = Array.from(event.results[i] || []);
        const bestAlternative = alternatives.reduce((best, item) => !best || Number(item.confidence || 0) > Number(best.confidence || 0) ? item : best, null);
        const transcript = bestAlternative ? bestAlternative.transcript : event.results[i][0].transcript;
        window.__maiaLastRecognitionConfidence = bestAlternative && Number(bestAlternative.confidence) > 0 ? Number(bestAlternative.confidence) : null;
        if(window.__maiaSpeaking && findWakeWord(transcript)){
          window.speechSynthesis.cancel();
          window.__maiaSpeaking = false;
          window.__maiaIgnoreVoiceUntil = 0;
          state.commandArmed = true;
          setHud("FALA INTERROMPIDA — PODE FALAR", "listening");
        }
        if(!event.results[i].isFinal){
          setHud("OUVINDO: " + transcript.trim().slice(0, 30).toUpperCase(), "listening");
          continue;
        }
        handleVoice(transcript, "web");
      }
    };

    try{
      recognition.start();
    }catch(err){
      setCore("CLIQUE PARA ATIVAR");
      setHud("PERMISSAO DE MICROFONE", "idle");
    }
  }

  document.addEventListener("click", () => {
    if(recognition && !state.listening){
      try{ recognition.start(); }catch(err){}
    }
    if(window.nucleo && window.nucleo.startMic) window.nucleo.startMic();
  });

  textCommandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = textCommandInput.value.trim();
    if(!command) return;
    textCommandInput.value = "";
    disarmCommand();
    suppressClaps(1500);
    setHud("COMANDO DIGITADO", "speaking");
    processCommand(command);
  });

  async function pollRealTelemetry(){
    try{
      const response = await fetch(BRIDGE_URL + "/telemetry", {cache:"no-store", headers:bridgeHeaders()});
      window.__maiaTelemetry = response.ok ? await response.json() : null;
      evaluateSystemPresence(window.__maiaTelemetry);
    }catch(err){
      window.__maiaTelemetry = null;
    }
  }
  function runWhenVisible20(task){
    return () => {
      if(!document.hidden) task();
    };
  }
  async function startMaia(){
    setupCentral20();
    if(!["normal","economy"].includes(localStorage.getItem("Maia.performanceMode")))localStorage.setItem("Maia.performanceMode","normal");
    applyAutomaticTheme20();
    setInterval(runWhenVisible20(applyAutomaticTheme20), 15 * 60 * 1000);
    if(state.routines.last && brainRoutine) brainRoutine.value = state.routines.last.join("; ");
    pollRealTelemetry();
    setInterval(runWhenVisible20(pollRealTelemetry), 30000);
    checkBridge();
    setInterval(checkBridge, 5000);
    refreshNetworkRadar();
    setInterval(runWhenVisible20(refreshNetworkRadar), 90000);
    setInterval(runWhenVisible20(monitorMusicVisual), 15000);
    refreshNowPlaying20();
    setInterval(runWhenVisible20(refreshNowPlaying20), 5000);
    setVisualMode(state.visualMode);
    MaiaKernel.loadCommandDatabase();
    MaiaKernel.loadSchedules();
    startMicLevelDiagnostic();
    // O Edge fornece o reconhecimento de voz online em segundo plano.
    // A chamada não bloqueia a animação de inicialização do Maia.
    startBrowserSpeechBridge();
    openBrowserSpeechHelper(false, true).catch(() => {
      setTimeout(() => openBrowserSpeechHelper(true, true).catch(() => {}), 8000);
    });
    if(SR) startVoice();
    await Promise.race([runBootIntro(), new Promise((resolve) => setTimeout(resolve, 7000))]);
    state.presenceMonitoring = true;
    syncVoiceMode();
    if(localStorage.getItem("Maia.onboarding.completed") !== "1"){
      setTimeout(openSetupWizard20, 700);
    }
  }

  const maiaInterfaceLayer=document.getElementById("maiaInterfaceLayer");
  const maiaInterfaceFrame=document.getElementById("maiaInterfaceFrame");
  function setMaiaInterface20(value){
    const modern=true;
    localStorage.setItem("Maia.interface","modern");
    if(maiaInterfaceLayer){
      maiaInterfaceLayer.classList.toggle("active",modern);
      maiaInterfaceLayer.setAttribute("aria-hidden",modern?"false":"true");
    }
    if(window.nucleo&&window.nucleo.setPaused)window.nucleo.setPaused(modern);
  }
  function postModern20(message){
    if(maiaInterfaceFrame&&maiaInterfaceFrame.contentWindow)maiaInterfaceFrame.contentWindow.postMessage(message,"*");
  }
  const horizonFieldIds20=new Set(["brainOwnerName","brainCity","brainTreatment","brainSpeechMode","brainPresence","brainVolume","brainWakeWords","brainHaUrl","brainHaToken","brainHaEntity","brainHaAction","brainMobilityCity","brainTrafficOrigin","brainTrafficKey","brainTrafficDestination","brainTheme","brainQuality","brainIntensity","brainAutoTheme","brainRoutineName","brainRoutine","brainRoutineSaved","brainClockType","brainClockWhen","brainClockMessage","brainExtensionSelect","brainExtensionFilter","brainExtensionSearch"]);
  const horizonButtonIds20=new Set(["brainTreatmentApply","brainHaConnect","brainHaRefresh","brainHaStatus","brainHaRun","brainWeatherTest","brainMobilitySave","brainTrafficCheck","brainConnectEnable","brainConnectRefresh","brainConnectCopy","brainConnectForget","brainConnectDisable","brainThemeApply","brainQualityApply","brainIntensityApply","brainAutoThemeApply","brainRoutineSave","brainRoutineRun","brainRoutineDelete","brainClockAdd","brainClockRefresh","brainWindowsClockOpen","brainExtensionCommands","brainExtensionToggle","brainMemoryView","brainHistoryView","brainBackupExport","brainBackupImport","brainPrivacyView","brainDiagnostics","brainUpdateCheck","brainPerformanceMode","brainVisualPreview","brainIntegrationStatus","brainTestAll"]);
  function horizonControlSnapshot20(){
    const fields={};
    horizonFieldIds20.forEach((id)=>{
      const node=document.getElementById(id);
      if(!node)return;
      fields[id]={value:node.value||"",options:node.tagName==="SELECT"?Array.from(node.options).map((option)=>({value:option.value,label:option.textContent||option.value})):[]};
    });
    const extensions=extensionCatalog20.filter((extension)=>extension.functional!==false).map((extension)=>({
      id:extension.id,
      name:extension.name,
      version:extension.version||"1.0.0",
      category:extension.category||"Sistema",
      summary:extension.summary||"",
      badge:extension.badge||"",
      enabled:extensionEnabled20(extension.id),
      commands:Array.isArray(extension.commands)?extension.commands:[],
      permissions:Array.isArray(extension.permissions)?extension.permissions:[]
    }));
    return {fields,extensions,preferences:{silentMode:Boolean(state.preferences.silentMode)},status:{connect:document.getElementById("brainConnectStatus")?.textContent||"",home:document.getElementById("brainHaOutput")?.textContent||"",mobility:document.getElementById("brainMobilityOutput")?.textContent||"",clock:document.getElementById("brainClockList")?.textContent||"",general:brainOutput?.textContent||""}};
  }
  async function handleModernCommand20(message){
    const text=String(message.text||"").trim();
    if(!text)return;
    const conversational=/[?]$|^(?:quem|qual|quais|como|por que|porque|explique|conte|me diga|o que)\b/i.test(text);
    try{
      if(conversational){
        const response=await callBridge("brain.think",{prompt:text});
        const brain=response&&response.result;
        postModern20({type:"maia-interface-result",terminal:Boolean(message.terminal),text:brain&&brain.reply?brain.reply:"Não consegui formar uma resposta válida."});
      }else{
        await processCommand(text);
        postModern20({type:"maia-interface-result",terminal:Boolean(message.terminal),text:"Comando processado pelo núcleo da Maia."});
      }
    }catch(err){
      postModern20({type:"maia-interface-result",terminal:Boolean(message.terminal),text:"Não consegui concluir: "+String(err&&err.message||err||"erro desconhecido")});
    }
  }
  window.addEventListener("message",(event)=>{
    if(!maiaInterfaceFrame||event.source!==maiaInterfaceFrame.contentWindow)return;
    const message=event.data||{};
    if(message.type==="maia-interface-ready"){
      postModern20({type:"maia-interface-telemetry",data:window.__maiaTelemetry||null});
      postModern20({type:"maia-interface-snapshot",data:horizonControlSnapshot20()});
      postModern20({type:"maia-interface-theme",data:horizonThemePayload20(state.preferences.theme||"violet")});
      postModern20({type:"maia-interface-performance",mode:localStorage.getItem("Maia.performanceMode")==="economy"?"economy":"normal"});
    }
    if(message.type==="maia-interface-command")handleModernCommand20(message);
    if(message.type==="maia-extension-toggle"){
      const id=String(message.id||"");
      const extension=extensionCatalog20.find((item)=>item.id===id&&item.functional!==false);
      if(!extension){
        postModern20({type:"maia-interface-control-result",text:"Extensão não encontrada."});
      }else{
        if(extensionEnabled20(id))state.preferences.disabledExtensions.push(id);
        else state.preferences.disabledExtensions=state.preferences.disabledExtensions.filter((item)=>item!==id);
        state.preferences.disabledExtensions=[...new Set(state.preferences.disabledExtensions)];
        saveMemory();
        renderExtensions20(false);
        postModern20({type:"maia-interface-snapshot",data:horizonControlSnapshot20()});
        postModern20({type:"maia-interface-control-result",text:`${extension.name} ${extensionEnabled20(id)?"ativada":"desativada"} com sucesso.`});
      }
    }
    if(message.type==="maia-interface-control"){
      const allowed=new Set(["brainPerformanceMode","brainVisualPreview","brainIntegrationStatus","brainTestAll","brainHaStatus","brainWeatherTest","brainTrafficCheck","brainConnectEnable","brainConnectRefresh","brainConnectCopy","brainConnectDisable","brainWindowsClockOpen","brainMemoryView","brainHistoryView","brainBackupExport","brainPrivacyView","brainDiagnostics","brainUpdateCheck","brainExtensionCommands","brainExtensionToggle","brainSilentToggle"]);
      const id=String(message.id||"");
      const control=allowed.has(id)?document.getElementById(id):null;
      if(control){
        control.click();
        setTimeout(()=>{
          const detail=(brainOutput&&brainOutput.textContent)||(brainExtensionDetails&&brainExtensionDetails.textContent)||"Ação enviada para a Maia.";
          postModern20({type:"maia-interface-control-result",text:detail});
        },500);
      }else postModern20({type:"maia-interface-control-result",text:"Controle indisponível."});
    }
    if(message.type==="maia-interface-form"){
      const values=message.values&&typeof message.values==="object"?message.values:{};
      Object.entries(values).forEach(([id,value])=>{
        if(!horizonFieldIds20.has(id))return;
        const node=document.getElementById(id);
        if(!node)return;
        node.value=String(value??"");
        node.dispatchEvent(new Event("input",{bubbles:true}));
        node.dispatchEvent(new Event("change",{bubbles:true}));
      });
      const clickId=String(message.click||"");
      if(clickId==="horizonProfileApply"){
        document.querySelector('[data-setup="owner"]')?.click();
        document.querySelector('[data-setup="city"]')?.click();
        document.getElementById("brainTreatmentApply")?.click();
        document.querySelector('[data-setup="speech"]')?.click();
        document.querySelector('[data-setup="presence"]')?.click();
        document.querySelector('[data-setup="volume"]')?.click();
        document.querySelector('[data-setup="wake"]')?.click();
      }
      const button=horizonButtonIds20.has(clickId)?document.getElementById(clickId):null;
      if(button)button.click();
      setTimeout(()=>postModern20({type:"maia-interface-snapshot",data:horizonControlSnapshot20()}),650);
    }
    if(message.type==="maia-interface-action"&&message.action==="network.devices"){
      callBridge("network.devices").then((response)=>{
        const result=response&&response.result;
        postModern20({type:"maia-interface-devices",devices:Array.isArray(result)?result:(result&&result.devices)||[]});
      }).catch(()=>postModern20({type:"maia-interface-devices",devices:[]}));
    }
    if(message.type==="maia-interface-action"&&["downloads.list","file.search","file.open","file.openFolder","system.refresh"].includes(message.action)){
      (async()=>{
        try{
          if(message.action==="system.refresh"){
            await pollRealTelemetry();
            postModern20({type:"maia-interface-telemetry",data:window.__maiaTelemetry||null});
            const response=await callBridge("system.processes");
            postModern20({type:"maia-interface-processes",items:response?.result?.items||[]});
            return;
          }
          const response=await callBridge(message.action,{query:String(message.query||"").slice(0,100),path:String(message.path||"")});
          const result=response&&response.result||{};
          if(message.action==="downloads.list")postModern20({type:"maia-interface-files",items:result.items||[],message:"Downloads recentes."});
          else if(message.action==="file.search")postModern20({type:"maia-interface-files",items:result.items||[],message:`${(result.items||[]).length} resultado(s) encontrado(s).`});
          else postModern20({type:"maia-interface-control-result",text:"Arquivo aberto com segurança."});
        }catch(err){
          postModern20({type:"maia-interface-control-result",text:"Não consegui concluir: "+String(err?.message||err)});
        }
      })();
    }
  });
  setInterval(()=>{
    if(maiaInterfaceLayer&&maiaInterfaceLayer.classList.contains("active"))postModern20({type:"maia-interface-telemetry",data:window.__maiaTelemetry||null});
  },3000);
  setMaiaInterface20("modern");

  startMaia().catch((err) => {
    console.error(err);
    startBrowserSpeechBridge();
    if(SR) startVoice();
    syncVoiceMode();
  });
})();
