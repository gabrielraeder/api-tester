const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  executeRequest: (request) => ipcRenderer.invoke('http:execute', request),
  platform: process.platform,
})
