import { vi } from 'vitest';

export const app = {
  getPath: vi.fn((name: string) => `/mock/path/${name}`),
  getVersion: vi.fn(() => '1.0.0-test'),
  getLocale: vi.fn(() => 'en-US'),
  getName: vi.fn(() => 'video-downloader'),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
};

export const BrowserWindow = Object.assign(
  vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    once: vi.fn(),
    close: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(() => true),
  })),
  {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => null),
  }
);

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn(),
  removeAllListeners: vi.fn(),
};

export const shell = {
  openPath: vi.fn(() => Promise.resolve('')),
  showItemInFolder: vi.fn(),
  openExternal: vi.fn(() => Promise.resolve()),
  trashItem: vi.fn(() => Promise.resolve()),
};

export const dialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/mock/selected/path'] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '/mock/save/path' })),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  showErrorBox: vi.fn(),
};

export const net = {
  request: vi.fn(() => ({
    on: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    abort: vi.fn(),
  })),
};

export const session = {
  defaultSession: {
    webRequest: {
      onBeforeRequest: vi.fn(),
      onBeforeSendHeaders: vi.fn(),
      onHeadersReceived: vi.fn(),
    },
    setPermissionRequestHandler: vi.fn(),
    protocol: {
      registerFileProtocol: vi.fn(),
      unregisterProtocol: vi.fn(),
    },
  },
};

export const IpcMainInvokeEvent = vi.fn();

export default {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  net,
  session,
  IpcMainInvokeEvent,
};