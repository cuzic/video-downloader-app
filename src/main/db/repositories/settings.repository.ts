/**
 * DEPRECATED: This is the old SQLite-based settings repository
 * For the new settings system, use src/main/services/settings.service.ts
 *
 * This file is kept for backward compatibility and migration purposes.
 * It will be removed in a future version.
 */
import { app } from 'electron';
import { db } from '../client';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';
import type { AppSettings } from '@/shared/types/settings';

export class SettingsRepository {
  async get<T = any>(key: string): Promise<T | null> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

    if (!result[0]) return null;

    try {
      return JSON.parse(result[0].value) as T;
    } catch {
      return result[0].value as T;
    }
  }

  async set<T = any>(key: string, value: T, description?: string): Promise<void> {
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

    const jsonValue = JSON.stringify(value);

    await db
      .insert(settings)
      .values({
        key,
        value: jsonValue,
        type,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: jsonValue,
          type,
          description: description || null,
          updatedAt: new Date(),
        },
      });
  }

  async delete(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  }

  async getAllSettings(): Promise<AppSettings> {
    // Return default settings structure for backward compatibility
    // The actual settings are now managed by the new settings system
    const defaultSettings: AppSettings = {
      general: {
        downloadDirectory: app.getPath('downloads'),
        maxConcurrentDownloads: 3,
        autoStartDownload: true,
        notificationEnabled: true,
        closeToTray: false,
        startMinimized: false,
      },
      quality: {
        preference: 'highest',
        fallbackQuality: 'next-lower',
        customRules: [],
      },
      network: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 2000,
        headers: {},
      },
      ui: {
        theme: 'system',
        language: 'en',
        windowBounds: {
          width: 1200,
          height: 800,
        },
        showInTray: true,
        minimizeOnClose: false,
      },
      advanced: {
        ffmpegPath: 'ffmpeg',
        ffmpegArgs: [],
        concurrentSegments: 4,
        enableDebugMode: false,
        logLevel: 'info',
        enableTelemetry: true,
        updateChannel: 'stable',
      },
    };

    // Try to get individual settings from DB for migration
    const downloadDir = await this.get<string>('downloadDirectory');
    if (downloadDir) defaultSettings.general.downloadDirectory = downloadDir;

    const maxDownloads = await this.get<number>('maxConcurrentDownloads');
    if (maxDownloads) defaultSettings.general.maxConcurrentDownloads = maxDownloads;

    const autoStart = await this.get<boolean>('autoStartDownload');
    if (autoStart !== null) defaultSettings.general.autoStartDownload = autoStart;

    const notifications = await this.get<boolean>('notificationEnabled');
    if (notifications !== null) defaultSettings.general.notificationEnabled = notifications;

    const ffmpegPath = await this.get<string>('ffmpegPath');
    if (ffmpegPath) defaultSettings.advanced.ffmpegPath = ffmpegPath;

    const ffmpegArgs = await this.get<string[]>('ffmpegArgs');
    if (ffmpegArgs) defaultSettings.advanced.ffmpegArgs = ffmpegArgs;

    const theme = await this.get<'light' | 'dark' | 'system'>('theme');
    if (theme) defaultSettings.ui.theme = theme;

    const language = await this.get<string>('language');
    if (language) defaultSettings.ui.language = language as 'en' | 'ja' | 'zh-CN' | 'ko';

    return defaultSettings;
  }

  async clearAll(): Promise<void> {
    await db.delete(settings);
  }
}
