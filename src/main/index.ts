import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import 'dotenv/config';
import { initDatabase, shutdownDatabase } from './db/init';
import { registerIpcHandlers } from './ipc';
import { applyCSP } from './security/csp';
import { PathValidator } from './security/path-validator';
import { DRMDetector } from './security/drm-detector';
import { LegalConsentManager } from './security/legal-consent';
import { SecretsMigration } from './services/secrets-migration';
import { setupLoggingIPC, setupExceptionHandlers, logStartup, logShutdown } from '../logging';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window with comprehensive security flags
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      webviewTag: false,
      navigateOnDragDrop: false,
      autoplayPolicy: 'user-gesture-required',
      disableDialogs: false,
      safeDialogs: true,
      safeDialogsMessage: 'Electron Security Warning',
      disableHtmlFullscreenWindowResize: true,
    },
    icon: path.join(__dirname, '../../public/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// Setup logging and exception handlers early
setupExceptionHandlers();
setupLoggingIPC();

// This method will be called when Electron has finished initialization
void app.whenReady().then(async () => {
  // Log application startup
  logStartup(app.getVersion(), {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    electron: process.versions.electron,
  });

  // Apply Content Security Policy
  applyCSP();

  // Initialize path validator
  PathValidator.initialize();

  // Check for legal consent on first launch
  const hasConsent = await LegalConsentManager.checkAndPromptConsent();
  if (!hasConsent) {
    logShutdown('User declined legal consent');
    app.quit();
    return;
  }

  // Initialize database system
  await initDatabase();

  // Auto-migrate secrets from electron-store to keytar
  await SecretsMigration.autoMigrate();

  // Register IPC handlers
  registerIpcHandlers();

  // Create window
  createWindow();

  // Apply DRM detection to main window
  if (mainWindow) {
    DRMDetector.injectDRMDetectionScript(mainWindow);
  }

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quitting
app.on('before-quit', () => {
  logShutdown('Application quit requested');
  void shutdownDatabase();
});

// Security: Prevent new window creation and enhance security
app.on('web-contents-created', (_, contents) => {
  // Prevent webview creation
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Use setWindowOpenHandler instead of deprecated 'new-window' event
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedOrigins =
      process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : ['file://'];

    const isAllowed = allowedOrigins.some((origin) => {
      if (origin === 'file://') {
        return parsedUrl.protocol === 'file:';
      }
      return parsedUrl.origin === origin;
    });

    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Handle permission requests
  contents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Deny all permission requests by default
    const deniedPermissions = [
      'media',
      'geolocation',
      'notifications',
      'midiSysex',
      'pointerLock',
      'fullscreen',
      'openExternal',
      'hid',
      'serial',
      'usb',
    ];

    if (deniedPermissions.includes(permission)) {
      callback(false);
    } else {
      // Allow clipboard operations
      callback(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
    }
  });
});

// Handle protocol for deep linking (optional)
app.setAsDefaultProtocolClient('video-downloader');
