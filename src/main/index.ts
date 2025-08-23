import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './db/client';
import { registerIpcHandlers } from './ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../../public/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize database
  await initializeDatabase();
  
  // Register IPC handlers
  registerIpcHandlers();
  
  // Create window
  await createWindow();

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
  closeDatabase();
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault();
  });
  
  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});

// Handle protocol for deep linking (optional)
app.setAsDefaultProtocolClient('video-downloader');