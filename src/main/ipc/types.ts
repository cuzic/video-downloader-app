import type { IpcMainInvokeEvent } from 'electron';

/**
 * Generic IPC handler function type
 * Using any[] for args is intentional to allow flexible handler signatures
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IpcHandler<TArgs extends any[] = any[], TReturn = any> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TReturn> | TReturn;

/**
 * IPC handler definition with channel and handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IpcHandlerDefinition<TArgs extends any[] = any[], TReturn = any> {
  channel: string;
  handler: IpcHandler<TArgs, TReturn>;
}

/**
 * Typed handler for download operations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DownloadHandler<T = any, R = any> = IpcHandler<[T], R>;

/**
 * Typed handler for settings operations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsHandler<T = any, R = any> = IpcHandler<T extends undefined ? [] : [T], R>;

/**
 * Typed handler for system operations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SystemHandler<T = any, R = any> = IpcHandler<T extends undefined ? [] : [T], R>;
