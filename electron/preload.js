
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
  },
  factoryReset: () => ipcRenderer.send('factory-reset'),
  platform: process.platform,
  updateTitleBarOverlay: (options) => ipcRenderer.send('update-title-bar-overlay', options),
  preventAppSuspension: (enable) => ipcRenderer.send('prevent-app-suspension', enable),
  setOpenAtLogin: (open) => ipcRenderer.send('set-open-at-login', open),
  getOpenAtLogin: () => ipcRenderer.invoke('get-open-at-login'),
  selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
  saveBackupFile: (folderPath, data) => ipcRenderer.invoke('save-backup-file', folderPath, data),
  saveFileToFolder: (folderPath, filename, data) => ipcRenderer.invoke('save-file-to-folder', folderPath, filename, data),
  appendFileToFolder: (folderPath, filename, data) => ipcRenderer.invoke('append-file-to-folder', folderPath, filename, data),
  updateDailyNote: (folderPath, filename, content, header, position) => ipcRenderer.invoke('update-daily-note', folderPath, filename, content, header, position),
});