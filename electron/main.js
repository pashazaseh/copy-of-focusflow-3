
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');

let tray = null;
let win = null;
let quickWin = null;
let defaultIcon = null;
let transparentIcon = null;

// Helper to create a simple icon since we might not have assets
function createTrayIcon() {
  const size = 22;
  const buffer = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size / 2 - 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
      
      if (dist <= radius) {
        // Fill with black (template image will adapt color)
        buffer[idx] = 0; buffer[idx + 1] = 0; buffer[idx + 2] = 0; buffer[idx + 3] = 255;
      } else {
        buffer[idx + 3] = 0; // Transparent
      }
    }
  }
  
  const img = nativeImage.createFromBuffer(buffer, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}

function hideQuickTimer() {
  if (quickWin && !quickWin.isDestroyed()) {
    quickWin.hide();
    quickWin.blur();
    quickWin.setAlwaysOnTop(false);
    quickWin.setIgnoreMouseEvents(true);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom Mac traffic lights
    titleBarStyle: 'hidden', 
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

  // IPC handlers for the custom traffic light buttons
  ipcMain.on('window-close', () => {
    if (tray) {
        win.hide();
    } else {
        win.close();
    }
  });
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.on('update-tray-title', (event, title) => {
    if (tray) {
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
    if (win) {
      // Don't force show window, let it run in background (tray updates)
      win.webContents.send('start-timer-from-quick', minutes);
    }
  });

  ipcMain.on('quick-timer-cancel', () => {
    hideQuickTimer();
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
  
  // Send tray position to renderer for drag line origin
  if (tray) {
    const bounds = tray.getBounds();
    const x = Math.round(bounds.x + bounds.width / 2);
    const y = Math.round(bounds.y + bounds.height / 2);
    const localX = x - display.bounds.x;
    const localY = y - display.bounds.y;
    
    quickWin.webContents.executeJavaScript(`
      window.dispatchEvent(new CustomEvent('tray-position', { detail: { x: ${localX}, y: ${localY} } }));
    `).catch(() => {});
  }

  quickWin.show();
  quickWin.focus();
}

app.whenReady().then(() => {
    createWindow();
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (win) win.show();
});