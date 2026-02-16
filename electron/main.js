const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerSaveBlocker, dialog, globalShortcut, shell, TouchBar } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setDoNotDisturb } = require('./dnd');

let currentGlobalShortcut = 'CommandOrControl+Shift+C';
let lastTrayTitle = '';
let tray = null;
let win = null;
let miniCaptureWin = null;
let ghostWin = null;
let trayWindow = null;
let powerSaveBlockerId = null;
let fileWatcher = null;
let showInDock = true;
let minimizeToTray = false;
let isQuitting = false;
let defaultIcon = null;
let transparentIcon = null;
let ghostState = null;

let tbLabel = null;
let tbPlayPauseButton = null;
let tbSkipButton = null;

let trackingInterval = null;
let ghostSnapCorner = 'top-right';
const activeModeListeners = new WeakMap();

function startActiveWindowTracking() {
  if (trackingInterval) clearInterval(trackingInterval);
  
  trackingInterval = setInterval(() => {
    if (!ghostWin || ghostWin.isDestroyed()) {
      stopActiveWindowTracking();
      return;
    }

    if (process.platform === 'darwin') {
      const script = `
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set frontAppName to name of frontApp
            if frontAppName is "FocusFlow" or frontAppName is "Electron" then return "self"
            tell process frontAppName
                try
                    set {x, y} to position of window 1
                    set {w, h} to size of window 1
                    return x & "," & y & "," & w & "," & h
                on error
                    return "error"
                end try
            end tell
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error || !stdout) return;
        const result = stdout.trim();
        if (result === 'self' || result === 'error') return;
        
        const parts = result.split(',').map(Number);
        if (parts.length === 4 && !parts.some(isNaN)) {
            const [ax, ay, aw, ah] = parts;
            const ghostBounds = ghostWin.getBounds();
            const padding = 20;
            
            let targetX, targetY;

            switch (ghostSnapCorner) {
                case 'top-left':
                    targetX = ax + padding;
                    targetY = ay + padding;
                    break;
                case 'bottom-left':
                    targetX = ax + padding;
                    targetY = ay + ah - ghostBounds.height - padding;
                    break;
                case 'bottom-right':
                    targetX = ax + aw - ghostBounds.width - padding;
                    targetY = ay + ah - ghostBounds.height - padding;
                    break;
                case 'top-right':
                default:
                    targetX = ax + aw - ghostBounds.width - padding;
                    targetY = ay + padding;
                    break;
            }
            
            const [cx, cy] = ghostWin.getPosition();
            if (Math.abs(cx - targetX) > 10 || Math.abs(cy - targetY) > 10) {
                ghostWin.setPosition(targetX, targetY, true);
            }
        }
      });
    }
  }, 1500);
}

function stopActiveWindowTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

const configFile = 'settings.json';

function getConfigFile() {
  console.log('User data path:', app.getPath('userData'));
  return path.join(app.getPath('userData'), configFile);
}

function loadSettings() {
  try {
    const p = getConfigFile();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) { console.error('Error loading settings:', e); }
  return {};
}

function saveSetting(key, value) {
  try {
    const settings = loadSettings();
    settings[key] = value;
    fs.writeFileSync(getConfigFile(), JSON.stringify(settings, null, 2));
  } catch (e) { console.error('Error saving settings:', e); }
}

// Ensure notifications work on Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.yourname.focusflow');
}

// Helper to create a simple icon since we might not have assets
function createTrayIcon() {
  // Customize your tray icon here
  const useTemplateImage = true; // Set to false to use the custom color below
  const iconColor = { r: 0, g: 0, b: 0 }; // RGB Color (if useTemplateImage is false)

  const createIconBuffer = (size, scale) => {
    const effectiveSize = size * scale;
    const buffer = Buffer.alloc(effectiveSize * effectiveSize * 4);
    const center = effectiveSize / 2;
    const outerRadius = effectiveSize * 0.4;
    const innerRadius = effectiveSize * 0.3;
    const dotRadius = effectiveSize * 0.15;
    
    for (let y = 0; y < effectiveSize; y++) {
      for (let x = 0; x < effectiveSize; x++) {
        const idx = (y * effectiveSize + x) * 4;
        const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
        
        let alpha = 0;
        const edge = 1.0 * scale;

        if (dist >= innerRadius - edge && dist <= outerRadius + edge) {
           if (dist < innerRadius) alpha = (dist - (innerRadius - edge)) / edge;
           else if (dist > outerRadius) alpha = 1 - (dist - outerRadius) / edge;
           else alpha = 1;
        } else if (dist <= dotRadius + edge) {
           if (dist > dotRadius) alpha = 1 - (dist - dotRadius) / edge;
           else alpha = 1;
        }

        alpha = Math.max(0, Math.min(1, alpha)) * 255;

        if (alpha > 0) {
          buffer[idx] = iconColor.r; buffer[idx + 1] = iconColor.g; buffer[idx + 2] = iconColor.b; buffer[idx + 3] = Math.floor(alpha);
        } else {
          buffer[idx + 3] = 0;
        }
      }
    }
    return buffer;
  };

  const size = 22;
  const img = nativeImage.createEmpty();
  img.addRepresentation({ scaleFactor: 1, width: size, height: size, buffer: createIconBuffer(size, 1) });
  img.addRepresentation({ scaleFactor: 2, width: size, height: size, buffer: createIconBuffer(size, 2) });
  img.setTemplateImage(useTemplateImage);
  return img;
}

function createAppIcon() {
  const size = 128; // Reduced size for faster startup generation
  const buffer = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const outerRadius = size * 0.45;
  const innerRadius = size * 0.35;
  const dotRadius = size * 0.15;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
      
      let alpha = 0;
      const edge = 2.0;

      if (dist >= innerRadius - edge && dist <= outerRadius + edge) {
         if (dist < innerRadius) alpha = (dist - (innerRadius - edge)) / edge;
         else if (dist > outerRadius) alpha = 1 - (dist - outerRadius) / edge;
         else alpha = 1;
      } else if (dist <= dotRadius + edge) {
         if (dist > dotRadius) alpha = 1 - (dist - dotRadius) / edge;
         else alpha = 1;
      }

      alpha = Math.max(0, Math.min(1, alpha)) * 255;
      if (alpha > 0) {
        buffer[idx] = 59; buffer[idx + 1] = 130; buffer[idx + 2] = 246; buffer[idx + 3] = Math.floor(alpha);
      } else {
        buffer[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function setupContextMenu(window) {
  window.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable && !params.selectionText) return;

    const template = [];

    if (params.selectionText) {
      const trimmedText = params.selectionText.trim();
      const searchText = trimmedText.length > 20 ? trimmedText.substring(0, 20) + '...' : trimmedText;
      template.push({
        label: `Search Google for "${searchText}"`, 
        click: () => {
          shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`);
        }
      });
      template.push({ type: 'separator' });
    }

    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      params.dictionarySuggestions.forEach(suggestion => {
        template.push({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion)
        });
      });
      template.push({ type: 'separator' });
    }

    template.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' }
    );

    if (process.platform === 'darwin') {
      template.push({
        label: 'Substitutions',
        submenu: [
          { role: 'showSubstitutions', label: 'Show Substitutions' },
          { type: 'separator' },
          { role: 'toggleSmartQuotes', label: 'Smart Quotes' },
          { role: 'toggleSmartDashes', label: 'Smart Dashes' },
          { role: 'toggleTextReplacement', label: 'Text Replacement' }
        ]
      });
      template.push({ type: 'separator' });
    }

    template.push({
      label: 'Speech',
      submenu: [
        { role: 'startSpeaking' },
        { role: 'stopSpeaking' }
      ]
    });

    if (process.platform === 'darwin') {
      template.push({ type: 'separator' });
      
      template.push({
        label: 'Start Dictation...', 
        click: () => Menu.sendActionToFirstResponder('startDictation:')
      });
      
      template.push({
        label: 'Emoji & Symbols',
        click: () => app.showEmojiPanel()
      });

      template.push({ type: 'separator' });

      if (params.selectionText) {
        template.push({ label: 'Look Up', click: () => window.webContents.showDefinitionForSelection() });
        template.push({ type: 'separator' });
      }
      template.push({ role: 'services' }); // Required for Apple Writing Tools
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup();
  });
}

