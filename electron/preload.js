// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 1. Timer State Syncing
    onSyncTimerState: (callback) => ipcRenderer.on('sync-timer-state', (_event, value) => callback(value)),
    requestTimerState: () => ipcRenderer.send('request-timer-state'),

    // 2. Window Controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    closeMiniCapture: () => ipcRenderer.send('close-mini-capture'),
    resizeMiniCapture: (height) => ipcRenderer.send('resize-mini-capture', { height }),
    
    // 3. Ghost Mode Specifics
    send: (channel, data) => {
        // Allowlist channels for security
        const validChannels = ['timer-action', 'ghost-mode-disable', 'ghost-mode-enable'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});