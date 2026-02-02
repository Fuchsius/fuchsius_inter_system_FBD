const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, systemPreferences, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Fuchsius';
const ICON_FILE = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
const ICON_PATH = path.join(__dirname, 'src', 'assets', ICON_FILE);
const MAC_ACCESSIBILITY_URI = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const PREVIEW_URL = 'https://intersystem.fuchsius.com/';
// const PREVIEW_URL = 'http://localhost:5173/';
const RENDERER_ENTRY = path.join(__dirname, 'src', 'renderer', 'index.html');
const PREVIEW_ENTRY = path.join(__dirname, 'src', 'preview', 'index.html');
const IDLE_THRESHOLD_SECONDS = 5 * 60; // 5 minutes
const MOUSE_THROTTLE_MS = 120;

let mainWindow;
let tray;
let cachedIcon;
let uiohook;
let hookAvailable = true;
let hookInitialized = false;
let lastMouseEmit = 0;
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const isWayland = isLinux && process.env.XDG_SESSION_TYPE === 'wayland';
let permissionWindow;
let permissionAcknowledged = true;
let mainWindowContent = null;
const restrictedWindows = new WeakSet();
const stateCache = {
  broadcastSignature: null,
  traySignature: null
};

try {
  ({ uIOhook: uiohook } = require('uiohook-napi'));
} catch (error) {
  hookAvailable = false;
  console.error('[uiohook-napi] Failed to load. Did you run electron-rebuild?', error);
}

function applyWindowRestrictions(win) {
  if (!win || restrictedWindows.has(win)) return;
  restrictedWindows.add(win);

  if (typeof win.setMenuBarVisibility === 'function') {
    win.setMenuBarVisibility(false);
  }
  if (typeof win.setAutoHideMenuBar === 'function') {
    win.setAutoHideMenuBar(true);
  }
  if (typeof win.setMenu === 'function') {
    win.setMenu(null);
  }

  win.on('minimize', (event) => {
    event.preventDefault();
    win.show();
    win.focus();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key?.toLowerCase();
    const isReloadShortcut = input.key === 'F5' || ((input.meta || input.control) && key === 'r');
    if (isReloadShortcut) {
      event.preventDefault();
    }
  });

  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  win.webContents.on('devtools-opened', () => {
    win.webContents.closeDevTools();
  });
}

function configureApplicationMenu() {
  if (isMac) {
    const template = [
      {
        label: APP_NAME,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
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
          { role: 'selectAll' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
}

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  consentGranted: true,
  trackingEnabled: true
};

const trackingState = {
  consentGranted: true,
  userEnabled: true,
  hooksRunning: false,
  hookAvailable,
  accessibilityGranted: !isMac,
  accessibilityPrompted: false,
  linuxWayland: isWayland,
  lastActivityTs: null,
  idleSeconds: 0,
  status: 'idle',
  reason: 'consent_required',
  error: null
};

function openMacAccessibilitySettings() {
  if (!isMac) return false;
  try {
    if (typeof systemPreferences.openSystemPreferences === 'function') {
      const opened = systemPreferences.openSystemPreferences('Security', 'Privacy_Accessibility');
      if (opened) {
        return true;
      }
    }
    shell.openExternal(MAC_ACCESSIBILITY_URI);
    return true;
  } catch (error) {
    console.error('[accessibility] Unable to open settings', error);
    return false;
  }
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultSettings };
  }
}

function persistSettings(newSettings) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(newSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[settings] Failed to persist settings', error);
  }
}

function loadSettingsIntoState() {
  const saved = readSettings();
  trackingState.consentGranted = typeof saved.consentGranted === 'boolean' ? saved.consentGranted : true;
  trackingState.userEnabled = saved.trackingEnabled;

  if (!trackingState.consentGranted) {
    trackingState.consentGranted = true;
    saveStateToSettings();
  }
}

function saveStateToSettings() {
  persistSettings({
    consentGranted: trackingState.consentGranted,
    trackingEnabled: trackingState.userEnabled
  });
}

