import { app } from 'electron';
import { db } from '../client';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';
import type { AppSettings } from '@/shared/types';

export class SettingsRepository {
  async get<T = any>(key: string): Promise<T | null> {
    const result = await db.select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    
    if (!result[0]) return null;
    
    try {
      return JSON.parse(result[0].value) as T;
    } catch {
      return result[0].value as T;
    }
  }

  async set<T = any>(key: string, value: T, description?: string): Promise<void> {
    const type = Array.isArray(value) ? 'array'
      : value === null ? 'null'
      : typeof value;
    
    const jsonValue = JSON.stringify(value);
    
    await db.insert(settings)
      .values({
        key,
        value: jsonValue,
        type: type as any,
        description,
        updatedAt: new Date(),
        updatedBy: 'user',
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: jsonValue,
          type: type as any,
          updatedAt: new Date(),
          updatedBy: 'user',
        },
      });
  }

  async getAll(): Promise<Record<string, any>> {
    const rows = await db.select().from(settings);
    
    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    
    return result;
  }

  async getAppSettings(): Promise<Partial<AppSettings>> {
    const all = await this.getAll();
    
    // Map flat key-value pairs to nested AppSettings structure
    const appSettings: Partial<AppSettings> = {};
    
    // Basic settings
    if (all['general.downloadDirectory']) appSettings.downloadDirectory = all['general.downloadDirectory'];
    if (all['general.maxConcurrentDownloads']) appSettings.maxConcurrentDownloads = all['general.maxConcurrentDownloads'];
    if (all['general.autoStartDownload'] !== undefined) appSettings.autoStartDownload = all['general.autoStartDownload'];
    if (all['general.notificationEnabled'] !== undefined) appSettings.notificationEnabled = all['general.notificationEnabled'];
    
    // FFmpeg settings
    if (all['ffmpeg.path']) appSettings.ffmpegPath = all['ffmpeg.path'];
    if (all['ffmpeg.args']) appSettings.ffmpegArgs = all['ffmpeg.args'];
    
    // UI settings
    if (all['ui.theme']) appSettings.theme = all['ui.theme'];
    if (all['ui.language']) appSettings.language = all['ui.language'];
    
    // Add more mappings as needed...
    
    return appSettings;
  }

  async setDefaults(defaults: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.get(key);
      if (existing === null) {
        await this.set(key, value);
      }
    }
  }

  async initializeDefaults(): Promise<void> {
    const defaults = {
      'general.downloadDirectory': app.getPath('downloads'),
      'general.maxConcurrentDownloads': 3,
      'general.autoStartDownload': true,
      'general.notificationEnabled': true,
      
      'ffmpeg.path': 'ffmpeg',
      'ffmpeg.args': [],
      
      'ui.theme': 'system',
      'ui.language': 'en',
      
      'quality.preference': 'highest',
      
      'detection.enabled': true,
      'detection.minFileSize': 1048576,  // 1MB
      'detection.maxFileSize': 10737418240,  // 10GB
      'detection.autoDetect': true,
      
      'retry.downloadMaxAttempts': 3,
      'retry.segmentMaxAttempts': 5,
      'retry.segmentTimeoutMs': 30000,
    };
    
    await this.setDefaults(defaults);
  }
}