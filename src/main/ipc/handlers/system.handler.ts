import type { IpcMainInvokeEvent} from 'electron';
import { app, shell, dialog, BrowserWindow } from 'electron';
import { existsSync, statSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { SYSTEM_CHANNELS } from '@/shared/constants/channels';
import { wrapHandler, validateRequired, validationError } from '../utils/error-handler';
import type { SystemInfoResponse, SystemPathsResponse } from '@/shared/types/ipc.types';

export const systemHandlers = [
  {
    channel: SYSTEM_CHANNELS.GET_PATH,
    handler: wrapHandler((_event: IpcMainInvokeEvent, name: 'home' | 'downloads' | 'documents' | 'videos'): string => {
      validateRequired({ name }, ['name']);
      
      switch (name) {
        case 'home':
          return app.getPath('home');
        case 'downloads':
          return app.getPath('downloads');
        case 'documents':
          return app.getPath('documents');
        case 'videos':
          return app.getPath('videos');
        default:
          throw validationError(`Invalid path name: ${name}`);
      }
    }),
  },
  {
    channel: SYSTEM_CHANNELS.GET_PATHS,
    handler: wrapHandler((_event: IpcMainInvokeEvent): SystemPathsResponse => {
      return {
        home: app.getPath('home'),
        downloads: app.getPath('downloads'),
        userData: app.getPath('userData'),
        temp: app.getPath('temp'),
      };
    }),
  },
  {
    channel: SYSTEM_CHANNELS.OPEN_PATH,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      validateRequired({ filePath }, ['filePath']);
      
      // Validate path exists
      if (!existsSync(filePath)) {
        throw validationError(`Path does not exist: ${filePath}`);
      }
      
      // Open the file/folder with default system handler
      await shell.openPath(filePath);
    }),
  },
  {
    channel: SYSTEM_CHANNELS.SHOW_ITEM_IN_FOLDER,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      validateRequired({ filePath }, ['filePath']);
      
      // Validate path exists
      if (!existsSync(filePath)) {
        throw validationError(`Path does not exist: ${filePath}`);
      }
      
      // Show the item in system file manager
      shell.showItemInFolder(filePath);
    }),
  },
  {
    channel: SYSTEM_CHANNELS.OPEN_EXTERNAL,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, url: string): Promise<void> => {
      validateRequired({ url }, ['url']);
      
      // Validate URL format
      try {
        const parsedUrl = new URL(url);
        // Only allow http(s) and mailto protocols
        if (!['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        throw validationError(`Invalid URL: ${url}`);
      }
      
      // Open URL in default browser
      await shell.openExternal(url);
    }),
  },
  {
    channel: SYSTEM_CHANNELS.GET_VERSION,
    handler: wrapHandler((_event: IpcMainInvokeEvent): string => {
      return app.getVersion();
    }),
  },
  {
    channel: SYSTEM_CHANNELS.GET_INFO,
    handler: wrapHandler((_event: IpcMainInvokeEvent): SystemInfoResponse => {
      return {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        locale: app.getLocale(),
      };
    }),
  },
  {
    channel: SYSTEM_CHANNELS.CHECK_FILE_EXISTS,
    handler: wrapHandler((_event: IpcMainInvokeEvent, filePath: string): boolean => {
      validateRequired({ filePath }, ['filePath']);
      
      // Ensure absolute path
      const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);
      
      try {
        return existsSync(absolutePath);
      } catch {
        return false;
      }
    }),
  },
  {
    channel: SYSTEM_CHANNELS.SELECT_DIRECTORY,
    handler: wrapHandler(async (event: IpcMainInvokeEvent, options?: { defaultPath?: string; title?: string }): Promise<string | null> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error('No browser window found');
      }
      
      const result = await dialog.showOpenDialog(browserWindow, {
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: options?.defaultPath,
        title: options?.title || 'Select Directory',
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      
      return result.filePaths[0] || null;
    }),
  },
  {
    channel: SYSTEM_CHANNELS.SELECT_FILE,
    handler: wrapHandler(async (event: IpcMainInvokeEvent, options?: { 
      defaultPath?: string; 
      title?: string; 
      filters?: Array<{ name: string; extensions: string[] }>;
      multiSelections?: boolean;
    }): Promise<string | string[] | null> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error('No browser window found');
      }
      
      const properties: Array<'openFile' | 'multiSelections'> = ['openFile'];
      if (options?.multiSelections) {
        properties.push('multiSelections');
      }
      
      const result = await dialog.showOpenDialog(browserWindow, {
        properties,
        defaultPath: options?.defaultPath,
        title: options?.title || 'Select File',
        filters: options?.filters || [],
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      
      return options?.multiSelections ? result.filePaths : (result.filePaths[0] || null);
    }),
  },
  {
    channel: SYSTEM_CHANNELS.GET_FILE_INFO,
    handler: wrapHandler((_event: IpcMainInvokeEvent, filePath: string): {
      exists: boolean;
      size?: number;
      isDirectory?: boolean;
      isFile?: boolean;
      createdAt?: string;
      modifiedAt?: string;
    } => {
      validateRequired({ filePath }, ['filePath']);
      
      // Ensure absolute path
      const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);
      
      if (!existsSync(absolutePath)) {
        return { exists: false };
      }
      
      try {
        const stats = statSync(absolutePath);
        return {
          exists: true,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        };
      } catch {
        return { exists: false };
      }
    }),
  },
  {
    channel: SYSTEM_CHANNELS.TRASH_ITEM,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      validateRequired({ filePath }, ['filePath']);
      
      // Validate path exists
      if (!existsSync(filePath)) {
        throw validationError(`Path does not exist: ${filePath}`);
      }
      
      // Move to trash
      await shell.trashItem(filePath);
    }),
  },
];