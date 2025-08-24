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
 * Log function mappings for each level
 */
const logFunctions = {
  info: logInfo,
  warn: logWarn,
  error: (msg: string, meta?: object) => logError(msg, undefined, meta),
  debug: logDebug,
} as const;

/**
 * Setup IPC handlers for logging from renderer process
 */
export function setupLoggingIPC(): void {
  Object.entries(logFunctions).forEach(([level, logFn]) => {
    ipcMain.on(`log:${level}`, (_event: IpcMainEvent, payload: LogMessage) => {
      const fn = () => logFn(payload.msg, payload.meta);
      payload.cid ? withContext(fn, { cid: payload.cid }) : withContext(fn);
    });
  });
}

/**
 * Cleanup IPC handlers
 */
export function cleanupLoggingIPC(): void {
  Object.keys(logFunctions).forEach((level) => ipcMain.removeAllListeners(`log:${level}`));
}
