
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerSaveBlocker, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let win = null;
let quickWin = null;
let defaultIcon = null;
let transparentIcon = null;
let isQuitting = false;
let powerSaveBlockerId = null;

// Helper to create a simple icon since we might not have assets
function createTrayIcon() {
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
          buffer[idx] = 0; buffer[idx + 1] = 0; buffer[idx + 2] = 0; buffer[idx + 3] = Math.floor(alpha);
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
  img.setTemplateImage(true);
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

function hideQuickTimer() {
  if (quickWin && !quickWin.isDestroyed()) {
    quickWin.hide();
    quickWin.blur();
    quickWin.setAlwaysOnTop(false);
    quickWin.setIgnoreMouseEvents(true);
  }
}

function setupIpcHandlers() {
  // IPC handlers for the custom traffic light buttons
  ipcMain.on('window-close', () => {
    if (tray && !tray.isDestroyed()) {
        if (win && !win.isDestroyed()) win.hide();
    } else if (win && !win.isDestroyed()) {
        win.close();
    }
  });
  ipcMain.on('window-minimize', () => { if (win && !win.isDestroyed()) win.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (win && !win.isDestroyed()) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
  });

  ipcMain.on('update-tray-title', (event, title) => {
    if (tray && !tray.isDestroyed()) {
      tray.setTitle(title);
      // If title is present (e.g. Timer, Streak), hide icon by using transparent image.
      // If title is empty (Mode: None), show the default app icon.
      if (title && title.length > 0) {
        if (transparentIcon) tray.setImage(transparentIcon);
      } else {
        if (defaultIcon) tray.setImage(defaultIcon);
      }
    }
  });

  // Quick Timer IPC
  ipcMain.on('quick-timer-set', (event, minutes) => {
    hideQuickTimer();
    if (win && !win.isDestroyed()) {
      // Don't force show window, let it run in background (tray updates)
      win.webContents.send('start-timer-from-quick', minutes);
    }
  });

  ipcMain.on('quick-timer-cancel', () => {
    hideQuickTimer();
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

  ipcMain.on('set-open-at-login', (event, openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin });
  });

  ipcMain.handle('select-backup-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('save-backup-file', async (event, folderPath, data) => {
    try {
      const filename = `focusflow_backup_${Date.now()}.json`;
      const filePath = path.join(folderPath, filename);
      await fs.promises.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-file-to-folder', async (event, folderPath, filename, data) => {
    try {
      const filePath = path.join(folderPath, filename);
      await fs.promises.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('append-file-to-folder', async (event, folderPath, filename, data) => {
    try {
      const filePath = path.join(folderPath, filename);
      // Append to file, create if it doesn't exist
      await fs.promises.appendFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('update-daily-note', async (event, folderPath, filename, lineContent, header, position) => {
    try {
      const filePath = path.join(folderPath, filename);
      let fileContent = '';
      try {
        fileContent = await fs.promises.readFile(filePath, 'utf8');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }

      const lines = fileContent.split(/\r?\n/);
      if (lines.length === 1 && lines[0] === '') lines.pop();

      if (!header) {
          lines.push(lineContent);
      } else {
          const headerRegex = new RegExp(`^#+\\s+${header.trim()}\\s*$`, 'i');
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
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: createAppIcon(),
    backgroundColor: '#121212', // Dark background for instant non-white paint
    frame: false, // Frameless for custom Mac traffic lights
    titleBarStyle: 'hidden', 
    titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#9CA3AF',
        height: 40
    },
    trafficLightPosition: { x: 16, y: 12 }, // Native alignment
    vibrancy: 'under-window', // macOS native blur effect
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false // Ensure timer runs accurately in background
    },
  });

  // Prevent closing the app when the window is closed (minimize to tray)
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      return false;
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  return win;
}

function createQuickWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  quickWin = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    show: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;
  const url = isDev 
    ? 'http://localhost:5173?mode=quick' 
    : `file://${path.join(__dirname, '../dist/index.html')}?mode=quick`;
  
  quickWin.loadURL(url);

  // Force transparency to prevent "second background" flash
  quickWin.webContents.on('did-finish-load', () => {
    quickWin.webContents.insertCSS('html, body { background: transparent !important; }');
  });

  quickWin.on('hide', () => {
    if (quickWin && !quickWin.isDestroyed()) {
      quickWin.setIgnoreMouseEvents(true);
    }
  });

  quickWin.on('show', () => {
    if (quickWin && !quickWin.isDestroyed()) {
      quickWin.setIgnoreMouseEvents(false);
    }
  });

  quickWin.on('closed', () => {
    quickWin = null;
  });
}

function showQuickTimer() {
  if (!quickWin) createQuickWindow();
  
  // Position window on current screen
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  
  quickWin.setBounds(display.bounds);
  
  // Calculate start point: Try tray bounds first for centering (the "ribbon" location), fallback to cursor
  let startX = cursorPoint.x;
  let startY = cursorPoint.y;

  const localX = startX - display.bounds.x;
  const localY = startY - display.bounds.y;
    
  quickWin.webContents.executeJavaScript(`
    const anchorId = 'quick-timer-anchor';
    let anchor = document.getElementById(anchorId);
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.id = anchorId;
      document.body.appendChild(anchor);
    }
    Object.assign(anchor.style, {
      position: 'absolute',
      left: '${localX}px',
      top: '${localY}px',
      width: '10px',
      height: '10px',
      backgroundColor: '#ffffff',
      borderRadius: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '9999',
      pointerEvents: 'none',
      boxShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(0, 240, 255, 0.6)'
    });

    window.dispatchEvent(new CustomEvent('tray-position', { detail: { x: ${localX}, y: ${localY} } }));

    if (window.quickTimerAutoClose) clearTimeout(window.quickTimerAutoClose);
    if (window.clearAutoCloseTimer) {
        window.removeEventListener('mousedown', window.clearAutoCloseTimer);
        window.removeEventListener('touchstart', window.clearAutoCloseTimer);
    }

    window.clearAutoCloseTimer = () => {
        if (window.quickTimerAutoClose) clearTimeout(window.quickTimerAutoClose);
    };

    window.quickTimerAutoClose = setTimeout(() => {
        if (window.electronAPI) window.electronAPI.cancelQuickTimer();
    }, 4000);

    window.addEventListener('mousedown', window.clearAutoCloseTimer, { once: true });
    window.addEventListener('touchstart', window.clearAutoCloseTimer, { once: true });
  `).catch(() => {});

  quickWin.show();
  quickWin.focus();
}

app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
    
    // Defer non-critical background windows and tray to prioritize main window render
    setTimeout(() => {
        createQuickWindow();
        
        // Create Tray
        defaultIcon = createTrayIcon();
        // Create transparent icon (1x1 transparent pixel) to hide icon when text is shown
        const buffer = Buffer.alloc(4); 
        transparentIcon = nativeImage.createFromBuffer(buffer, { width: 1, height: 1 });

        tray = new Tray(defaultIcon);
        
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show FocusFlow', click: () => win.show() },
            { label: 'Quit', click: () => app.quit() }
        ]);
        
        tray.setToolTip('FocusFlow');
        
        // Left Click: Trigger Quick Timer (Drag)
        tray.on('mouse-down', () => showQuickTimer());
        
        // Right Click: Open Context Menu
        tray.on('right-click', () => tray.popUpContextMenu(contextMenu));
        
        // macOS Dock Menu
        if (process.platform === 'darwin') {
            app.dock.setMenu(Menu.buildFromTemplate([
                { label: 'New Timer (Drag)', click: () => showQuickTimer() },
                { label: 'Show Window', click: () => win.show() }
            ]));
        }
        
        // Click on tray icon toggles context menu (default behavior for setContextMenu)
        // If we want left click to trigger Drag immediately, we can intercept 'click'
        // But user asked for "Select 'New Timer (Drag)'", which implies a menu. 
        // However, Gestimer workflow usually triggers on drag. We stick to Menu per prompt "Access: left-click ... select ...".
    }, 300);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (win) win.show();
});