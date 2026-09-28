const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloader', {
  chooseLocation: (suggestedName) => ipcRenderer.invoke('download:choose-location', suggestedName),
  start: (payload) => ipcRenderer.invoke('download:start', payload),
  pause: (id) => ipcRenderer.invoke('download:pause', id),
  resume: (id) => ipcRenderer.invoke('download:resume', id),
  cancel: (id) => ipcRenderer.invoke('download:cancel', id),
  onUpdate: (callback) => ipcRenderer.on('download:update', (_event, payload) => callback(payload)),
});
