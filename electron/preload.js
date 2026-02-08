
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  updateTrayTitle: (title) => ipcRenderer.send('update-tray-title', title),
  startQuickTimer: (minutes) => ipcRenderer.send('quick-timer-set', minutes),
  cancelQuickTimer: () => ipcRenderer.send('quick-timer-cancel'),
  onQuickTimerTriggered: (callback) => {
    const handler = (event, minutes) => callback(minutes);
    ipcRenderer.on('start-timer-from-quick', handler);
    return () => ipcRenderer.removeListener('start-timer-from-quick', handler);
  },
  onOAuthCode: (callback) => {
    const handler = (event, code) => callback(code);
    ipcRenderer.on('oauth-code', handler);
    return () => ipcRenderer.removeListener('oauth-code', handler);
  },
  factoryReset: () => ipcRenderer.send('factory-reset'),
  platform: process.platform,
  updateTitleBarOverlay: (options) => ipcRenderer.send('update-title-bar-overlay', options),
  preventAppSuspension: (enable) => ipcRenderer.send('prevent-app-suspension', enable),
  setOpenAtLogin: (open) => ipcRenderer.send('set-open-at-login', open),
  getOpenAtLogin: () => ipcRenderer.invoke('get-open-at-login'),
  selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  createNewFile: () => ipcRenderer.invoke('create-new-file'),
  saveBackupFile: (folderPath, data) => ipcRenderer.invoke('save-backup-file', folderPath, data),
  saveFileToFolder: (folderPath, filename, data) => ipcRenderer.invoke('save-file-to-folder', folderPath, filename, data),
  saveBinaryFile: (folderPath, filename, data) => ipcRenderer.invoke('save-binary-file', folderPath, filename, data),
  appendFileToFolder: (folderPath, filename, data) => ipcRenderer.invoke('append-file-to-folder', folderPath, filename, data),
  updateDailyNote: (folderPath, filename, content, header, position) => ipcRenderer.invoke('update-daily-note', folderPath, filename, content, header, position),
  getFileHeaders: (folderPath, filename) => ipcRenderer.invoke('get-file-headers', folderPath, filename),
  updateGlobalShortcut: (shortcut) => ipcRenderer.invoke('update-global-shortcut', shortcut),
  openQuickCapture: () => ipcRenderer.send('open-quick-capture'),
  watchPath: (path) => ipcRenderer.send('watch-path', path),
  unwatchPath: () => ipcRenderer.send('unwatch-path'),
  onFileChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.removeListener('file-changed', handler);
  },
  setDoNotDisturb: (enable) => ipcRenderer.invoke('set-do-not-disturb', enable),
  toggleGhostMode: (state) => ipcRenderer.send('toggle-ghost-mode', state),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  onSyncTimerState: (callback) => {
    const handler = (event, state) => callback(state);
    ipcRenderer.on('sync-timer-state', handler);
    return () => ipcRenderer.removeListener('sync-timer-state', handler);
  },
  getTimerState: () => ipcRenderer.send('get-timer-state'),
  playSoundEffect: () => ipcRenderer.send('play-sound-effect'),
});