function getAppIcon() {
  if (!cachedIcon) {
    try {
      let iconPath = ICON_PATH;
      
      // Check if icon exists at the expected path
      if (!fs.existsSync(iconPath)) {
        console.log('[icon] Icon not found at:', iconPath);
        
        // Try different possible paths for packaged apps
        const possiblePaths = [
          path.join(__dirname, 'src', 'assets', ICON_FILE),
          path.join(__dirname, '..', 'src', 'assets', ICON_FILE),
          path.join(process.resourcesPath, 'app.asar', 'src', 'assets', ICON_FILE),
          path.join(process.resourcesPath, 'app', 'src', 'assets', ICON_FILE)
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            iconPath = testPath;
            console.log('[icon] Found icon at:', iconPath);
            break;
          }
        }
      }
      
      const candidate = nativeImage.createFromPath(iconPath);
      cachedIcon = candidate && !candidate.isEmpty() ? candidate : null;
      
      if (!cachedIcon) {
        console.error('[icon] Failed to load icon from all attempted paths');
      } else {
        console.log('[icon] Successfully loaded icon from:', iconPath);
      }
    } catch (error) {
      console.error('[icon] Unable to load app icon', error);
      cachedIcon = null;
    }
  }
  return cachedIcon;
}

function getTrayIcon() {
  const baseIcon = getAppIcon();
  if (!baseIcon) {
    return null;
  }

  const size = process.platform === 'darwin' ? 18 : 24;
  const trayIcon = baseIcon.resize({ width: size, height: size, quality: 'best' });
  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }
  return trayIcon;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 620,
    title: APP_NAME,
    show: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  });

  applyWindowRestrictions(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    if (needsPermissionGate()) {
      mainWindow.hide();
      permissionAcknowledged = false;
      loadRendererInMainWindow();
      ensurePermissionWindow();
    } else {
      permissionAcknowledged = true;
      loadPreviewInMainWindow();
      mainWindow.show();
    }
  });

}

