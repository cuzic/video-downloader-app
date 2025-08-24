/**
 * Universal Electron mock that works with both Bun and Vitest
 */
import { createMockFn } from '@/test/mock-utils';

export const app = {
  getPath: createMockFn((name: string) => `/mock/path/${name}`),
  getVersion: createMockFn(() => '1.0.0-test'),
  getLocale: createMockFn(() => 'en-US'),
  getName: createMockFn(() => 'video-downloader'),
  quit: createMockFn(),
  on: createMockFn(),
  once: createMockFn(),
  whenReady: createMockFn(() => Promise.resolve()),
};

export const BrowserWindow = Object.assign(
  createMockFn(() => ({
    loadURL: createMockFn(),
    loadFile: createMockFn(),
    webContents: {
      send: createMockFn(),
      openDevTools: createMockFn(),
    },
    on: createMockFn(),
    once: createMockFn(),
    close: createMockFn(),
    show: createMockFn(),
    hide: createMockFn(),
    isVisible: createMockFn(() => true),
    isDestroyed: createMockFn(() => false),
  })),
  {
    getAllWindows: createMockFn(() => [
      {
        isDestroyed: createMockFn(() => false),
        webContents: {
          send: createMockFn(),
        },
      },
    ]),
    fromWebContents: createMockFn(() => null),
  }
);

export const ipcMain = {
  handle: createMockFn(),
  on: createMockFn(),
  once: createMockFn(),
  removeHandler: createMockFn(),
  removeAllListeners: createMockFn(),
};

export const shell = {
  openPath: createMockFn(() => Promise.resolve('')),
  showItemInFolder: createMockFn(),
  openExternal: createMockFn(() => Promise.resolve()),
  trashItem: createMockFn(() => Promise.resolve()),
};

export const dialog = {
  showOpenDialog: createMockFn(() =>
    Promise.resolve({ canceled: false, filePaths: ['/mock/selected/path'] })
  ),
  showSaveDialog: createMockFn(() =>
    Promise.resolve({ canceled: false, filePath: '/mock/save/path' })
  ),
  showMessageBox: createMockFn(() => Promise.resolve({ response: 0 })),
  showErrorBox: createMockFn(),
};

export const net = {
  request: createMockFn(() => ({
    on: createMockFn(),
    end: createMockFn(),
    write: createMockFn(),
    abort: createMockFn(),
  })),
};

export const session = {
  defaultSession: {
    webRequest: {
      onBeforeRequest: createMockFn(),
      onBeforeSendHeaders: createMockFn(),
      onHeadersReceived: createMockFn(),
    },
    setPermissionRequestHandler: createMockFn(),
    protocol: {
      registerFileProtocol: createMockFn(),
      unregisterProtocol: createMockFn(),
    },
  },
};

export const IpcMainInvokeEvent = createMockFn();
