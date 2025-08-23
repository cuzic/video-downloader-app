import { IpcMainInvokeEvent } from 'electron';
import { SettingsRepository } from '../../db/repositories/settings.repository';
import type { AppSettings } from '@/shared/types';

const settingsRepo = new SettingsRepository();

export const settingsHandlers = [
  {
    channel: 'app:settings:get',
    handler: async (_event: IpcMainInvokeEvent, key: string): Promise<any> => {
      return await settingsRepo.get(key);
    },
  },
  {
    channel: 'app:settings:set',
    handler: async (_event: IpcMainInvokeEvent, key: string, value: any): Promise<void> => {
      await settingsRepo.set(key, value);
    },
  },
  {
    channel: 'app:settings:getAll',
    handler: async (_event: IpcMainInvokeEvent): Promise<Partial<AppSettings>> => {
      return await settingsRepo.getAppSettings();
    },
  },
  {
    channel: 'app:settings:initialize',
    handler: async (_event: IpcMainInvokeEvent): Promise<void> => {
      await settingsRepo.initializeDefaults();
    },
  },
];