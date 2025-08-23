import { IpcMainInvokeEvent } from 'electron';
import { SettingsRepository } from '../../db/repositories/settings.repository';
import type { AppSettings } from '@/shared/types';
import { SETTINGS_CHANNELS } from '@/shared/constants/channels';
import { wrapHandler, validateRequired } from '../utils/error-handler';
import { broadcast } from '../utils/performance';
import { RepositoryFactory } from '../../db/repositories';

const settingsRepo = RepositoryFactory.createSettingsRepository();

export const settingsHandlers = [
  {
    channel: SETTINGS_CHANNELS.GET,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, key: string): Promise<any> => {
      validateRequired({ key }, ['key']);
      const setting = await settingsRepo.get(key);
      return setting?.value;
    }),
  },
  {
    channel: SETTINGS_CHANNELS.SET,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, key: string, value: any): Promise<void> => {
      validateRequired({ key }, ['key']);
      await settingsRepo.set(key, value);
      
      // Broadcast change to all windows
      broadcast(SETTINGS_CHANNELS.ON_CHANGED, { key, value });
    }),
  },
  {
    channel: SETTINGS_CHANNELS.GET_ALL,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<Partial<AppSettings>> => {
      const settings = await settingsRepo.getAll();
      const result: Partial<AppSettings> = {};
      
      settings.forEach(setting => {
        result[setting.key as keyof AppSettings] = setting.value;
      });
      
      return result;
    }),
  },
  {
    channel: SETTINGS_CHANNELS.INITIALIZE,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<void> => {
      // Initialize default settings if not present
      const defaults: Partial<AppSettings> = {
        downloadPath: '',
        maxConcurrentDownloads: 3,
        autoStart: false,
        notifications: true,
        theme: 'system',
        language: 'en',
        windowState: {
          width: 1200,
          height: 800,
          x: undefined,
          y: undefined,
        },
      };
      
      for (const [key, value] of Object.entries(defaults)) {
        const existing = await settingsRepo.get(key);
        if (!existing) {
          await settingsRepo.set(key, value);
        }
      }
    }),
  },
  {
    channel: SETTINGS_CHANNELS.RESET,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<void> => {
      // Reset all settings to defaults
      await settingsRepo.clear();
      
      // Reinitialize with defaults
      const initHandler = settingsHandlers.find(h => h.channel === SETTINGS_CHANNELS.INITIALIZE);
      if (initHandler) {
        await initHandler.handler(_event);
      }
      
      // Broadcast reset event
      broadcast(SETTINGS_CHANNELS.ON_RESET, {});
    }),
  },
];