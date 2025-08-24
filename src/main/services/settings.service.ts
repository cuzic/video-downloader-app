/**
 * Settings Service
 * Business logic layer for settings management with event handling
 */
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { SettingsStoreRepository } from './settings-store.repository';
import { SettingsMigrationService } from './settings-migration.service';
import { logger } from '@/logging';
import type {
  AppSettings,
  SettingSectionKey,
  SettingsChangeEvent,
  SettingsValidationResult,
  NetworkSettings,
} from '@/shared/types/settings';

const execAsync = promisify(exec);

export class SettingsService extends EventEmitter {
  private repository: SettingsStoreRepository;
  private migrationService: SettingsMigrationService;
  private changeHistory: SettingsChangeEvent[] = [];
  private readonly maxHistorySize = 100;

  constructor() {
    super();
    this.repository = new SettingsStoreRepository();
    this.migrationService = new SettingsMigrationService(this.repository);
    this.setupChangeHandlers();
    void this.initializeWithMigration();
    logger.info('Settings service initialized');
  }

  /**
   * Initialize service with migration check
   */
  private async initializeWithMigration(): Promise<void> {
    try {
      const needsMigration = await this.migrationService.needsMigration();
      if (needsMigration) {
        logger.info('Settings migration required, starting migration...');
        const result = await this.migrationService.migrate();

        if (result.success) {
          logger.info('Settings migration completed successfully', result);
          this.emit('settings:migrated', result);
        } else {
          logger.error('Settings migration failed', new Error(result.errors.join(', ')));
          this.emit('settings:migration-failed', result);
        }
      }

      // Clean up old migration backups
      await this.migrationService.cleanupOldBackups();
    } catch (error) {
      logger.error('Failed to initialize settings with migration', error as Error);
    }
  }

