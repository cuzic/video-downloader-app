import { vi } from 'vitest';

// Mock electron module
vi.mock('electron', () => ({
  app: {
    getName: vi.fn(() => 'video-downloader'),
    getVersion: vi.fn(() => '0.1.0'),
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    quit: vi.fn(),
    relaunch: vi.fn(),
    isPackaged: false,
    whenReady: vi.fn(() => Promise.resolve()),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn(() => false),
    setMenu: vi.fn(),
  })),
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Global test utilities
(global as any).testUtils = {
  createMockEvent: () => ({
    sender: {
      send: vi.fn(),
    },
    reply: vi.fn(),
  }),
};