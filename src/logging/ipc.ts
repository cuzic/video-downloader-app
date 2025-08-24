/**
 * IPC handlers for renderer process logging
 * Allows renderer to send logs to main process
 */
import { ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import type { LogMessage } from '@/shared/types';
import { withContext } from './context';
import { logInfo, logWarn, logError, logDebug } from './logger';

/**
 * Setup IPC handlers for logging from renderer process
 */
export function setupLoggingIPC(): void {
  // Info level logging
  ipcMain.on('log:info', (_event: IpcMainEvent, payload: LogMessage) => {
    const fn = () => logInfo(payload.msg, payload.meta);
    if (payload.cid) {
      withContext(fn, { cid: payload.cid });
    } else {
      withContext(fn);
    }
  });

  // Warning level logging
  ipcMain.on('log:warn', (_event: IpcMainEvent, payload: LogMessage) => {
    const fn = () => logWarn(payload.msg, payload.meta);
    if (payload.cid) {
      withContext(fn, { cid: payload.cid });
    } else {
      withContext(fn);
    }
  });

  // Error level logging
  ipcMain.on('log:error', (_event: IpcMainEvent, payload: LogMessage) => {
    const fn = () => logError(payload.msg, undefined, payload.meta);
    if (payload.cid) {
      withContext(fn, { cid: payload.cid });
    } else {
      withContext(fn);
    }
  });

  // Debug level logging
  ipcMain.on('log:debug', (_event: IpcMainEvent, payload: LogMessage) => {
    const fn = () => logDebug(payload.msg, payload.meta);
    if (payload.cid) {
      withContext(fn, { cid: payload.cid });
    } else {
      withContext(fn);
    }
  });
}

/**
 * Cleanup IPC handlers
 */
export function cleanupLoggingIPC(): void {
  ipcMain.removeAllListeners('log:info');
  ipcMain.removeAllListeners('log:warn');
  ipcMain.removeAllListeners('log:error');
  ipcMain.removeAllListeners('log:debug');
}
