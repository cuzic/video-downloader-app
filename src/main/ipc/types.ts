import type { IpcMainInvokeEvent } from 'electron';

/**
 * Generic IPC handler function type
 */
export type IpcHandler<TArgs extends any[] = any[], TReturn = any> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TReturn> | TReturn;

/**
 * IPC handler definition with channel and handler
 */
export interface IpcHandlerDefinition<TArgs extends any[] = any[], TReturn = any> {
  channel: string;
  handler: IpcHandler<TArgs, TReturn>;
}

/**
 * Typed handler for download operations
 */
export type DownloadHandler<T = any, R = any> = IpcHandler<[T], R>;

/**
 * Typed handler for settings operations
 */
export type SettingsHandler<T = any, R = any> = IpcHandler<T extends undefined ? [] : [T], R>;

/**
 * Typed handler for system operations
 */
export type SystemHandler<T = any, R = any> = IpcHandler<T extends undefined ? [] : [T], R>;