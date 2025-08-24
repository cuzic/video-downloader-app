import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  App,
  BrowserWindow,
  Dialog,
  IpcMain,
  IpcRenderer,
  Shell,
  Clipboard,
  WebContents,
} from 'electron';

/**
 * Creates comprehensive Electron app mocks
 */
export function createAppMocks(): Partial<App> {
  return {
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    getVersion: vi.fn(() => '1.0.0-test'),
    getName: vi.fn(() => 'video-downloader-test'),
    isReady: vi.fn(() => true),
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    isPackaged: false,
    requestSingleInstanceLock: vi.fn(() => true),
    releaseSingleInstanceLock: vi.fn(),
    getLocale: vi.fn(() => 'en-US'),
    getSystemLocale: vi.fn(() => 'en-US'),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    setAsDefaultProtocolClient: vi.fn(() => true),
    removeAsDefaultProtocolClient: vi.fn(() => true),
    isDefaultProtocolClient: vi.fn(() => false),
    getAppPath: vi.fn(() => '/mock/app/path'),
    setPath: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({
      openAtLogin: false,
      openAsHidden: false,
      wasOpenedAtLogin: false,
      wasOpenedAsHidden: false,
      restoreState: false,
    })),
    setLoginItemSettings: vi.fn(),
  };
}

/**
 * Creates comprehensive Dialog mocks
 */
export function createDialogMocks(): Partial<Dialog> {
  return {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn().mockResolvedValue({ response: 0, checkboxChecked: false }),
    showMessageBoxSync: vi.fn(() => 0),
    showOpenDialog: vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/mock/file/path'],
    }),
    showOpenDialogSync: vi.fn(() => ['/mock/file/path']),
    showSaveDialog: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/mock/save/path',
    }),
    showSaveDialogSync: vi.fn(() => '/mock/save/path'),
    showCertificateTrustDialog: vi.fn(),
  };
}

/**
 * Creates comprehensive IpcMain mocks
 */
export function createIpcMainMocks(): Partial<IpcMain> {
  const handlers = new Map<string, Mock>();
  const listeners = new Map<string, Mock[]>();

  return {
    handle: vi.fn((channel: string, handler: Mock) => {
      handlers.set(channel, handler);
    }),
    handleOnce: vi.fn((channel: string, handler: Mock) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    on: vi.fn((channel: string, listener: Mock) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, []);
      }
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        channelListeners.push(listener);
      }
      return this as IpcMain;
    }),
    once: vi.fn((channel: string, listener: Mock) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, []);
      }
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        channelListeners.push(listener);
      }
      return this as IpcMain;
    }),
    removeListener: vi.fn((channel: string, listener: Mock) => {
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        const index = channelListeners.indexOf(listener);
        if (index !== -1) {
          channelListeners.splice(index, 1);
        }
      }
      return this as IpcMain;
    }),
    removeAllListeners: vi.fn((channel?: string) => {
      if (channel) {
        listeners.delete(channel);
      } else {
        listeners.clear();
      }
      return this as IpcMain;
    }),
    // Expose for testing
    __handlers: handlers,
    __listeners: listeners,
  } as Partial<IpcMain> & { __handlers: Map<string, Mock>; __listeners: Map<string, Mock[]> };
}

/**
 * Creates comprehensive IpcRenderer mocks
 */
export function createIpcRendererMocks(): Partial<IpcRenderer> {
  return {
    send: vi.fn(),
    sendSync: vi.fn(),
    sendToHost: vi.fn(),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    postMessage: vi.fn(),
  };
}

/**
 * Creates comprehensive BrowserWindow mocks
 */
export function createBrowserWindowMocks(): Partial<BrowserWindow> {
  const webContentsMock = createWebContentsMocks();

  return {
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMinimized: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    setFullScreen: vi.fn(),
    isVisible: vi.fn(() => true),
    isFocused: vi.fn(() => true),
    focus: vi.fn(),
    blur: vi.fn(),
    webContents: webContentsMock as WebContents,
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    setMenu: vi.fn(),
    setTitle: vi.fn(),
    getTitle: vi.fn(() => 'Mock Window'),
    setSize: vi.fn(),
    getSize: vi.fn(() => [800, 600]),
    setPosition: vi.fn(),
    getPosition: vi.fn(() => [0, 0]),
    center: vi.fn(),
    id: 1,
  } as Partial<BrowserWindow>;
}

/**
 * Creates comprehensive WebContents mocks
 */
export function createWebContentsMocks(): Partial<WebContents> {
  return {
    send: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: vi.fn(() => false),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    canGoBack: vi.fn(() => false),
    canGoForward: vi.fn(() => false),
    goBack: vi.fn(),
    goForward: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    getURL: vi.fn(() => 'http://localhost'),
    getTitle: vi.fn(() => 'Mock Page'),
    isLoading: vi.fn(() => false),
    isWaitingForResponse: vi.fn(() => false),
    stop: vi.fn(),
    id: 1,
  } as Partial<WebContents>;
}

/**
 * Creates comprehensive Shell mocks
 */
export function createShellMocks(): Partial<Shell> {
  return {
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(''),
    showItemInFolder: vi.fn(),
    moveItemToTrash: vi.fn().mockResolvedValue(true),
    beep: vi.fn(),
    writeShortcutLink: vi.fn(() => true),
    readShortcutLink: vi.fn(() => ({
      target: '/mock/target',
      args: '',
      appUserModelId: '',
      description: '',
      icon: '',
      iconIndex: 0,
      workingDirectory: '',
    })),
  };
}

/**
 * Creates comprehensive Clipboard mocks
 */
export function createClipboardMocks(): Partial<Clipboard> {
  let text = '';
  let html = '';

  return {
    readText: vi.fn(() => text),
    writeText: vi.fn((newText: string) => {
      text = newText;
    }),
    readHTML: vi.fn(() => html),
    writeHTML: vi.fn((newHtml: string) => {
      html = newHtml;
    }),
    clear: vi.fn(() => {
      text = '';
      html = '';
    }),
    availableFormats: vi.fn(() => []),
    has: vi.fn(() => false),
    read: vi.fn(() => ''),
    write: vi.fn(),
  };
}

/**
 * Creates all Electron mocks at once
 */
export function createElectronMocks(): ReturnType<typeof mockElectron> {
  return {
    app: createAppMocks(),
    dialog: createDialogMocks(),
    ipcMain: createIpcMainMocks(),
    ipcRenderer: createIpcRendererMocks(),
    BrowserWindow: vi.fn().mockImplementation(() => createBrowserWindowMocks()),
    shell: createShellMocks(),
    clipboard: createClipboardMocks(),
    Menu: {
      buildFromTemplate: vi.fn(),
      setApplicationMenu: vi.fn(),
      getApplicationMenu: vi.fn(),
    },
    MenuItem: vi.fn(),
    Tray: vi.fn(),
    Notification: {
      isSupported: vi.fn(() => true),
    },
    nativeImage: {
      createFromPath: vi.fn(),
      createFromBuffer: vi.fn(),
      createEmpty: vi.fn(),
    },
    session: {
      defaultSession: {
        clearCache: vi.fn().mockResolvedValue(undefined),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        getCacheSize: vi.fn().mockResolvedValue(0),
      },
    },
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
      registerFileProtocol: vi.fn(),
      unregisterProtocol: vi.fn(),
    },
  };
}

/**
 * Helper to mock Electron in tests
 */
export function mockElectron(): ReturnType<typeof createElectronMocks> {
  const mocks = createElectronMocks();

  vi.mock('electron', () => mocks);

  return mocks;
}
