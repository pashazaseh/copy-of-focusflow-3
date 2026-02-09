const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerSaveBlocker, dialog, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setDoNotDisturb } = require('./dnd');

let tray = null;
let win = null;
let quickWin = null;
let miniCaptureWin = null;
let ghostWin = null;
let defaultIcon = null;
let transparentIcon = null;
let isQuitting = false;
let powerSaveBlockerId = null;
let fileWatcher = null;
let currentGlobalShortcut = 'CommandOrControl+Shift+O';
let lastTrayTitle = '';
let ghostState = null;
let isTimerActive = false;

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

function hideQuickTimer() {
  if (quickWin && !quickWin.isDestroyed()) {
    quickWin.hide();
    quickWin.blur();
    quickWin.setAlwaysOnTop(false);
    quickWin.setIgnoreMouseEvents(true);
  }
}

function createMiniCaptureWindow() {
  if (miniCaptureWin && !miniCaptureWin.isDestroyed()) {
    if (process.platform === 'darwin') {
      miniCaptureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      miniCaptureWin.setAlwaysOnTop(true, 'screen-saver', 1);
    }
    miniCaptureWin.show();
    miniCaptureWin.focus();
    return;
  }

  miniCaptureWin = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    show: false,
    alwaysOnTop: true,
    type: 'panel',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow external API calls (Gemini)
    }
  });

  if (process.platform === 'darwin') {
    miniCaptureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    miniCaptureWin.setAlwaysOnTop(true, 'screen-saver', 1);
    miniCaptureWin.setFullScreenable(false);
  } else {
    miniCaptureWin.setAlwaysOnTop(true, 'floating');
  }

  const isDev = !app.isPackaged;
  const url = isDev 
    ? 'http://localhost:5173?mode=mini-capture' 
    : `file://${path.join(__dirname, '../dist/index.html')}?mode=mini-capture`;
  
  miniCaptureWin.loadURL(url);

  setupContextMenu(miniCaptureWin);

  miniCaptureWin.once('ready-to-show', () => {
    miniCaptureWin.show();
    miniCaptureWin.focus();
  });

  miniCaptureWin.on('closed', () => {
    miniCaptureWin = null;
  });
}

function triggerQuickCapture() {
  // Toggle behavior: If open and focused, hide it.
  if (miniCaptureWin && !miniCaptureWin.isDestroyed() && miniCaptureWin.isVisible() && miniCaptureWin.isFocused()) {
    miniCaptureWin.hide();
    if (process.platform === 'darwin') app.hide();
    return;
  }

  createMiniCaptureWindow();
}

