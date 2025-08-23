import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { downloadHandlers } from './handlers/download.handler';
import { settingsHandlers } from './handlers/settings.handler';
import { systemHandlers } from './handlers/system.handler';
import { setupErrorHandlers } from './utils/error-handler';

/**
 * IPC Handler Manager
 * Centralizes all IPC handler registration and management
 */
export class IpcHandler {
  private mainWindow: BrowserWindow | null = null;
  private registered = false;
  
  constructor() {
    // Setup global error handlers
    setupErrorHandlers();
  }
  
  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }
  
  /**
   * Register all IPC handlers
   */
  register(): void {
    if (this.registered) {
      console.warn('IPC handlers already registered');
      return;
    }
    
    console.log('Registering IPC handlers...');
    
    // Register download handlers
    downloadHandlers.forEach(({ channel, handler }) => {
      ipcMain.handle(channel, this.wrapHandler(channel, handler));
    });
    
    // Register settings handlers
    settingsHandlers.forEach(({ channel, handler }) => {
      ipcMain.handle(channel, this.wrapHandler(channel, handler));
    });
    
    // Register system handlers
    systemHandlers.forEach(({ channel, handler }) => {
      ipcMain.handle(channel, this.wrapHandler(channel, handler));
    });
    
    this.registered = true;
    console.log('IPC handlers registered successfully');
  }
  
  /**
   * Wrap handler with error handling and logging
   */
  private wrapHandler(channel: string, handler: Function) {
    return async (event: IpcMainInvokeEvent, ...args: any[]) => {
      const startTime = Date.now();
      
      try {
        console.log(`IPC [${channel}] invoked with args:`, args);
        const result = await handler(event, ...args);
        const duration = Date.now() - startTime;
        console.log(`IPC [${channel}] completed in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`IPC [${channel}] failed after ${duration}ms:`, error);
        throw error;
      }
    };
  }
  
  /**
   * Unregister all IPC handlers
   */
  unregister(): void {
    if (!this.registered) {
      return;
    }
    
    console.log('Unregistering IPC handlers...');
    
    // Remove all handlers
    [...downloadHandlers, ...settingsHandlers, ...systemHandlers].forEach(({ channel }) => {
      ipcMain.removeHandler(channel);
    });
    
    this.registered = false;
    console.log('IPC handlers unregistered');
  }
  
  /**
   * Get main window
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.unregister();
    this.mainWindow = null;
  }
}

// Create singleton instance
let ipcHandler: IpcHandler | null = null;

/**
 * Register IPC handlers (backward compatibility)
 */
export function registerIpcHandlers(): void {
  if (!ipcHandler) {
    ipcHandler = new IpcHandler();
  }
  ipcHandler.register();
}

/**
 * Initialize IPC handlers with main window
 */
export function initializeIpc(mainWindow: BrowserWindow): IpcHandler {
  if (!ipcHandler) {
    ipcHandler = new IpcHandler();
  }
  
  ipcHandler.setMainWindow(mainWindow);
  ipcHandler.register();
  
  return ipcHandler;
}

/**
 * Get IPC handler instance
 */
export function getIpcHandler(): IpcHandler | null {
  return ipcHandler;
}

/**
 * Cleanup IPC handlers
 */
export function cleanupIpc(): void {
  if (ipcHandler) {
    ipcHandler.cleanup();
    ipcHandler = null;
  }
}