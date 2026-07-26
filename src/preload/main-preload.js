const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("maiaDesktop", {
  getDisplays: () => ipcRenderer.invoke("main:get-displays"),
  moveToDisplay: (id) => ipcRenderer.invoke("main:move-to-display", id),
  listClockItems: () => ipcRenderer.invoke("clock:list"),
  addClockItem: (item) => ipcRenderer.invoke("clock:add", item),
  removeClockItem: (id) => ipcRenderer.invoke("clock:remove", id),
  stopClockAlerts: () => ipcRenderer.invoke("clock:stop-alerts"),
  openWindowsClock: () => ipcRenderer.invoke("clock:open-windows"),
  onConnectTheme: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on("connect:set-theme", listener);
    return () => ipcRenderer.removeListener("connect:set-theme", listener);
  },
  onConnectRoutine: (callback) => {
    const listener = (_event, name) => callback(name);
    ipcRenderer.on("connect:run-routine", listener);
    return () => ipcRenderer.removeListener("connect:run-routine", listener);
  },
  onClockFired: (callback) => {
    const listener = (_event, item) => callback(item);
    ipcRenderer.on("clock:fired", listener);
    return () => ipcRenderer.removeListener("clock:fired", listener);
  },
  onClockStopped: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("clock:stopped", listener);
    return () => ipcRenderer.removeListener("clock:stopped", listener);
  }
});
