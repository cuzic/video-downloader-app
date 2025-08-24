import type { IpcMainInvokeEvent } from 'electron';
import type { AppSettings } from '@/shared/types';
import { SETTINGS_CHANNELS } from '@/shared/constants/channels';
import { wrapHandler, validateRequired } from '../utils/error-handler';
import { broadcast } from '../utils/performance';
import { RepositoryFactory } from '../../db/repositories';
import type { SettingsRepository } from '../../db/repositories/settings.repository';

// Lazy initialization to avoid issues during testing
let settingsRepo: SettingsRepository | null = null;

function getSettingsRepo(): SettingsRepository {
  if (!settingsRepo) {
    settingsRepo = RepositoryFactory.createSettingsRepository();
  }
  return settingsRepo;
}

export const settingsHandlers = [
  {
    channel: SETTINGS_CHANNELS.GET,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, key: string): Promise<any> => {
      validateRequired({ key }, ['key']);
      const setting = await getSettingsRepo().get(key);
      return setting?.value;
    }),
  },
  {
    channel: SETTINGS_CHANNELS.SET,
    handler: wrapHandler(
      async (_event: IpcMainInvokeEvent, key: string, value: any): Promise<void> => {
        validateRequired({ key }, ['key']);
        await getSettingsRepo().set(key, value);

        // Broadcast change to all windows
        broadcast(SETTINGS_CHANNELS.ON_CHANGED, { key, value });
      }
    ),
  },
  {
    channel: SETTINGS_CHANNELS.GET_ALL,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<Partial<AppSettings>> => {
      const settings = await getSettingsRepo().getAll();
      // getAll() returns Record<string, any>, so we just need to cast it
      return settings as Partial<AppSettings>;
    }),
  },
  {
    channel: 'app:settings:initialize',
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<void> => {
      // Initialize default settings if not present
      const defaults: Partial<AppSettings> = {
        downloadDirectory: '',
        maxConcurrentDownloads: 3,
        autoStartDownload: false,
        notificationEnabled: true,
        ffmpegPath: 'ffmpeg',
        theme: 'system',
        language: 'en',
        downloadQualityPreference: 'highest',
        duplicateAction: 'skip',
      };

      for (const [key, value] of Object.entries(defaults)) {
        const existing = await getSettingsRepo().get(key);
        if (!existing) {
          await getSettingsRepo().set(key, value);
        }
      }
    }),
  },
  {
    channel: SETTINGS_CHANNELS.RESET,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent): Promise<void> => {
      // Reset all settings to defaults
      // Clear all settings
      const allSettings = await getSettingsRepo().getAll();
      for (const key of Object.keys(allSettings)) {
        await getSettingsRepo().set(key, null);
      }

      // Reinitialize with defaults
      const initHandler = settingsHandlers.find((h) => h.channel === 'app:settings:initialize');
      if (initHandler) {
        await initHandler.handler(_event, undefined as any, undefined as any);
      }

      // Broadcast reset event
      broadcast(SETTINGS_CHANNELS.ON_CHANGED, { key: 'all', value: null });
    }),
  },
];
