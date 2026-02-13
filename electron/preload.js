// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 1. Timer State Syncing
    onSyncTimerState: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('sync-timer-state', subscription);
        return () => ipcRenderer.removeListener('sync-timer-state', subscription);
    },
    requestTimerState: () => ipcRenderer.send('request-timer-state'),
    updateTrayTitle: (title) => ipcRenderer.send('update-tray-title', title),

    // 2. Window Controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // 3. Ghost Mode Specifics
    send: (channel, data) => {
        // Allowlist channels for security
        const validChannels = ['timer-action', 'ghost-mode-disable', 'ghost-mode-enable'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});