  /**
   * Setup change handlers for settings updates
   */
  private setupChangeHandlers(): void {
    // Watch for any settings changes
    this.repository.onDidAnyChange((newValue, oldValue) => {
      const changes = this.detectChanges(
        (oldValue?.settings as Record<string, unknown>) || {},
        (newValue?.settings as Record<string, unknown>) || {}
      );

      // Emit change events for each modified section
      changes.forEach((section) => {
        const changeEvent: SettingsChangeEvent = {
          section: section as SettingSectionKey,
          key: section,
          oldValue: oldValue?.settings?.[section as SettingSectionKey],
          newValue: newValue?.settings?.[section as SettingSectionKey],
          timestamp: Date.now(),
        };

        // Add to history
        this.addToHistory(changeEvent);

        // Emit events
        this.emit('settings:changed', changeEvent);
        this.emit(`settings:${section}:changed`, changeEvent);
      });

      logger.info('Settings changed', {
        sections: changes,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Add change event to history
   */
  private addToHistory(event: SettingsChangeEvent): void {
    this.changeHistory.push(event);

    // Trim history if it exceeds max size
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get change history
   */
  getChangeHistory(): SettingsChangeEvent[] {
    return [...this.changeHistory];
  }

  /**
   * Detect which sections changed
   */
  private detectChanges(
    oldSettings: Record<string, unknown>,
    newSettings: Record<string, unknown>
  ): string[] {
    const changes: string[] = [];
    const sections: SettingSectionKey[] = ['general', 'quality', 'network', 'ui', 'advanced'];

    for (const section of sections) {
      if (JSON.stringify(oldSettings[section]) !== JSON.stringify(newSettings[section])) {
        changes.push(section);
      }
    }

    return changes;
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<AppSettings> {
    return this.repository.getAll();
  }

  /**
   * Get a specific settings section
   */
  async get<K extends SettingSectionKey>(key: K): Promise<AppSettings[K]> {
    return this.repository.get(key);
  }

  /**
   * Update all settings
   */
  async setAll(settings: AppSettings): Promise<void> {
    const validation = await this.validateSettings(settings);

    if (!validation.isValid) {
      throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    validation.warnings.forEach((warning) => {
      logger.warn('Settings warning', { warning });
    });

    await this.repository.setAll(settings);
  }

  /**
   * Update a specific settings section
   */
  async set<K extends SettingSectionKey>(key: K, value: AppSettings[K]): Promise<void> {
    await this.repository.set(key, value);
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends SettingSectionKey>(
    section: K,
    key: keyof AppSettings[K],
    value: unknown
  ): Promise<void> {
    await this.repository.updateSetting(section, key, value);
  }

  /**
   * Reset settings to defaults
   */
  async reset(section?: SettingSectionKey): Promise<void> {
    await this.repository.reset(section);
    this.emit('settings:reset', { section });
  }

  /**
   * Validate settings with business logic
   */
  async validateSettings(settings: Partial<AppSettings>): Promise<SettingsValidationResult> {
    // Get base validation from repository
    const baseValidation = await this.repository.validate(settings);

    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];

    // Additional business logic validation
    if (settings.general) {
      // Validate download directory
      if (settings.general.downloadDirectory) {
        const dirExists = await this.validateDirectory(settings.general.downloadDirectory);
        if (!dirExists) {
          errors.push('Download directory does not exist or is not accessible');
        }
      }

      // Check concurrent downloads
      if (settings.general.maxConcurrentDownloads > 5) {
        warnings.push('More than 5 concurrent downloads may impact system performance');
      }
    }

    if (settings.network?.proxy?.enabled) {
      // Validate proxy configuration
      const proxyValid = this.validateProxy(settings.network.proxy);
      if (!proxyValid) {
        errors.push('Invalid proxy configuration');
      }
    }

    if (settings.advanced?.ffmpegPath) {
      // Validate FFmpeg path
      const ffmpegValid = await this.validateFFmpegPath(settings.advanced.ffmpegPath);
      if (!ffmpegValid) {
        warnings.push('FFmpeg path may be invalid or FFmpeg is not installed');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate directory path
   */
  private async validateDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      // Try to create the directory
      try {
        await fs.promises.mkdir(dirPath, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Validate proxy configuration
   */
  private validateProxy(proxy: NetworkSettings['proxy']): boolean {
    if (!proxy?.enabled) return true;

    // Check required fields
    if (!proxy.host || !proxy.port) {
      return false;
    }

    // Validate port range
    if (proxy.port < 1 || proxy.port > 65535) {
      return false;
    }

    // If auth is enabled, check credentials
    if (proxy.auth && (!proxy.auth.username || !proxy.auth.password)) {
      return false;
    }

    return true;
  }

  /**
   * Validate FFmpeg installation
   */
  private async validateFFmpegPath(ffmpegPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`"${ffmpegPath}" -version`);
      return stdout.includes('ffmpeg version');
    } catch {
      return false;
    }
  }

  /**
   * Export settings
   */
  async export(): Promise<string> {
    return this.repository.export();
  }

  /**
   * Import settings
   */
  async import(jsonString: string): Promise<void> {
    // Validate before importing
    const data = JSON.parse(jsonString);
    const settings = data.settings || data;

    const validation = await this.validateSettings(settings);
    if (!validation.isValid) {
      throw new Error(`Cannot import invalid settings: ${validation.errors.join(', ')}`);
    }

    await this.repository.import(jsonString);
    this.emit('settings:imported', { timestamp: Date.now() });
  }

  /**
   * Backup settings
   */
  async backup(): Promise<string> {
    const backupPath = await this.repository.backup();
    this.emit('settings:backup', { path: backupPath, timestamp: Date.now() });
    return backupPath;
  }

  /**
   * Restore settings from backup
   */
  async restore(backupPath: string): Promise<void> {
    await this.repository.restore(backupPath);
    this.emit('settings:restored', { path: backupPath, timestamp: Date.now() });
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<string[]> {
    return this.repository.listBackups();
  }

  /**
   * Auto-backup settings (called periodically)
   */
  async autoBackup(): Promise<void> {
    const backups = await this.listBackups();
    const maxBackups = 10;

    // Create new backup
    await this.backup();

    // Clean old backups if exceeds limit
    if (backups.length >= maxBackups) {
      const toDelete = backups.slice(maxBackups - 1);
      for (const backup of toDelete) {
        try {
          await fs.promises.unlink(backup);
          logger.info('Deleted old backup', { path: backup });
        } catch (error) {
          logger.error('Failed to delete old backup', error as Error, { path: backup });
        }
      }
    }
  }

  /**
   * Get settings with defaults applied
   */
  async getWithDefaults(): Promise<AppSettings> {
    const settings = await this.getAll();

    // Apply system-specific defaults if not set
    if (!settings.general.downloadDirectory) {
      settings.general.downloadDirectory = app.getPath('downloads');
    }

    return settings;
  }

  /**
   * Apply settings (trigger side effects)
   */
  applySettings(settings: AppSettings): Promise<void> {
    // Apply theme
    if (settings.ui.theme) {
      this.emit('theme:change', settings.ui.theme);
    }

    // Apply language
    if (settings.ui.language) {
      this.emit('language:change', settings.ui.language);
    }

    // Apply log level
    if (settings.advanced.logLevel) {
      logger.info('Updating log level', { level: settings.advanced.logLevel });
      // In a real implementation, you would update the logger configuration here
    }

    // Apply proxy settings
    if (settings.network.proxy?.enabled) {
      this.emit('proxy:configure', settings.network.proxy);
    }

    logger.info('Settings applied', { timestamp: Date.now() });
    return Promise.resolve();
  }

  /**
   * Get store information
   */
  getStoreInfo(): { path: string; size: number } {
    return {
      path: this.repository.getStorePath(),
      size: this.repository.getStoreSize(),
    };
  }

  /**
   * Clear all settings (dangerous!)
   */
  async clearAll(): Promise<void> {
    await this.repository.clear();
    this.emit('settings:cleared', { timestamp: Date.now() });
  }

  /**
   * Migrate settings from old format
   */
  async migrateFromLegacy(legacySettings: Record<string, unknown>): Promise<void> {
    // Map legacy settings to new format
    const migrated: Partial<AppSettings> = {
      general: {
        downloadDirectory: (legacySettings.downloadDirectory as string) || '',
        maxConcurrentDownloads: (legacySettings.maxDownloads as number) || 3,
        autoStartDownload: (legacySettings.autoStart as boolean) ?? true,
        notificationEnabled: (legacySettings.notifications as boolean) ?? true,
        closeToTray: false,
        startMinimized: false,
      },
      quality: {
        preference: (legacySettings.quality as 'highest' | 'lowest' | 'custom') || 'highest',
        fallbackQuality: 'next-lower',
        customRules: [],
      },
      network: {
        timeout: (legacySettings.timeout as number) || 30000,
        maxRetries: (legacySettings.retries as number) || 3,
        retryDelay: 2000,
        headers: {},
      },
      ui: {
        theme: (legacySettings.theme as 'light' | 'dark' | 'system') || 'system',
        language: (legacySettings.language as 'en' | 'ja' | 'zh-CN' | 'ko') || 'en',
        windowBounds: {
          width: 1200,
          height: 800,
        },
        showInTray: true,
        minimizeOnClose: false,
      },
      advanced: {
        ffmpegPath: (legacySettings.ffmpegPath as string) || 'ffmpeg',
        ffmpegArgs: (legacySettings.ffmpegArgs as string[]) || [],
        concurrentSegments: 4,
        enableDebugMode: false,
        logLevel: 'info',
        enableTelemetry: true,
        updateChannel: 'stable',
      },
    };

    // Validate and apply
    const validation = await this.validateSettings(migrated);
    if (validation.isValid) {
      await this.setAll(migrated as AppSettings);
      logger.info('Settings migrated from legacy format');
    } else {
      throw new Error(`Failed to migrate settings: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Check if settings migration is needed
   */
  async needsMigration(): Promise<boolean> {
    return this.migrationService.needsMigration();
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Array<{ version: string; description: string }>> {
    const pending = await this.migrationService.getPendingMigrations();
    return pending.map((m) => ({ version: m.version, description: m.description }));
  }

  /**
   * Run settings migration manually
   */
  async runMigration(): Promise<{
    success: boolean;
    fromVersion: string;
    toVersion: string;
    errors: string[];
  }> {
    const result = await this.migrationService.migrate();
    if (result.success) {
      this.emit('settings:migrated', result);
    } else {
      this.emit('settings:migration-failed', result);
    }
    return {
      success: result.success,
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      errors: result.errors,
    };
  }

  /**
   * Rollback settings to a specific version
   */
  async rollbackSettings(targetVersion: string): Promise<{ success: boolean; errors: string[] }> {
    const result = await this.migrationService.rollback(targetVersion);
    if (result.success) {
      this.emit('settings:rolled-back', result);
    } else {
      this.emit('settings:rollback-failed', result);
    }
    return {
      success: result.success,
      errors: result.errors,
    };
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<
    Array<{ version: string; timestamp: string; success: boolean }>
  > {
    return this.migrationService.getMigrationHistory();
  }

  /**
   * Validate current settings against schema
   */
  async validateCurrentSettings(): Promise<{ isValid: boolean; errors: string[] }> {
    return this.migrationService.validateCurrentSettings();
  }

  /**
   * Clean up old migration backups
   */
  async cleanupMigrationBackups(maxAgeDays: number = 30): Promise<void> {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    await this.migrationService.cleanupOldBackups(maxAge);
  }
}