function setupGhostContextMenu(window) {
  window.webContents.on('context-menu', (event, params) => {
    const template = [
      {
        label: 'Exit Ghost Mode',
        click: () => {
          if (win && !win.isDestroyed()) {
            win.show();
            if (ghostState) win.webContents.send('sync-timer-state', ghostState);
          }
          window.close();
        }
      },
      { type: 'separator' },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: window.isAlwaysOnTop(),
        click: (item) => {
           const flag = item.checked;
           if (process.platform === 'darwin') {
             window.setAlwaysOnTop(flag, 'floating', 1);
             window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
           } else {
             window.setAlwaysOnTop(flag, 'floating');
           }
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup();
  });
}

function hideTrayWindow() {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.hide();
    trayWindow.blur();
    trayWindow.setAlwaysOnTop(false);
    trayWindow.setIgnoreMouseEvents(true);
  }
}

function createMiniCaptureWindow() {
  if (miniCaptureWin && !miniCaptureWin.isDestroyed()) {
    miniCaptureWin.show();
    miniCaptureWin.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  const x = Math.round((width - 600) / 2);
  const y = 100;

  miniCaptureWin = new BrowserWindow({
    width: 600,
    height: 400,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    show: false, // Start hidden
    alwaysOnTop: true,
    skipTaskbar: true,
    type: 'panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  if (process.platform === 'darwin') {
    miniCaptureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Load the specific route
  const startUrl = app.isPackaged 
    ? `file://${path.join(__dirname, '../dist/index.html')}#minicapture`
    : 'http://localhost:5173/#minicapture';

  miniCaptureWin.loadURL(startUrl);

  // Clean up when closed
  miniCaptureWin.on('closed', () => {
    miniCaptureWin = null;
  });
}

function triggerQuickCapture() {
  if (miniCaptureWin && !miniCaptureWin.isDestroyed() && miniCaptureWin.isVisible()) {
    miniCaptureWin.webContents.send('tray-action', { type: 'CLOSE_MINI_CAPTURE' });
  } else {
    createMiniCaptureWindow();
    miniCaptureWin.show();
    miniCaptureWin.focus();
  }
}

function createGhostWindow() {
  if (ghostWin) return;

  // Get the display where the cursor is currently located
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);

  ghostWin = new BrowserWindow({
    width: 220,  // Small size
    height: 220,
    frame: false,       // No title bar (CRITICAL)
    transparent: true,  // See-through background (CRITICAL)
    alwaysOnTop: true,  // Floating effect
    resizable: false,
    hasShadow: false,   // Cleaner look
    type: 'panel',      // macOS optimization: floats above full-screen apps
    x: display.bounds.x + (display.bounds.width / 2) - 110, // Center horizontally
    y: display.bounds.y + (display.bounds.height / 2) - 110, // Center vertically
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Critical for timer accuracy in background
    }
  });

  // Ensure it stays on top of full-screen apps on macOS
  if (process.platform === 'darwin') {
    ghostWin.setAlwaysOnTop(true, 'screen-saver', 1);
    ghostWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  const isDev = !app.isPackaged;
  // Load the app with the specific HASH
  const startUrl = isDev 
    ? 'http://localhost:5173/#ghost' 
    : `file://${path.join(__dirname, '../dist/index.html')}#ghost`;

  ghostWin.loadURL(startUrl);

  ghostWin.on('closed', () => {
    ghostWin = null;
    stopActiveWindowTracking();
  });

  startActiveWindowTracking();
}

function setupIpcHandlers() {
  // IPC handlers for the Mini Capture Window
  ipcMain.on('close-mini-capture', () => {
    if (miniCaptureWin && !miniCaptureWin.isDestroyed()) {
      miniCaptureWin.hide();
      if (process.platform === 'darwin') app.hide();
    }
  });
  ipcMain.on('resize-mini-capture', (event, { height }) => { 
    if(miniCaptureWin && !miniCaptureWin.isDestroyed()) {
      miniCaptureWin.setSize(600, height);
    }
  });

  // IPC handlers for the custom traffic light buttons
  ipcMain.on('window-close', (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    
    // Specific check for mini capture
    if (window === miniCaptureWin) {
        miniCaptureWin.hide(); // Hide instead of close
        return; 
    }

    if (window === ghostWin) {
        window.close(); // Closing ghost window usually means exiting ghost mode, handled by toggle
        return;
    }

    // Delegate to window.close() to trigger the close event handler which handles minimize-to-tray logic
    if (window && !window.isDestroyed()) window.close();
  });
  ipcMain.on('window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  });
  ipcMain.on('window-move', (event, { x, y }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      const { width, height } = window.getBounds();
      const display = screen.getDisplayNearestPoint({ x: x + width / 2, y: y + height / 2 });
      const workArea = display.workArea;
      const snapThreshold = 20;

      let newX = x;
      let newY = y;

      if (Math.abs(x - workArea.x) < snapThreshold) {
        newX = workArea.x;
      } else if (Math.abs((x + width) - (workArea.x + workArea.width)) < snapThreshold) {
        newX = workArea.x + workArea.width - width;
      }

      if (Math.abs(y - workArea.y) < snapThreshold) {
        newY = workArea.y;
      } else if (Math.abs((y + height) - (workArea.y + workArea.height)) < snapThreshold) {
        newY = workArea.y + workArea.height - height;
      }

      window.setPosition(Math.round(newX), Math.round(newY));
    }
  });
  ipcMain.on('window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.on('window-resize', (event, { width, height }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.setSize(width, height);
    }
  });

  ipcMain.on('update-tray-title', (event, title) => {
    lastTrayTitle = title;
    if (tray) {
      tray.setTitle(title);
      if (process.platform === 'darwin') {
        if (title && title.length > 0) {
          if (transparentIcon) tray.setImage(transparentIcon);
        } else {
          if (defaultIcon) tray.setImage(defaultIcon);
        }
      }
    }
  });

  ipcMain.on('update-dock-visibility', (event, visible) => {
    showInDock = visible;
    saveSetting('showInDock', visible);
    if (process.platform === 'darwin') {
      if (visible) app.dock.show();
      else app.dock.hide();
    }
  });

  ipcMain.on('quick-timer-set', (event, minutes) => {
    console.log('[Timer Debug] Quick timer set:', minutes);
    hideTrayWindow();
    
    if (!win || win.isDestroyed()) {
        const allWindows = BrowserWindow.getAllWindows();
        win = allWindows.find(w => w !== trayWindow && w !== miniCaptureWin && w !== ghostWin && !w.isDestroyed()) || null;
    }

    if (win && !win.isDestroyed()) {
      // Don't force show window, let it run in background (tray updates)
      win.webContents.send('quick-start', minutes);

      // If main window is minimized, prevent it from restoring/focusing by hiding the app (macOS)
      if (win.isMinimized() && process.platform === 'darwin') {
        app.hide();
      }
    }
  });

  // Tray Drag End (New Handler)
  ipcMain.on('tray-drag-end', (event, duration) => {
    hideTrayWindow();
    
    if (!win || win.isDestroyed()) {
        const allWindows = BrowserWindow.getAllWindows();
        win = allWindows.find(w => w !== trayWindow && w !== miniCaptureWin && w !== ghostWin && !w.isDestroyed()) || null;
    }

    if (win && !win.isDestroyed()) {
      win.webContents.send('quick-start', duration);
      if (win.isMinimized() && process.platform === 'darwin') {
        app.hide();
      }
    }
  });

  ipcMain.on('quick-timer-cancel', () => {
    console.log('[Timer Debug] Quick timer canceled');
    hideTrayWindow();
  });

  ipcMain.on('factory-reset', async (event) => {
    try {
      await event.sender.session.clearStorageData();
    } finally {
      app.relaunch();
      app.exit(0);
    }
  });

  ipcMain.on('update-title-bar-overlay', (event, options) => {
    if (win) win.setTitleBarOverlay(options);
  });

  ipcMain.on('prevent-app-suspension', (event, enable) => {
    if (enable) {
      if (powerSaveBlockerId === null) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } else {
      if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
      }
    }
  });

  ipcMain.handle('get-open-at-login', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.on('set-minimize-to-tray', (event, minimize) => {
    minimizeToTray = minimize;
  });

  ipcMain.on('set-ghost-snap-corner', (event, corner) => {
    ghostSnapCorner = corner;
    saveSetting('ghostSnapCorner', corner);
  });

  ipcMain.on('set-open-at-login', (event, openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin });
  });

  ipcMain.handle('get-global-shortcut', () => currentGlobalShortcut);

  ipcMain.handle('update-global-shortcut', async (event, shortcut) => {
    const oldShortcut = currentGlobalShortcut;

    // Case 1: Disable shortcut
    if (!shortcut || shortcut.trim() === '') {
      if (oldShortcut) {
        globalShortcut.unregister(oldShortcut);
        currentGlobalShortcut = '';
        saveSetting('globalShortcut', '');
      }
      return true;
    }

    // Case 2: Change shortcut
    if (shortcut === oldShortcut) return true;

    // Unregister old one first
    if (oldShortcut) {
      globalShortcut.unregister(oldShortcut);
    }

    try {
      const success = globalShortcut.register(shortcut, triggerQuickCapture);
      if (success) {
        currentGlobalShortcut = shortcut;
        saveSetting('globalShortcut', shortcut);
        return true;
      } else {
        // Registration failed (likely taken), restore old one
        if (oldShortcut) {
          globalShortcut.register(oldShortcut, triggerQuickCapture);
        }
        return false;
      }
    } catch (e) {
      console.error('Failed to register shortcut:', e);
      // Restore old one on error
      if (oldShortcut) {
        try { globalShortcut.register(oldShortcut, triggerQuickCapture); } catch {}
      }
      return false;
    }
  });

  ipcMain.handle('open-quick-capture', () => triggerQuickCapture());

  ipcMain.handle('select-backup-folder', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || win;
    const result = targetWindow 
      ? await dialog.showOpenDialog(targetWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
      
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('select-file', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || win;
    const result = targetWindow 
      ? await dialog.showOpenDialog(targetWindow, { properties: ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] });
      
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('select-directory', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || win;
    const result = targetWindow 
      ? await dialog.showOpenDialog(targetWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
      
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('create-new-file', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || win;
    const result = targetWindow 
      ? await dialog.showSaveDialog(targetWindow, {
          title: 'Create New Capture File',
          filters: [{ name: 'Markdown', extensions: ['md'] }]
      })
      : await dialog.showSaveDialog({
          title: 'Create New Capture File',
          filters: [{ name: 'Markdown', extensions: ['md'] }]
      });
      
    if (result.canceled || !result.filePath) return null;
    
    try {
        await fs.promises.writeFile(result.filePath, '');
        return result.filePath;
    } catch (e) {
        return null;
    }
  });

  ipcMain.handle('save-backup-file', async (event, folderPath, data) => {
    try {
      const filename = `focusflow_backup_${Date.now()}.json`;
      const filePath = path.join(folderPath, filename);
      const tempPath = filePath + '.tmp';
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(tempPath, data, 'utf8');
      await fs.promises.rename(tempPath, filePath);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-file-to-folder', async (event, folderPath, filename, data) => {
    try {
      const filePath = path.join(folderPath, filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-binary-file', async (event, folderPath, filename, buffer) => {
    try {
      const filePath = path.isAbsolute(filename) ? filename : path.join(folderPath, filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, buffer);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('append-file-to-folder', async (event, folderPath, filename, data) => {
    try {
      const filePath = path.isAbsolute(filename) ? filename : path.join(folderPath, filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      // Append to file, create if it doesn't exist
      await fs.promises.appendFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('update-daily-note', async (event, folderPath, filename, lineContent, header, position) => {
    try {
      const filePath = path.isAbsolute(filename) ? filename : path.join(folderPath, filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      // Optimization: Use appendFile if possible to avoid read-modify-write race conditions with iCloud
      if (!header && position === 'append') {
        await fs.promises.appendFile(filePath, lineContent, 'utf8');
        return { success: true, path: filePath };
      }

      let fileContent = '';
      try {
        fileContent = await fs.promises.readFile(filePath, 'utf8');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }

      const lines = fileContent.split(/\r?\n/);
      if (lines.length === 1 && lines[0] === '') lines.pop();

      if (!header) {
          if (position === 'prepend') {
              lines.unshift(lineContent);
          } else {
              lines.push(lineContent);
          }
      } else {
          const headerRegex = new RegExp(`^#+\s+${header.trim()}\s*$`, 'i');
          const headerIndex = lines.findIndex(line => headerRegex.test(line));

          if (headerIndex === -1) {
              if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
              lines.push(`## ${header}`);
              lines.push(lineContent);
          } else {
              if (position === 'prepend') {
                  lines.splice(headerIndex + 1, 0, lineContent);
              } else {
                  let nextHeaderIndex = -1;
                  for (let i = headerIndex + 1; i < lines.length; i++) {
                      if (/^#+\s+/.test(lines[i])) {
                          nextHeaderIndex = i;
                          break;
                      }
                  }
                  if (nextHeaderIndex === -1) {
                      lines.push(lineContent);
                  } else {
                      lines.splice(nextHeaderIndex, 0, lineContent);
                  }
              }
          }
      }

      await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-file-headers', async (event, folderPath, filename) => {
    try {
      const filePath = path.isAbsolute(filename) ? filename : path.join(folderPath || '', filename);
      try {
        await fs.promises.access(filePath);
      } catch {
        return { success: false, error: 'File not found' };
      }
      const content = await fs.promises.readFile(filePath, 'utf8');
      const headers = content.split(/\r?\n/).filter(line => /^#+\s/.test(line)).map(line => line.replace(/^#+\s*/, '').trim());
      return { success: true, headers };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('watch-path', (event, targetPath) => {
    if (fileWatcher) {
      fileWatcher.close();
      fileWatcher = null;
    }
    if (!targetPath || !fs.existsSync(targetPath)) return;

    try {
      fileWatcher = fs.watch(targetPath, (eventType, filename) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('file-changed', { eventType, filename, path: targetPath });
        }
      });
    } catch (e) {
      console.error("Failed to watch path:", e);
    }
  });

  ipcMain.on('unwatch-path', () => {
    if (fileWatcher) {
      fileWatcher.close();
      fileWatcher = null;
    }
  });

  ipcMain.handle('set-do-not-disturb', (event, enable) => {
    setDoNotDisturb(enable);
  });

  ipcMain.on('ghost-mode-enable', (event, state) => {
  if (state) {
      ghostState = state;
  }
  createGhostWindow();
  if (win) win.hide(); // Hide the big window
});

// Handle disabling Ghost Mode (Expand button)
ipcMain.on('ghost-mode-disable', () => {
    if (ghostWin) {
        ghostWin.close();
        ghostWin = null;
    }
    if (win) {
        win.show();
        win.focus();
        win.webContents.send('sync-ui-mode', 'normal');
    }
});

  ipcMain.on('set-always-on-top', (event, mode) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // Cleanup existing listeners
      if (activeModeListeners.has(win)) {
        const { onFocus, onBlur } = activeModeListeners.get(win);
        win.removeListener('focus', onFocus);
        win.removeListener('blur', onBlur);
        activeModeListeners.delete(win);
      }

      if (mode === 'active') {
        const onFocus = () => win.setAlwaysOnTop(true, 'floating');
        const onBlur = () => win.setAlwaysOnTop(false);
        
        win.on('focus', onFocus);
        win.on('blur', onBlur);
        activeModeListeners.set(win, { onFocus, onBlur });
        
        if (win.isFocused()) win.setAlwaysOnTop(true, 'floating');
        else win.setAlwaysOnTop(false);

        if (process.platform === 'darwin') {
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
      } else if (mode === true || mode === 'standard') {
        win.setAlwaysOnTop(true, 'floating');
        if (process.platform === 'darwin') {
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
      } else {
        win.setAlwaysOnTop(false);
        if (process.platform === 'darwin') {
          win.setVisibleOnAllWorkspaces(false);
        }
      }
    }
  });

// Handle Timer Actions from Ghost Mode
ipcMain.on('timer-action', (event, { action }) => {
    // Map ghost actions to tray actions for unified handling in TimerPanel
    let type = '';
    if (action === 'start' || action === 'pause') type = 'TOGGLE_TIMER';
    else if (action === 'stop') type = 'RESET_TIMER';
    
    if (type && win && !win.isDestroyed()) {
        win.webContents.send('tray-action', { type });
    }
});

  ipcMain.on('broadcast-timer-action', (event, { action, payload }) => {
    // Update global ghost state so new windows get correct data immediately
    if (['START_TIMER', 'PAUSE_TIMER', 'RESET_TIMER', 'SKIP_PHASE', 'UPDATE_LABEL'].includes(action)) {
        ghostState = {
            ...payload,
            isRunning: action === 'START_TIMER',
            lastUpdated: Date.now()
        };
        
        // If Ghost Window is open, sync it immediately
        if (ghostWin && !ghostWin.isDestroyed()) {
            ghostWin.webContents.send('sync-timer-state', ghostState);
        }

        // Update macOS System UI
        updateMacSystemUI(ghostState);
    }
  });

  ipcMain.on('get-timer-state', (event) => {
    console.log('[Timer Debug] Get timer state:', ghostState);
    if (ghostState) {
      event.sender.send('sync-timer-state', ghostState);
    }
  });

  ipcMain.on('request-timer-state', (event) => {
    console.log('[Timer Debug] Request timer state:', ghostState);
    if (ghostState) {
      event.sender.send('sync-timer-state', ghostState);
    }
  });

  ipcMain.on('play-sound-effect', () => {
    shell.beep();
  });

  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('install-update', (event, filePath) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('select-update-file', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Installers', extensions: ['dmg', 'pkg', 'zip'] }] });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: createAppIcon(),
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#121212', // Transparent on Mac for vibrancy
    frame: process.platform === 'darwin',
    titleBarStyle: 'hidden', 
    titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#9CA3AF',
        height: 36
    },
    trafficLightPosition: { x: 16, y: 12 }, // Native alignment
    vibrancy: 'under-window', // macOS native blur effect
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  // Fix for Google Auth "Cross-Origin-Opener-Policy" error and other CORS issues
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin-allow-popups']
      }
    });
  });

  // Prevent closing the app when the window is closed (minimize to tray)
  win.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    // On macOS, standard behavior is to hide the window on close.
    // If Minimize to Tray is enabled, we also hide instead of close.
    if (process.platform === 'darwin' || minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  // Dock Sync: Hide dock icon when window is hidden (if minimize to tray is enabled)
  win.on('hide', () => {
    if (process.platform === 'darwin' && minimizeToTray) {
      app.dock.hide();
    }
  });

  win.on('show', () => {
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });

  win.on('minimize', (event) => {
    if (!showInDock && process.platform === 'darwin') {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('enter-full-screen', () => {
    win.webContents.send('fullscreen-change', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('fullscreen-change', false);
  });

  const menuTemplate = [
    {
      label: 'FocusFlow',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startspeaking' },
            { role: 'stopspeaking' }
          ]
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://electronjs.org');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);


  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html')).catch(e => {
        console.error('Failed to load index.html:', e);
    });
  }
  
  setupContextMenu(win);
  
  return win;
}

function createTrayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height } = primaryDisplay.bounds;

  trayWindow = new BrowserWindow({
    width: 300,
    height: height, // Full screen height for drag space
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  const isDev = !app.isPackaged;
  const url = isDev 
    ? 'http://localhost:5173?mode=quick' 
    : `file://${path.join(__dirname, '../dist/index.html')}?mode=quick`;
  
  trayWindow.loadURL(url);

  // Force transparency
  trayWindow.webContents.on('did-finish-load', () => {
    trayWindow.webContents.insertCSS('html, body { background: transparent !important; }');
  });

  trayWindow.on('hide', () => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.setIgnoreMouseEvents(true);
      globalShortcut.unregister('Escape'); // Unregister Esc
    }
  });

  trayWindow.on('show', () => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.setIgnoreMouseEvents(false);
      globalShortcut.register('Escape', hideTrayWindow); // Register Esc to close
    }
  });

  trayWindow.on('closed', () => {
    trayWindow = null;
  });
}

function showTrayWindow() {
  if (!trayWindow) createTrayWindow();
  
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  
  let startX = cursorPoint.x;
  let startY = cursorPoint.y;

  if (tray && !tray.isDestroyed()) {
      try {
          const bounds = tray.getBounds();
          if (bounds && bounds.width > 0) {
              startX = Math.round(bounds.x + bounds.width / 2);
              startY = Math.round(bounds.y + bounds.height / 2);
          }
      } catch (e) {
          console.error("Tray bounds error:", e);
      }
  }

  const width = 300;
  const height = display.bounds.height;
  const x = Math.round(startX - width / 2);
  const y = display.bounds.y; // Start at top of screen

  trayWindow.setPosition(x, y);
  trayWindow.setSize(width, height);
  trayWindow.show();
  trayWindow.focus();

  trayWindow.webContents.executeJavaScript(`
    window.dispatchEvent(new CustomEvent('tray-position', { 
        detail: { x: 150, y: 0 } 
    }));
  `).catch(() => {});
}

// Local Auth Server for OAuth Callbacks (TickTick, etc.)
function createAuthServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:54321');
    const code = url.searchParams.get('code');
    
    if (code) {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
        win.webContents.send('oauth-code', code); // Send the code directly
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;"><h1>Login Successful</h1><p>You can close this window and return to FocusFlow.</p><script>setTimeout(window.close, 1000);</script></body></html>');
    } else {
      res.writeHead(400);
      res.end('No code found');
    }
  });
  
  server.listen(54321, '127.0.0.1', () => {
    console.log('Auth server listening on port 54321');
  });
}

app.whenReady().then(() => {
    // Initialize Dock Visibility from Settings
    const settings = loadSettings();
    if (settings.showInDock !== undefined) {
        showInDock = settings.showInDock;
        if (process.platform === 'darwin' && !showInDock) {
            app.dock.hide();
        }
    }

    // Handle Deep Links (focusflow://)
    app.on('open-url', (event, url) => {
      event.preventDefault();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
        win.webContents.send('oauth-code', url);
      }
    });

    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('focusflow', process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient('focusflow');
    }
    setupIpcHandlers();
    createWindow();
    createAuthServer();

    const autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.on('update-available', () => {
      if (win && !win.isDestroyed()) win.webContents.send('update_available');
    });
    autoUpdater.on('update-downloaded', () => {
      if (win && !win.isDestroyed()) win.webContents.send('update_downloaded');
    });
    win.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
    
    // Defer non-critical background windows and tray to prioritize main window render
    setTimeout(() => {
        const settings = loadSettings();
        if (settings.ghostSnapCorner) ghostSnapCorner = settings.ghostSnapCorner;
        const shortcut = settings.globalShortcut || 'CommandOrControl+Shift+C';

        try {
          globalShortcut.register(shortcut, triggerQuickCapture);
        } catch (e) {
          console.error('Failed to register shortcut:', e);
        }

        // Pre-load the window so it opens instantly
        createMiniCaptureWindow();
        createTrayWindow();
        
        // Create Tray
        defaultIcon = createTrayIcon();
        // Create transparent icon (1x1 transparent pixel) to hide icon when text is shown
        const buffer = Buffer.alloc(4); 
        transparentIcon = nativeImage.createFromBitmap(buffer, { width: 1, height: 1 });

        tray = new Tray(defaultIcon);
        
        tray.setToolTip('FocusFlow');
        
        const getDynamicMenu = () => {
            const template = [
                {
                    label: "⏯ Start/Pause Timer",
                    click: () => {
                        console.log('[Timer Debug] Tray: Toggle Timer');
                        win && !win.isDestroyed() && win.webContents.send('tray-action', { type: 'TOGGLE_TIMER' });
                    }
                },
                {
                    label: "⏭ Skip Break",
                    click: () => {
                        console.log('[Timer Debug] Tray: Skip Phase');
                        win && !win.isDestroyed() && win.webContents.send('tray-action', { type: 'SKIP_PHASE' });
                    }
                },
                { "type": "separator" },
                {
                    label: "⚡ Quick Focus (25m)",
                    click: () => {
                        console.log('[Timer Debug] Tray: Quick Focus');
                        win && !win.isDestroyed() && win.webContents.send('tray-action', { type: 'START_FOCUS', duration: 25 });
                    }
                },
                { label: '📝 Quick Capture', click: () => triggerQuickCapture() },
                { type: 'separator' },
                { label: 'Show App', click: () => {
                    if (process.platform === 'darwin') app.dock.show();
                    if (win) {
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                    }
                } },
                { label: 'Quit', click: () => app.quit() }
            ];
            return Menu.buildFromTemplate(template);
        };

        // Left Click: Trigger Quick Timer (Drag)
        tray.on('mouse-down', (event) => {
            // Fix: Allow Option/Alt + Click or Ctrl + Click to show context menu
            if (event.altKey || event.ctrlKey) {
                tray.popUpContextMenu(getDynamicMenu());
            } else {
                showTrayWindow();
            }
        });
        
        // Right Click: Open Context Menu
        tray.on('right-click', () => {
            tray.popUpContextMenu(getDynamicMenu());
        });
        
        // macOS Dock Menu
        if (process.platform === 'darwin') {
            app.dock.setMenu(Menu.buildFromTemplate([
                { label: 'New Timer (Drag)', click: () => showTrayWindow() },
                { label: 'Show Window', click: () => win.show() }
            ]));
        }
        
        // Click on tray icon toggles context menu (default behavior for setContextMenu)
        // If we want left click to trigger Drag immediately, we can intercept 'click'
        // But user asked for "Select 'New Timer (Drag)'", which implies a menu. 
        // However, Gestimer workflow usually triggers on drag. We stick to Menu per prompt "Access: left-click ... select ...".
        
        // Apply any pending title that came in before tray was ready
        if (lastTrayTitle) {
            if (process.platform === 'darwin') {
                tray.setTitle(lastTrayTitle);
                if (transparentIcon) tray.setImage(transparentIcon);
            } else {
                tray.setToolTip(lastTrayTitle);
            }
        }
    }, 300);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    globalShortcut.unregisterAll();
  } catch (e) {
    // Ignore error if app is not ready (e.g. single instance lock check failed)
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
  }
});

// Handle Second Instance (Focus existing window)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      // Find the protocol url in commandLine
      const url = commandLine.find(arg => arg.startsWith('focusflow://'));
      if (url) win.webContents.send('oauth-code', url);
    }
  });
}