function createGhostWindow(initialState) {
    const ghostStatePath = path.join(app.getPath('userData'), 'ghost-window-state.json');
  if (ghostWin && !ghostWin.isDestroyed()) {
    ghostWin.show();
    ghostWin.focus();
    return;
  }

  let savedBounds = { width: 300, height: 300 };
  try {
    if (fs.existsSync(ghostStatePath)) {
      savedBounds = JSON.parse(fs.readFileSync(ghostStatePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load ghost state', e);
  }

  ghostWin = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    center: !savedBounds.x,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  if (process.platform === 'darwin') {
    ghostWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    ghostWin.setAlwaysOnTop(true, 'screen-saver', 1);
    ghostWin.setFullScreenable(false);
  } else {
    ghostWin.setAlwaysOnTop(true, 'floating');
  }

  const isDev = !app.isPackaged;
  const url = isDev 
    ? 'http://localhost:5173?mode=ghost' 
    : `file://${path.join(__dirname, '../dist/index.html')}?mode=ghost`;
  
  ghostWin.loadURL(url);

  ghostWin.once('ready-to-show', () => {
    ghostWin.show();
    ghostWin.focus();
  });

  // Failsafe: Show window if ready-to-show doesn't fire
  setTimeout(() => { if (ghostWin && !ghostWin.isVisible()) ghostWin.show(); }, 500);

  ghostWin.webContents.once('did-finish-load', () => {
    // Force transparent background for the ghost window
    ghostWin.webContents.insertCSS('html, body { background: transparent !important; overflow: hidden !important; }');
    if (initialState) {
      ghostWin.webContents.send('sync-timer-state', initialState);
    }
  });

  ghostWin.on('close', () => {
    if (ghostWin && !ghostWin.isDestroyed()) {
      try {
        const bounds = ghostWin.getBounds();
        fs.writeFileSync(ghostStatePath, JSON.stringify(bounds));
      } catch (e) {
        console.error('Failed to save ghost state', e);
      }
    }
  });

  ghostWin.on('closed', () => { ghostWin = null; });
}

function setupIpcHandlers() {
  // IPC handlers for the custom traffic light buttons
  ipcMain.on('window-close', (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    
    if (window === miniCaptureWin) {
        window.close();
        return;
    }

    if (window === ghostWin) {
        window.close(); // Closing ghost window usually means exiting ghost mode, handled by toggle
        return;
    }

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
    let displayTitle = title;
    if (displayTitle && displayTitle.length > 20) {
      displayTitle = displayTitle.substring(0, 20) + '...';
    }
    lastTrayTitle = displayTitle;
    if (tray && !tray.isDestroyed()) {
      if (process.platform === 'darwin') {
        tray.setTitle(displayTitle);
        // If title is present (e.g. Timer, Streak), hide icon by using transparent image.
        // If title is empty (Mode: None), show the default app icon.
        if (displayTitle && displayTitle.length > 0) {
          if (transparentIcon) tray.setImage(transparentIcon);
        } else {
          if (defaultIcon) tray.setImage(defaultIcon);
        }
      } else {
        // On Windows/Linux, we can't show text next to icon easily.
        // We should keep the icon visible and update tooltip.
        if (defaultIcon) tray.setImage(defaultIcon);
        tray.setToolTip(displayTitle || 'FocusFlow');
      }
    }
  });

  // Quick Timer IPC
  ipcMain.on('quick-timer-set', (event, minutes) => {
    hideQuickTimer();
    if (win && !win.isDestroyed()) {
      // Don't force show window, let it run in background (tray updates)
      win.webContents.send('start-timer-from-quick', minutes);

      // If main window is minimized, prevent it from restoring/focusing by hiding the app (macOS)
      if (win.isMinimized() && process.platform === 'darwin') {
        app.hide();
      }
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

  ipcMain.handle('update-global-shortcut', async (event, shortcut) => {
    globalShortcut.unregisterAll();
    if (shortcut && shortcut.trim() !== '') {
      currentGlobalShortcut = shortcut;
      try {
        const success = globalShortcut.register(shortcut, triggerQuickCapture);
        return success;
      } catch (e) {
        console.error('Failed to register shortcut:', e);
        return false;
      }
    }
    return true;
  });

  ipcMain.on('open-quick-capture', triggerQuickCapture);

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

  ipcMain.on('toggle-ghost-mode', (event, state) => {
    ghostState = state;
    if (ghostWin && !ghostWin.isDestroyed()) {
      // Exit Ghost Mode
      if (win && !win.isDestroyed()) {
        win.show();
        win.webContents.send('sync-timer-state', state);
      }
      ghostWin.close();
    } else {
      // Enter Ghost Mode
      createGhostWindow(state);
      if (win && !win.isDestroyed()) {
        win.hide();
      }
    }
  });

  ipcMain.on('set-always-on-top', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (flag) {
        if (process.platform === 'darwin') {
          win.setAlwaysOnTop(true, 'screen-saver', 1);
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } else {
          win.setAlwaysOnTop(true, 'floating');
        }
      } else {
        win.setAlwaysOnTop(false);
      }
    }
  });

  ipcMain.on('timer-action', (event, { action, payload }) => {
    ghostState = payload;
    
    if (action === 'START_TIMER') isTimerActive = true;
    else if (action === 'PAUSE_TIMER' || action === 'RESET_TIMER') isTimerActive = false;

    const windows = [win, ghostWin].filter(w => w && !w.isDestroyed());
    windows.forEach(w => {
      if (w.webContents !== event.sender) {
        w.webContents.send('timer-update', { action, payload });
      }
    });
  });

  ipcMain.on('get-timer-state', (event) => {
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
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: createAppIcon(),
    backgroundColor: '#121212', // Dark background for instant non-white paint
    frame: process.platform === 'darwin',
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
    win.loadFile(path.join(__dirname, '../dist/index.html')).catch(e => {
        console.error('Failed to load index.html:', e);
    });
  }
  
  setupContextMenu(win);
  
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
  
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  
  quickWin.setBounds(display.bounds);
  
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
          // Fallback to cursor
      }
  }

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

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('oauth-code', url);
  }
});

function createAuthServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:54321');
    const code = url.searchParams.get('code');
    
    if (code) {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
        win.webContents.send('oauth-code', code);
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
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.yourname.focusflow');
    }
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

    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('update-available', () => {
      if (win && !win.isDestroyed()) win.webContents.send('update_available');
    });
    autoUpdater.on('update-downloaded', () => {
      if (win && !win.isDestroyed()) win.webContents.send('update_downloaded');
    });
    win.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
    
    setTimeout(() => {
        try {
            if (currentGlobalShortcut && !globalShortcut.isRegistered(currentGlobalShortcut)) {
                globalShortcut.register(currentGlobalShortcut, triggerQuickCapture);
            }
        } catch (e) {
            console.error('Failed to register global shortcut:', e);
        }

        createQuickWindow();
        
        defaultIcon = createTrayIcon();
        const buffer = Buffer.alloc(4); 
        transparentIcon = nativeImage.createFromBuffer(buffer, { width: 1, height: 1 });

        tray = new Tray(defaultIcon);
        
        tray.setToolTip('FocusFlow');
        
        const getDynamicMenu = () => {
            const template = [
                {
                    label: "⏯ Start/Pause Timer",
                    click: () => win.webContents.send('tray-action', { type: 'TOGGLE_TIMER' })
                },
                {
                    label: "⏭ Skip Break", 
                    click: () => win.webContents.send('tray-action', { type: 'SKIP_PHASE' })
                },
                { "type": "separator" },
                {
                    label: "⚡ Quick Focus (25m)", 
                    click: () => win.webContents.send('tray-action', { type: 'START_FOCUS', duration: 25 })
                },
                { label: '📝 Quick Capture', click: () => triggerQuickCapture() },
                { type: 'separator' },
                { label: 'Show App', click: () => win.show() },
                { label: 'Quit', click: () => app.quit() }
            ];
            return Menu.buildFromTemplate(template);
        };

        tray.on('mouse-down', (event) => {
            if (event.altKey || event.ctrlKey) {
                tray.popUpContextMenu(getDynamicMenu());
            } else {
                showQuickTimer();
            }
        });
        
        tray.on('right-click', () => {
            tray.popUpContextMenu(getDynamicMenu());
        });
        
        if (process.platform === 'darwin') {
            app.dock.setMenu(Menu.buildFromTemplate([
                { label: 'New Timer (Drag)', click: () => showQuickTimer() },
                { label: 'Show Window', click: () => win.show() }
            ]));
        }
        
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
    // Ignore error if app is not ready
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (win) win.show();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      const url = commandLine.find(arg => arg.startsWith('focusflow://'));
      if (url) win.webContents.send('oauth-code', url);
    }
  });
}