function createPermissionWindow() {
  if (permissionWindow) return;
  permissionWindow = new BrowserWindow({
    width: 640,
    height: 620,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Permissions required',
    backgroundColor: '#0c111d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  });

  permissionWindow.on('close', () => {
    permissionWindow = null;
  });

  permissionWindow.loadFile(path.join(__dirname, 'src', 'permission', 'index.html'));
}

function loadRendererInMainWindow() {
  if (!mainWindow) return;
  if (mainWindowContent === 'renderer') return;
  mainWindowContent = 'renderer';
  mainWindow.loadFile(RENDERER_ENTRY);
}

function loadPreviewInMainWindow() {
  if (!mainWindow) return;
  if (mainWindowContent === 'preview') return;
  mainWindowContent = 'preview';
  mainWindow.loadFile(PREVIEW_ENTRY, { query: { url: PREVIEW_URL } });
}

function ensureMainWindow() {
  if (!mainWindow) {
    createWindow();
  }
  return mainWindow;
}

function showMainWindow() {
  const win = ensureMainWindow();
  if (!win) return;
  win.show();
  win.focus();
}

function needsPermissionGate() {
  if (!trackingState.consentGranted) return true;
  if (isMac && !trackingState.accessibilityGranted) return true;
  return false;
}

function ensurePermissionWindow() {
  if (needsPermissionGate()) {
    createPermissionWindow();
    mainWindow?.hide();
  } else if (permissionWindow) {
    permissionWindow.close();
    permissionWindow = null;
  }
}

function syncPermissionPresentation() {
  if (needsPermissionGate()) {
    permissionAcknowledged = false;
    ensurePermissionWindow();
    if (mainWindow) {
      loadRendererInMainWindow();
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      }
    }
  } else {
    permissionAcknowledged = true;
    if (permissionWindow) {
      permissionWindow.close();
      permissionWindow = null;
    }
    if (mainWindow) {
      loadPreviewInMainWindow();
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  }
}

function createTray() {
  const trayIcon = getTrayIcon() || nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAALElEQVR42mNgGAWjYBSMglEwCkbBqBhGoyCYwYgYhkZgGkQzAigYBoNRAAAD/ocGAD5jJrQAAAAASUVORK5CYII=');
  tray = new Tray(trayIcon);
  tray.setToolTip(APP_NAME);
  tray.on('click', () => {
    const win = ensureMainWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const statusValue = trackingState.status === 'active' ? 'Active' : trackingState.status === 'idle' ? 'Idle' : trackingState.status;
  const traySignature = [
    trackingState.userEnabled,
    trackingState.consentGranted,
    trackingState.hookAvailable,
    trackingState.linuxWayland,
    statusValue
  ].join('|');

  if (stateCache.traySignature === traySignature) {
    return;
  }

  stateCache.traySignature = traySignature;
  const contextMenu = Menu.buildFromTemplate([
    { label: `${APP_NAME} — ${statusValue}`, enabled: false },
    { type: 'separator' },
    {
      label: trackingState.userEnabled ? 'Pause Tracking' : 'Resume Tracking',
      enabled: trackingState.consentGranted && trackingState.hookAvailable && !trackingState.linuxWayland,
      click: () => toggleTracking(!trackingState.userEnabled)
    },
    {
      label: 'Open Window',
      click: () => {
        showMainWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopHooks();
        tray?.destroy();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function ensureHooksInitialized() {
  if (!hookAvailable || hookInitialized || !uiohook) return;
  uiohook.on('mousemove', (event) => {
    const now = Date.now();
    if (now - lastMouseEmit < MOUSE_THROTTLE_MS) {
      return;
    }
    lastMouseEmit = now;
    handleActivityEvent({ type: 'mouse', position: { x: event.x, y: event.y } });
  });

  uiohook.on('keydown', () => {
    handleActivityEvent({ type: 'keyboard' });
  });

  const mouseButtonHandler = () => {
    handleActivityEvent({ type: 'mouse' });
  };

  uiohook.on('mousedown', mouseButtonHandler);
  uiohook.on('mouseup', mouseButtonHandler);

  hookInitialized = true;
}

function startHooks() {
  if (!hookAvailable || trackingState.hooksRunning) return;
  ensureHooksInitialized();
  try {
    uiohook.start();
    trackingState.hooksRunning = true;
    trackingState.error = null;
  } catch (error) {
    trackingState.hookAvailable = false;
    trackingState.hooksRunning = false;
    trackingState.error = error.message;
    console.error('[uiohook-napi] Unable to start hooks', error);
  }
}

function stopHooks() {
  if (!hookAvailable || !trackingState.hooksRunning) return;
  try {
    uiohook.stop();
  } catch (error) {
    console.error('[uiohook-napi] Failed to stop cleanly', error);
  }
  trackingState.hooksRunning = false;
}

function handleActivityEvent(meta = {}) {
  if (!trackingState.hooksRunning) return;
  const now = Date.now();
  trackingState.lastActivityTs = now;
  trackingState.idleSeconds = 0;
  trackingState.status = 'active';
  broadcastState(meta);
}

function buildTrackingSnapshot() {
  return {
    consentGranted: trackingState.consentGranted,
    userEnabled: trackingState.userEnabled,
    hooksRunning: trackingState.hooksRunning,
    hookAvailable: trackingState.hookAvailable,
    linuxWayland: trackingState.linuxWayland,
    accessibilityGranted: trackingState.accessibilityGranted,
    accessibilityPrompted: trackingState.accessibilityPrompted,
    status: trackingState.status,
    lastActivityTs: trackingState.lastActivityTs,
    idleSeconds: trackingState.idleSeconds,
    reason: trackingState.reason,
    error: trackingState.error
  };
}

function broadcastState(extra = {}) {
  const payload = buildTrackingSnapshot();

  const hasExtra = extra && Object.keys(extra).length > 0;
  const baseSignature = JSON.stringify(payload);
  if (!hasExtra && stateCache.broadcastSignature === baseSignature) {
    return;
  }

  stateCache.broadcastSignature = baseSignature;
  const message = { ...payload, extra };

  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('activity:update', message);
  });

  refreshTrayMenu();
  syncPermissionPresentation();
}

function computeIdleState() {
  if (!trackingState.lastActivityTs) {
    trackingState.idleSeconds = 0;
    trackingState.status = trackingState.hooksRunning ? 'idle' : 'paused';
    return;
  }
  const diff = Math.floor((Date.now() - trackingState.lastActivityTs) / 1000);
  trackingState.idleSeconds = diff;
  trackingState.status = diff >= IDLE_THRESHOLD_SECONDS ? 'idle' : 'active';
}

function idleLoop() {
  computeIdleState();
  broadcastState();
}

function toggleTracking(enable) {
  trackingState.userEnabled = enable;
  saveStateToSettings();
  evaluateTrackingPipeline();
}

function evaluateTrackingPipeline() {
  if (trackingState.linuxWayland) {
    return haltTracking('wayland_not_supported');
  }

  if (!trackingState.hookAvailable) {
    return haltTracking('hooks_unavailable');
  }

  if (!trackingState.consentGranted) {
    return haltTracking('consent_required');
  }

  if (!trackingState.userEnabled) {
    return haltTracking('paused_by_user');
  }

  if (isMac) {
    trackingState.accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!trackingState.accessibilityGranted) {
      if (!trackingState.accessibilityPrompted) {
        trackingState.accessibilityPrompted = true;
        try {
          systemPreferences.isTrustedAccessibilityClient(true);
        } catch (error) {
          console.error('[accessibility] Prompt failed', error);
        }
      }
      return haltTracking('accessibility_required');
    }
  }

  if (!trackingState.hooksRunning) {
    startHooks();
  }

  trackingState.reason = null;
  broadcastState();
}

function haltTracking(reason) {
  trackingState.reason = reason;
  stopHooks();
  trackingState.status = 'paused';
  return broadcastState();
}

function setupIpcHandlers() {
  ipcMain.handle('activity:get-state', () => ({
    ...buildTrackingSnapshot()
  }));

  ipcMain.handle('activity:toggle', (_event, enable) => {
    toggleTracking(enable);
    return { success: true };
  });

  ipcMain.handle('consent:update', (_event, granted) => {
    trackingState.consentGranted = Boolean(granted);
    saveStateToSettings();
    evaluateTrackingPipeline();
    return { consentGranted: trackingState.consentGranted };
  });

  ipcMain.handle('permissions:request-accessibility', () => {
    if (!isMac) {
      return { granted: true };
    }
    trackingState.accessibilityPrompted = true;
    const granted = systemPreferences.isTrustedAccessibilityClient(true);
    trackingState.accessibilityGranted = granted;
    evaluateTrackingPipeline();
    return { granted };
  });

  ipcMain.handle('app:show-window', () => {
    showMainWindow();
  });

  ipcMain.handle('help:open-accessibility-settings', () => {
    if (isMac) {
      openMacAccessibilitySettings();
      return { opened: true };
    }
    return { opened: false };
  });
}

function bootstrap() {
  app.setName(APP_NAME);
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_NAME);
  }

  configureApplicationMenu();

  loadSettingsIntoState();
  createWindow();
  createTray();
  setupIpcHandlers();
  evaluateTrackingPipeline();
  setInterval(idleLoop, 1000);
}

app.whenReady().then(() => {
  if (trackingState.hookAvailable && isLinux && !isWayland) {
    process.env.XKB_DEFAULT_RULES ||= 'evdev';
  }

  app.on('browser-window-created', (_event, window) => {
    if (typeof window.setMenuBarVisibility === 'function') {
      window.setMenuBarVisibility(false);
    }
    if (typeof window.setMenu === 'function') {
      window.setMenu(null);
    }
  });

  bootstrap();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopHooks();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
