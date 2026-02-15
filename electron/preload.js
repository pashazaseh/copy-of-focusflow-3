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

    onQuickStart: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('quick-start', subscription);
        return () => ipcRenderer.removeListener('quick-start', subscription);
    },

    // 2. Window Controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),

    // Settings
    updateDockVisibility: (visible) => ipcRenderer.send('update-dock-visibility', visible),
    setMinimizeToTray: (value) => ipcRenderer.send('set-minimize-to-tray', value),
    setShowInDock: (visible) => ipcRenderer.send('update-dock-visibility', visible), // Alias for compatibility
    
    // Quick Timer
    startQuickTimer: (minutes) => ipcRenderer.send('quick-timer-set', minutes),
    cancelQuickTimer: () => ipcRenderer.send('quick-timer-cancel'),
    
    // 3. Ghost Mode Specifics
    send: (channel, data) => {
        // Allowlist channels for security
        const validChannels = ['timer-action', 'ghost-mode-disable', 'ghost-mode-enable', 'quick-timer-set', 'quick-timer-cancel'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});