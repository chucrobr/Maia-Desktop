const path = require("path");
const fs = require("fs");
const {app, BrowserWindow, desktopCapturer, ipcMain, Menu, Notification, screen, session, shell, Tray, webContents} = require("electron");
const bridge = require("../bridge/server.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.resolve(__dirname, "..");
const APP_ICON = path.join(ROOT_DIR, "assets", "maia-icon.png");

let mainWindow = null;
let floatingWindow = null;
let tray = null;
let isRestoringMain = false;
let currentVisualMode = "default";
let currentTheme = "classic";
let themeInitialized = false;
let windowStateCache = null;
let windowStateTimer = null;
let clockItems = [];
let clockTimer = null;
const activeClockNotifications = new Set();

function clockDataPath(){
  return path.join(app.getPath("userData"), "clock-items.json");
}

function saveClockItems(){
  try{ fs.writeFileSync(clockDataPath(), JSON.stringify(clockItems.slice(0, 200), null, 2), "utf8"); }catch(err){}
}

function loadClockItems(){
  try{
    const parsed = JSON.parse(fs.readFileSync(clockDataPath(), "utf8"));
    clockItems = Array.isArray(parsed) ? parsed.filter(item => item && item.id) : [];
  }catch(err){ clockItems = []; }
}

function publicClockItems(){
  return clockItems.slice().sort((a, b) => Number(a.dueAt) - Number(b.dueAt));
}

function nextRecurringClockTime(item, from = Date.now()){
  const recurrence = item && item.recurrence;
  if(!recurrence) return null;
  const original = new Date(Number(item.dueAt));
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setHours(original.getHours(), original.getMinutes(), 0, 0);
  const allowedDays = recurrence === "weekdays" ? [1,2,3,4,5] :
    recurrence === "daily" ? [0,1,2,3,4,5,6] :
    Array.isArray(recurrence.days) ? recurrence.days.map(Number).filter(day => day >= 0 && day <= 6) : [];
  for(let offset = 0; offset <= 8; offset++){
    const attempt = new Date(candidate);
    attempt.setDate(candidate.getDate() + offset);
    if(attempt.getTime() > from && allowedDays.includes(attempt.getDay())) return attempt.getTime();
  }
  return null;
}

function fireClockItem(item){
  const firedItem = {...item};
  const nextDueAt = nextRecurringClockTime(item);
  if(nextDueAt){
    item.dueAt = nextDueAt;
    item.lastFiredAt = new Date().toISOString();
    item.done = false;
  }else{
    item.done = true;
    item.doneAt = new Date().toISOString();
  }
  saveClockItems();
  const isAlarm = item.type === "alarm" || item.type === "timer";
  const title = isAlarm ? "Alarme da Maia" : "Lembrete da Maia";
  const body = String(item.message || item.label || (isAlarm ? "Horário programado." : "Você tem um lembrete."));
  if(Notification.isSupported()){
    const notice = new Notification({title, body, icon:APP_ICON, urgency:isAlarm ? "critical" : "normal", timeoutType:"never"});
    notice.on("click", restoreMainWindow);
    notice.on("close", () => activeClockNotifications.delete(notice));
    activeClockNotifications.add(notice);
    notice.show();
  }
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clock:fired", {...firedItem, nextDueAt});
}

function checkClockItems(){
  const now = Date.now();
  for(const item of clockItems){
    if(!item.done && Number(item.dueAt) <= now) fireClockItem(item);
  }
  scheduleClockCheck();
}

function scheduleClockCheck(){
  clearTimeout(clockTimer);
  const now = Date.now();
  const nextDueAt = clockItems
    .filter(item => !item.done && Number.isFinite(Number(item.dueAt)))
    .reduce((next, item) => Math.min(next, Number(item.dueAt)), Infinity);
  // Acorda no evento mais próximo. O teto de um minuto também cobre alterações
  // de relógio/fuso do Windows sem manter um polling por segundo.
  const delay = Number.isFinite(nextDueAt)
    ? Math.max(250, Math.min(60000, nextDueAt - now))
    : 60000;
  clockTimer = setTimeout(checkClockItems, delay);
}

function startClockService(){
  loadClockItems();
  checkClockItems();
}

function windowStatePath(){
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState(){
  if(windowStateCache) return windowStateCache;
  try{ windowStateCache = JSON.parse(fs.readFileSync(windowStatePath(), "utf8")); }catch(err){ windowStateCache = {}; }
  return windowStateCache;
}

function saveWindowStateSoon(){
  clearTimeout(windowStateTimer);
  windowStateTimer = setTimeout(() => {
    try{
      const state = readWindowState();
      if(mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()){
        state.main = mainWindow.getNormalBounds();
        state.maximized = mainWindow.isMaximized();
      }
      if(floatingWindow && !floatingWindow.isDestroyed()) state.floating = floatingWindow.getBounds();
      fs.writeFileSync(windowStatePath(), JSON.stringify(state, null, 2), "utf8");
    }catch(err){}
  }, 350);
}

function usableBounds(saved, fallback){
  if(!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return fallback;
  const display = screen.getDisplayMatching(saved);
  const area = display.workArea;
  const width = Math.max(fallback.minWidth || 1, Math.min(saved.width || fallback.width, area.width));
  const height = Math.max(fallback.minHeight || 1, Math.min(saved.height || fallback.height, area.height));
  return {
    x:Math.max(area.x, Math.min(saved.x, area.x + area.width - width)),
    y:Math.max(area.y, Math.min(saved.y, area.y + area.height - height)),
    width,height
  };
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if(!hasSingleInstanceLock){
  app.quit();
}

app.on("second-instance", () => {
  restoreMainWindow();
});
function animateWindowOpacity(win, from, to, durationMs){
  if(!win || win.isDestroyed()) return;
  const startedAt = Date.now();
  win.setOpacity(from);
  const timer = setInterval(() => {
    if(!win || win.isDestroyed()){
      clearInterval(timer);
      return;
    }
    const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    win.setOpacity(from + (to - from) * eased);
    if(progress >= 1) clearInterval(timer);
  }, 16);
}

function positionFloatingWindow(){
  if(!floatingWindow || floatingWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const bounds = floatingWindow.getBounds();
  const width = bounds.width || 150;
  const height = bounds.height || 150;
  const saved = readWindowState().floating;
  floatingWindow.setBounds(saved ? usableBounds(saved, {width,height,minWidth:150,minHeight:150}) : {
    x: area.x + area.width - width - 26,
    y: area.y + area.height - height - 26,
    width,
    height
  });
}

function createFloatingWindow(){
  floatingWindow = new BrowserWindow({
    width: 150,
    height: 150,
    minWidth: 150,
    minHeight: 150,
    maxWidth: 150,
    maxHeight: 150,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(SRC_DIR, "preload", "floating-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false
    }
  });

  floatingWindow.loadFile(path.join(SRC_DIR, "ui", "maia-floating-button.html"));
  protectWindowNavigation(floatingWindow);
  floatingWindow.setAlwaysOnTop(true, "floating");
  floatingWindow.on("closed", () => {
    floatingWindow = null;
  });
  positionFloatingWindow();
}

function createTray(){
  if(tray) return;
  tray = new Tray(APP_ICON);
  tray.setToolTip("Maia — assistente e relógio");
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:"Abrir Maia", click:restoreMainWindow},
    {label:"Abrir Relógio do Windows", click:() => shell.openExternal("ms-clock:")},
    {type:"separator"},
    {label:"Sair", click:() => { app.isQuitting = true; app.quit(); }}
  ]));
  tray.on("double-click", restoreMainWindow);
}

function showFloatingButton(){
  if(!floatingWindow || floatingWindow.isDestroyed()) createFloatingWindow();
  positionFloatingWindow();
  floatingWindow.setOpacity(0);
  floatingWindow.showInactive();
  animateWindowOpacity(floatingWindow, 0, 1, 180);
}

function hideFloatingButton(){
  if(!floatingWindow || floatingWindow.isDestroyed()) return;
  floatingWindow.hide();
}

function restoreMainWindow(){
  if(!mainWindow || mainWindow.isDestroyed()) createWindow();
  if(!mainWindow) return;
  isRestoringMain = true;
  hideFloatingButton();
  mainWindow.setOpacity(0);
  if(mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  animateWindowOpacity(mainWindow, 0, 1, 260);
  setTimeout(() => {
    isRestoringMain = false;
  }, 320);
}

function createWindow(){
  const savedState = readWindowState();
  const initialBounds = usableBounds(savedState.main, {width:1280,height:760,minWidth:980,minHeight:620});
  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#050101",
    title: "MAIA Horizon",
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(SRC_DIR, "preload", "main-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false
    }
  });
  if(savedState.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(SRC_DIR, "ui", "maia.html"), {
    query: {bridgeToken: bridge.getAuthToken()}
  });
  protectWindowNavigation(mainWindow);
  mainWindow.on("page-title-updated", (event, title) => {
    const message = String(title || "");
    const modeMatch = message.match(/^MAIA::MODE::([a-z]+)$/);
    const themeMatch = message.match(/^MAIA::THEME::([a-z]+)$/);
    if(!modeMatch && !themeMatch) return;
    event.preventDefault();
    if(modeMatch) currentVisualMode = modeMatch[1] || "default";
    if(themeMatch){
      currentTheme = themeMatch[1] || "classic";
      themeInitialized = true;
    }
    if(floatingWindow && !floatingWindow.isDestroyed()){
      if(modeMatch) floatingWindow.webContents.send("floating:set-mode", currentVisualMode);
      if(themeMatch) floatingWindow.webContents.send("floating:set-theme", currentTheme);
    }
  });

  mainWindow.on("minimize", () => {
    if(!isRestoringMain) showFloatingButton();
  });
  mainWindow.on("restore", hideFloatingButton);
  mainWindow.on("show", hideFloatingButton);
  mainWindow.on("resize", saveWindowStateSoon);
  mainWindow.on("move", saveWindowStateSoon);
  mainWindow.on("close", (event) => {
    if(app.isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    showFloatingButton();
    if(Notification.isSupported() && !app.__maiaBackgroundNoticeShown){
      app.__maiaBackgroundNoticeShown = true;
      new Notification({
        title:"Maia continua ativa",
        body:"Alarmes e lembretes continuarão funcionando na bandeja do Windows.",
        icon:APP_ICON
      }).show();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function protectWindowNavigation(win){
  win.webContents.setWindowOpenHandler(() => ({action: "deny"}));
  win.webContents.on("will-navigate", (event, url) => {
    if(!String(url).startsWith("file://")) event.preventDefault();
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[maia:window] Renderizador reiniciado:", details && details.reason);
    const now = Date.now();
    win.__maiaRenderFailures = (win.__maiaRenderFailures || []).filter(time => now - time < 60000);
    win.__maiaRenderFailures.push(now);
    if(win.__maiaRenderFailures.length > 3){
      console.error("[maia:window] Recuperação automática interrompida após falhas repetidas.");
      if(Notification.isSupported()){
        new Notification({
          title:"Maia iniciou em modo de proteção",
          body:"A interface falhou repetidamente. Reinicie a Maia para tentar novamente.",
          icon:APP_ICON
        }).show();
      }
      return;
    }
    const delay = Math.min(8000, 1000 * Math.pow(2, win.__maiaRenderFailures.length - 1));
    if(!win.isDestroyed()) setTimeout(() => { if(!win.isDestroyed()) win.reload(); }, delay);
  });
  win.on("unresponsive", () => {
    if(win.__maiaRecoveryTimer) return;
    console.warn("[maia:window] Janela sem resposta; iniciando recuperação.");
    win.__maiaRecoveryTimer = setTimeout(() => {
      win.__maiaRecoveryTimer = null;
      if(!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.reloadIgnoringCache();
    }, 8000);
  });
  win.on("responsive", () => {
    if(win.__maiaRecoveryTimer){
      clearTimeout(win.__maiaRecoveryTimer);
      win.__maiaRecoveryTimer = null;
    }
  });
}

function isTrustedRenderer(webContents){
  return Boolean(webContents) && (
    webContents === (mainWindow && mainWindow.webContents) ||
    webContents === (floatingWindow && floatingWindow.webContents)
  );
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(() => {
  // Entrega o Ã¡udio que estÃ¡ tocando no Windows aos visualizadores 3D.
  // O vÃ­deo Ã© exigido pela API de captura, mas Ã© descartado imediatamente
  // pelos renderers; somente a faixa de Ã¡udio permanece ativa.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const requestingWebContents = request.frame ? webContents.fromFrame(request.frame) : null;
    if(!isTrustedRenderer(requestingWebContents)){
      callback({});
      return;
    }
    desktopCapturer.getSources({types: ["screen"]})
      .then((sources) => callback(sources.length ? {video: sources[0], audio: "loopback"} : {}))
      .catch(() => callback({}));
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isTrustedRenderer(webContents) && ["media", "microphone", "geolocation"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return isTrustedRenderer(webContents) && ["media", "microphone", "geolocation"].includes(permission);
  });

  bridge.startBridge();
  startClockService();
  bridge.setConnectDesktopHandlers({
    setTheme(theme){
      const selected = String(theme || "").replace(/[^a-z]/g, "").slice(0, 32);
      if(!selected) throw new Error("tema inválido");
      if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("connect:set-theme", selected);
      return {ok:true,theme:selected};
    },
    listClock(){ return publicClockItems(); },
    addClock(value){
      const dueAt=Number(value && value.dueAt);
      if(!Number.isFinite(dueAt) || dueAt <= Date.now()) throw new Error("horário inválido");
      const item={id:"connect-"+Date.now()+"-"+Math.random().toString(16).slice(2),type:["alarm","timer","reminder"].includes(value.type)?value.type:"reminder",message:String(value.message||"Lembrete do Maia Connect").slice(0,240),label:String(value.message||"Lembrete").slice(0,120),dueAt,recurrence:null,createdAt:new Date().toISOString(),done:false};
      clockItems.unshift(item);saveClockItems();scheduleClockCheck();return {ok:true,item};
    },
    removeClock(id){
      const before=clockItems.length;clockItems=clockItems.filter(item=>item.id!==String(id));saveClockItems();scheduleClockCheck();return {ok:clockItems.length!==before};
    },
    runRoutine(name){
      if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("connect:run-routine", String(name||"").slice(0,80));
      return {ok:true,name};
    }
  });
  createWindow();
  createFloatingWindow();
  createTray();

  app.on("activate", () => {
    restoreMainWindow();
  });
});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  clearTimeout(clockTimer);
  if(tray){ tray.destroy(); tray = null; }
  bridge.stopBridge();
});

ipcMain.on("floating:open-main", (event) => {
  if(event.sender === (floatingWindow && floatingWindow.webContents)) restoreMainWindow();
});
ipcMain.on("floating:hide", (event) => {
  if(event.sender === (floatingWindow && floatingWindow.webContents)) hideFloatingButton();
});

ipcMain.on("floating:ready", (event) => {
  if(event.sender !== (floatingWindow && floatingWindow.webContents)) return;
  if(floatingWindow && !floatingWindow.isDestroyed()){
    floatingWindow.webContents.send("floating:set-mode", currentVisualMode);
    if(themeInitialized) floatingWindow.webContents.send("floating:set-theme", currentTheme);
  }
  if(mainWindow && mainWindow.isMinimized()) showFloatingButton();
});
ipcMain.on("floating:move-by", (event, delta) => {
  if(event.sender !== (floatingWindow && floatingWindow.webContents)) return;
  if(!floatingWindow || floatingWindow.isDestroyed()) return;
  const dx = Number(delta && delta.dx) || 0;
  const dy = Number(delta && delta.dy) || 0;
  const bounds = floatingWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const nextX = Math.max(area.x, Math.min(area.x + area.width - bounds.width, bounds.x + dx));
  const nextY = Math.max(area.y, Math.min(area.y + area.height - bounds.height, bounds.y + dy));
  floatingWindow.setBounds({...bounds, x: nextX, y: nextY});
  saveWindowStateSoon();
});

ipcMain.handle("main:get-displays", (event) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return [];
  return screen.getAllDisplays().map((display, index) => ({
    id:String(display.id),
    label:"Monitor " + (index + 1) + (display.id === screen.getPrimaryDisplay().id ? " (principal)" : ""),
    width:display.workArea.width,
    height:display.workArea.height
  }));
});

ipcMain.handle("main:move-to-display", (event, id) => {
  if(event.sender !== (mainWindow && mainWindow.webContents) || !mainWindow) return {ok:false};
  const display = screen.getAllDisplays().find(item => String(item.id) === String(id)) || screen.getPrimaryDisplay();
  const bounds = mainWindow.getBounds();
  const area = display.workArea;
  mainWindow.setBounds({
    x:area.x + Math.max(0, Math.round((area.width - Math.min(bounds.width, area.width)) / 2)),
    y:area.y + Math.max(0, Math.round((area.height - Math.min(bounds.height, area.height)) / 2)),
    width:Math.min(bounds.width, area.width),
    height:Math.min(bounds.height, area.height)
  });
  saveWindowStateSoon();
  return {ok:true, id:String(display.id)};
});

ipcMain.handle("clock:list", (event) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return [];
  return publicClockItems();
});

ipcMain.handle("clock:add", (event, value) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return {ok:false};
  const dueAt = Number(value && value.dueAt);
  if(!Number.isFinite(dueAt) || dueAt <= Date.now()) return {ok:false, error:"Horário inválido"};
  const item = {
    id:String(value.id || ("clock-" + Date.now() + "-" + Math.random().toString(16).slice(2))),
    type:["alarm", "timer", "reminder"].includes(value.type) ? value.type : "alarm",
    message:String(value.message || value.label || "Horário programado.").slice(0, 240),
    label:String(value.label || value.message || "Alarme").slice(0, 120),
    dueAt,
    recurrence:value.recurrence === "daily" || value.recurrence === "weekdays"
      ? value.recurrence
      : value.recurrence && Array.isArray(value.recurrence.days) ? {days:value.recurrence.days.slice(0, 7)} : null,
    createdAt:String(value.createdAt || new Date().toISOString()),
    done:false
  };
  clockItems = clockItems.filter(existing => existing.id !== item.id);
  clockItems.unshift(item);
  saveClockItems();
  scheduleClockCheck();
  return {ok:true, item};
});

ipcMain.handle("clock:remove", (event, id) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return {ok:false};
  const before = clockItems.length;
  clockItems = clockItems.filter(item => item.id !== String(id));
  saveClockItems();
  scheduleClockCheck();
  return {ok:clockItems.length !== before};
});

ipcMain.handle("clock:open-windows", async (event) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return {ok:false};
  try{
    await shell.openExternal("ms-clock:");
    return {ok:true};
  }catch(err){
    return {ok:false, error:err.message};
  }
});

ipcMain.handle("clock:stop-alerts", (event) => {
  if(event.sender !== (mainWindow && mainWindow.webContents)) return {ok:false};
  for(const notice of activeClockNotifications){
    try{ notice.close(); }catch(err){}
  }
  activeClockNotifications.clear();
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clock:stopped");
  return {ok:true};
});


