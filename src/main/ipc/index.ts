import { ipcMain } from 'electron';
import { downloadHandlers } from './handlers/download.handler';
import { settingsHandlers } from './handlers/settings.handler';
import { systemHandlers } from './handlers/system.handler';

export function registerIpcHandlers(): void {
  // Download handlers
  downloadHandlers.forEach(({ channel, handler }) => {
    ipcMain.handle(channel, handler);
  });
  
  // Settings handlers
  settingsHandlers.forEach(({ channel, handler }) => {
    ipcMain.handle(channel, handler);
  });
  
  // System handlers
  systemHandlers.forEach(({ channel, handler }) => {
    ipcMain.handle(channel, handler);
  });
  
  console.log('IPC handlers registered');
}