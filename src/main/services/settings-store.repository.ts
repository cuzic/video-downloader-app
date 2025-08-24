/**
 * Settings Store Repository
 * Manages persistent storage of application settings using electron-store
 * This replaces the SQLite-based settings for better performance and type safety
 */
import Store from 'electron-store';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {
  AppSettingsSchema,
  type AppSettings,
  type SettingSectionKey,
  type SettingsValidationResult,
  validateSettingsSection,
} from '@/shared/types/settings';
import { logger } from '@/logging';

interface StoreSchema {
  settings: AppSettings;
  version: string;
}

export class SettingsStoreRepository {
  private store: Store<StoreSchema>;
  private cache: AppSettings | null = null;
  private readonly version = '1.0.0';

  constructor() {
    // Initialize electron-store with schema and migrations
    this.store = new Store<StoreSchema>({
      name: 'app-settings',
      cwd: app.getPath('userData'),
      clearInvalidConfig: true,
      encryptionKey: this.getEncryptionKey(),
      migrations: this.createMigrations(),
      defaults: {
        settings: AppSettingsSchema.parse({}),
        version: this.version,
      },
    });

    // Validate and repair on initialization
    this.validateAndRepair();
    logger.info('Settings store repository initialized', { version: this.version });
  }

  /**
   * Get encryption key for sensitive settings (if needed)
   */
  private getEncryptionKey(): string | undefined {
    // In production, you might want to derive this from machine ID or user credentials
    // For now, we'll use a simple key
    return process.env.SETTINGS_ENCRYPTION_KEY;
  }

  /**
   * Create migration definitions
   */
  private createMigrations() {
    return {
      '1.0.0': (store: any) => {
        // Initial migration - ensure proper structure
        if (!store.has('settings')) {
          store.set('settings', AppSettingsSchema.parse({}));
        }
        if (!store.has('version')) {
          store.set('version', '1.0.0');
        }
      },
      '1.1.0': (store: any) => {
        // Future migration example
        // Migrate old settings structure to new one
        const oldSettings = store.get('settings', AppSettingsSchema.parse({}));
        const legacySettings = oldSettings as Record<string, unknown>;
        if (legacySettings.maxDownloads !== undefined) {
          store.set(
            'settings.general.maxConcurrentDownloads',
            legacySettings.maxDownloads as number
          );
          // Note: electron-store doesn't have a delete method, use set to undefined instead
          const updatedSettings = { ...oldSettings };
          delete (updatedSettings as Record<string, unknown>).maxDownloads;
          store.set('settings', updatedSettings);
        }
      },
    };
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<AppSettings> {
    // Return from cache if available
    if (this.cache) {
      return this.cache;
    }

    try {
      const settings = this.store.get('settings');
      // Validate retrieved settings
      const validated = AppSettingsSchema.parse(settings);
      this.cache = validated;
      return validated;
    } catch (error) {
      logger.error('Failed to retrieve settings, using defaults', error as Error);
      const defaults = AppSettingsSchema.parse({});
      await this.setAll(defaults);
      return defaults;
    }
  }

  /**
   * Get a specific settings section
   */
  async get<K extends SettingSectionKey>(key: K): Promise<AppSettings[K]> {
    const settings = await this.getAll();
    return settings[key];
  }

  /**
   * Set all settings
   */
  setAll(settings: AppSettings): Promise<void> {
    try {
      // Validate entire settings object
      const validated = AppSettingsSchema.parse(settings);
      this.store.set('settings', validated);
      this.cache = validated;
      logger.info('All settings updated');
      return Promise.resolve();
    } catch (error) {
      logger.error('Failed to update all settings', error as Error);
      throw new Error(`Invalid settings: ${(error as Error).message}`);
    }
  }

  /**
   * Set a specific settings section
   */
  async set<K extends SettingSectionKey>(key: K, value: AppSettings[K]): Promise<void> {
    try {
      // Validate the specific section
      const validation = validateSettingsSection(key, value);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Get current settings and update section
      const currentSettings = await this.getAll();
      const updatedSettings = {
        ...currentSettings,
        [key]: value,
      };

      // Validate complete settings
      const validated = AppSettingsSchema.parse(updatedSettings);
      this.store.set('settings', validated);
      this.cache = validated;

      logger.info('Settings section updated', { section: key });
    } catch (error) {
      logger.error('Failed to update settings section', error as Error, { section: key });
      throw error;
    }
  }

  /**
   * Update a single setting value within a section
   */
  async updateSetting<K extends SettingSectionKey>(
    section: K,
    key: keyof AppSettings[K],
    value: unknown
  ): Promise<void> {
    try {
      const currentSection = await this.get(section);
      const updatedSection = {
        ...currentSection,
        [key]: value,
      };
      await this.set(section, updatedSection);
    } catch (error) {
      logger.error(`Failed to update setting ${section}.${String(key)}`, error as Error);
      throw new Error(`Failed to update setting: ${(error as Error).message}`);
    }
  }

  /**
   * Reset settings to defaults
   */
  async reset(section?: SettingSectionKey): Promise<void> {
    const defaults = AppSettingsSchema.parse({});

    if (section) {
      // Reset specific section
      await this.set(section, defaults[section]);
      logger.info('Settings section reset to defaults', { section });
    } else {
      // Reset all settings
      await this.setAll(defaults);
      logger.info('All settings reset to defaults');
    }
  }

  /**
   * Export settings as JSON string
   */
  async export(): Promise<string> {
    const settings = await this.getAll();
    return JSON.stringify(
      {
        version: this.version,
        timestamp: new Date().toISOString(),
        settings,
      },
      null,
      2
    );
  }

  /**
   * Import settings from JSON string
   */
  async import(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      const settings = data.settings || data; // Support both wrapped and unwrapped formats

      // Validate imported settings
      const validated = AppSettingsSchema.parse(settings);
      await this.setAll(validated);

      logger.info('Settings imported successfully', {
        version: data.version || 'unknown',
      });
    } catch (error) {
      logger.error('Failed to import settings', error as Error);
      throw new Error(`Failed to import settings: ${(error as Error).message}`);
    }
  }

