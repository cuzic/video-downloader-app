import { IpcMainInvokeEvent, app, shell } from 'electron';
import fs from 'fs/promises';

export const systemHandlers = [
  {
    channel: 'app:system:getPath',
    handler: async (_event: IpcMainInvokeEvent, name: 'home' | 'downloads' | 'documents' | 'videos'): Promise<string> => {
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
          throw new Error(`Invalid path name: ${name}`);
      }
    },
  },
  {
    channel: 'app:system:openPath',
    handler: async (_event: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      await shell.openPath(filePath);
    },
  },
  {
    channel: 'app:system:showItemInFolder',
    handler: async (_event: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      shell.showItemInFolder(filePath);
    },
  },
  {
    channel: 'app:system:openExternal',
    handler: async (_event: IpcMainInvokeEvent, url: string): Promise<void> => {
      // Validate URL
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(url);
      }
    },
  },
  {
    channel: 'app:system:getVersion',
    handler: async (_event: IpcMainInvokeEvent): Promise<string> => {
      return app.getVersion();
    },
  },
  {
    channel: 'app:system:checkFileExists',
    handler: async (_event: IpcMainInvokeEvent, filePath: string): Promise<boolean> => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
  },
];