const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("maiaFloating", {
  openMain: () => ipcRenderer.send("floating:open-main"),
  moveBy: (dx, dy) => ipcRenderer.send("floating:move-by", {dx, dy}),
  hide: () => ipcRenderer.send("floating:hide"),
  ready: () => ipcRenderer.send("floating:ready"),
  onMode: (callback) => ipcRenderer.on("floating:set-mode", (event, mode) => callback(mode)),
  onTheme: (callback) => ipcRenderer.on("floating:set-theme", (event, theme) => callback(theme))
});