  /**
   * Backup settings to file
   */
  async backup(): Promise<string> {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `settings-backup-${timestamp}.json`);

    // Ensure backup directory exists
    await fs.promises.mkdir(backupDir, { recursive: true });

    // Export and save settings
    const exportData = await this.export();
    await fs.promises.writeFile(backupPath, exportData, 'utf8');

    logger.info('Settings backup created', { path: backupPath });
    return backupPath;
  }

  /**
   * Restore settings from backup file
   */
  async restore(backupPath: string): Promise<void> {
    try {
      const data = await fs.promises.readFile(backupPath, 'utf8');
      await this.import(data);
      logger.info('Settings restored from backup', { path: backupPath });
    } catch (error) {
      logger.error('Failed to restore settings from backup', error as Error);
      throw new Error(`Failed to restore settings: ${(error as Error).message}`);
    }
  }

  /**
   * List available backup files
   */
  async listBackups(): Promise<string[]> {
    const backupDir = path.join(app.getPath('userData'), 'backups');

    try {
      await fs.promises.access(backupDir);
      const files = await fs.promises.readdir(backupDir);
      return files
        .filter((file) => file.startsWith('settings-backup-') && file.endsWith('.json'))
        .map((file) => path.join(backupDir, file))
        .sort()
        .reverse(); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Validate settings against schema
   */
  async validate(settings?: Partial<AppSettings>): Promise<SettingsValidationResult> {
    const toValidate = settings || (await this.getAll());

    try {
      AppSettingsSchema.parse(toValidate);
      return {
        isValid: true,
        errors: [],
        warnings: this.generateWarnings(toValidate as AppSettings),
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          isValid: false,
          errors: [error.message],
          warnings: [],
        };
      }
      return {
        isValid: false,
        errors: ['Unknown validation error'],
        warnings: [],
      };
    }
  }

  /**
   * Generate warnings for settings
   */
  private generateWarnings(settings: AppSettings): string[] {
    const warnings: string[] = [];

    // Check for potential issues
    if (settings.general.maxConcurrentDownloads > 5) {
      warnings.push('High concurrent download count may impact system performance');
    }

    if (settings.network.proxy?.enabled && !settings.network.proxy.host) {
      warnings.push('Proxy is enabled but host is not configured');
    }

    if (settings.network.timeout < 10000) {
      warnings.push('Network timeout is very low, may cause premature failures');
    }

    if (!settings.general.downloadDirectory) {
      warnings.push('Download directory is not set, using system default');
    }

    return warnings;
  }

  /**
   * Validate and repair settings on startup
   */
  private validateAndRepair(): void {
    try {
      const settings = this.store.get('settings');
      const validated = AppSettingsSchema.parse(settings);
      this.store.set('settings', validated);
      this.cache = validated;
    } catch (error) {
      logger.warn('Settings validation failed, repairing with defaults', {
        error: (error as Error).message,
      });

      // Reset to defaults
      const defaults = AppSettingsSchema.parse({});
      this.store.set('settings', defaults);
      this.cache = defaults;
    }
  }

  /**
   * Watch for settings changes
   */
  onDidChange<K extends SettingSectionKey>(
    key: K,
    callback: (newValue: AppSettings[K], oldValue: AppSettings[K]) => void
  ): () => void {
    return this.store.onDidChange(`settings.${key}` as any, callback as any);
  }

  /**
   * Watch for any settings changes
   */
  onDidAnyChange(callback: (newValue?: StoreSchema, oldValue?: StoreSchema) => void): () => void {
    return this.store.onDidAnyChange(callback);
  }

  /**
   * Clear all settings (dangerous!)
   */
  clear(): Promise<void> {
    this.store.clear();
    // After clear, settings are reset to defaults
    const defaults = AppSettingsSchema.parse({});
    this.store.set('settings', defaults);
    this.cache = defaults;
    logger.warn('All settings cleared and reset to defaults');
    return Promise.resolve();
  }

  /**
   * Get store path
   */
  getStorePath(): string {
    return this.store.path;
  }

  /**
   * Get store size
   */
  getStoreSize(): number {
    return this.store.size;
  }
}
