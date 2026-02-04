
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  updateTrayTitle: (title) => ipcRenderer.send('update-tray-title', title),
  startQuickTimer: (minutes) => ipcRenderer.send('quick-timer-set', minutes),
  cancelQuickTimer: () => ipcRenderer.send('quick-timer-cancel'),
  onQuickTimerTriggered: (callback) => {
    ipcRenderer.on('start-timer-from-quick', (event, minutes) => callback(minutes));
  }
});