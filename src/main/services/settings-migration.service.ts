/**
 * Settings Migration Service
 * Handles versioned migration of settings between different schema versions
 */
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '@/logging';
import { AppSettingsSchema, type AppSettings } from '@/shared/types/settings';
import type { SettingsStoreRepository } from './settings-store.repository';

export interface MigrationDefinition {
  version: string;
  description: string;
  up: (settings: Record<string, unknown>) => Record<string, unknown>;
  down?: (settings: Record<string, unknown>) => Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  errors: string[];
  warnings: string[];
}

export class SettingsMigrationService {
  private repository: SettingsStoreRepository;
  private migrations: Map<string, MigrationDefinition> = new Map();
  private readonly currentVersion = '1.2.0';

  constructor(repository: SettingsStoreRepository) {
    this.repository = repository;
    this.initializeMigrations();
  }

  /**
   * Initialize all migration definitions
   */
  private initializeMigrations(): void {
    // Migration from unversioned to 1.0.0
    this.addMigration({
      version: '1.0.0',
      description: 'Initial settings structure',
      up: (settings) => {
        // If settings is already in new format, return as-is
        if (
          settings.general ||
          settings.quality ||
          settings.network ||
          settings.ui ||
          settings.advanced
        ) {
          return settings;
        }

        // Migrate flat structure to nested
        return {
          general: {
            downloadDirectory: settings.downloadDirectory || '',
            maxConcurrentDownloads: settings.maxDownloads || 3,
            autoStartDownload: settings.autoStart ?? true,
            notificationEnabled: settings.notifications ?? true,
            closeToTray: false,
            startMinimized: false,
          },
          quality: {
            preference: settings.quality || 'highest',
            fallbackQuality: 'next-lower',
            customRules: [],
          },
          network: {
            timeout: settings.timeout || 30000,
            maxRetries: settings.retries || 3,
            retryDelay: 2000,
          },
          ui: {
            theme: settings.theme || 'system',
            language: settings.language || 'en',
            windowBounds: { width: 1200, height: 800 },
            showInTray: true,
            minimizeOnClose: false,
          },
          advanced: {
            ffmpegPath: settings.ffmpegPath || 'ffmpeg',
            ffmpegArgs: settings.ffmpegArgs || [],
            enableDebugMode: false,
            logLevel: 'info',
            enableTelemetry: true,
            updateChannel: 'stable',
          },
        };
      },
      down: (settings) => {
        const s = settings;
        return {
          downloadDirectory: s.general?.downloadDirectory || '',
          maxDownloads: s.general?.maxConcurrentDownloads || 3,
          autoStart: s.general?.autoStartDownload ?? true,
          notifications: s.general?.notificationEnabled ?? true,
          quality: s.quality?.preference || 'highest',
          timeout: s.network?.timeout || 30000,
          retries: s.network?.maxRetries || 3,
          theme: s.ui?.theme || 'system',
          language: s.ui?.language || 'en',
          ffmpegPath: s.advanced?.ffmpegPath || 'ffmpeg',
          ffmpegArgs: s.advanced?.ffmpegArgs || [],
        };
      },
    });

    // Migration to 1.1.0 - Add proxy settings
    this.addMigration({
      version: '1.1.0',
      description: 'Add network proxy settings',
      up: (settings) => {
        const s = settings;
        if (s.network && !s.network.proxy) {
          s.network.proxy = {
            enabled: false,
            host: '',
            port: 8080,
            protocol: 'http',
          };
        }
        return settings;
      },
      down: (settings) => {
        const s = settings;
        if (s.network?.proxy) {
          delete s.network.proxy;
        }
        return settings;
      },
    });

    // Migration to 1.2.0 - Add advanced download settings
    this.addMigration({
      version: '1.2.0',
      description: 'Add advanced download and UI settings',
      up: (settings) => {
        const s = settings;

        // Add new quality settings
        if (s.quality && !s.quality.minResolution) {
          s.quality.minResolution = undefined;
          s.quality.maxResolution = undefined;
          s.quality.preferredCodec = undefined;
        }

        // Add new network settings
        if (s.network && !s.network.userAgent) {
          s.network.userAgent = undefined;
          s.network.headers = {};
        }

        // Add new advanced settings
        if (s.advanced && s.advanced.concurrentSegments === undefined) {
          s.advanced.concurrentSegments = 4;
        }

        return settings;
      },
      down: (settings) => {
        const s = settings;

        // Remove new quality settings
        if (s.quality) {
          delete s.quality.minResolution;
          delete s.quality.maxResolution;
          delete s.quality.preferredCodec;
        }

        // Remove new network settings
        if (s.network) {
          delete s.network.userAgent;
          delete s.network.headers;
        }

        // Remove new advanced settings
        if (s.advanced) {
          delete s.advanced.concurrentSegments;
        }

        return settings;
      },
    });
  }

  /**
   * Add a migration definition
   */
  private addMigration(migration: MigrationDefinition): void {
    this.migrations.set(migration.version, migration);
    logger.debug('Registered migration', {
      version: migration.version,
      description: migration.description,
    });
  }

  /**
   * Get current settings version
   */
  private async getCurrentVersion(): Promise<string> {
    try {
      // Try to get version from store
      const storeData = await fs.promises.readFile(this.repository.getStorePath(), 'utf8');
      const data = JSON.parse(storeData);
      return data.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Check if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    return this.compareVersions(currentVersion, this.currentVersion) < 0;
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations(): Promise<MigrationDefinition[]> {
    const currentVersion = await this.getCurrentVersion();
    const pending: MigrationDefinition[] = [];

    for (const [version, migration] of this.migrations) {
      if (this.compareVersions(currentVersion, version) < 0) {
        pending.push(migration);
      }
    }

    // Sort by version
    return pending.sort((a, b) => this.compareVersions(a.version, b.version));
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult> {
    const fromVersion = await this.getCurrentVersion();
    const pendingMigrations = await this.getPendingMigrations();

    const result: MigrationResult = {
      success: true,
      fromVersion,
      toVersion: this.currentVersion,
      migrationsApplied: [],
      errors: [],
      warnings: [],
    };

    if (pendingMigrations.length === 0) {
      logger.info('No migrations needed', { currentVersion: fromVersion });
      return result;
    }

    logger.info('Starting settings migration', {
      fromVersion,
      toVersion: this.currentVersion,
      pendingCount: pendingMigrations.length,
    });

    // Create backup before migration
    try {
      const backupPath = await this.createMigrationBackup();
      logger.info('Created migration backup', { path: backupPath });
    } catch (error) {
      result.warnings.push(`Failed to create backup: ${(error as Error).message}`);
    }

    // Apply migrations in order
    let currentSettings = await this.repository.getAll();

    for (const migration of pendingMigrations) {
      try {
        logger.info('Applying migration', {
          version: migration.version,
          description: migration.description,
        });

        const settingsAsRecord = currentSettings as unknown as Record<string, unknown>;
        const migratedSettings = migration.up(settingsAsRecord);

        // Validate migrated settings
        const validated = AppSettingsSchema.parse(migratedSettings);
        currentSettings = validated;

        result.migrationsApplied.push(migration.version);
        logger.info('Migration applied successfully', { version: migration.version });
      } catch (error) {
        const errorMessage = `Failed to apply migration ${migration.version}: ${(error as Error).message}`;
        logger.error(errorMessage, error as Error);
        result.errors.push(errorMessage);
        result.success = false;
        break;
      }
    }

    // Save migrated settings if successful
    if (result.success) {
      try {
        await this.repository.setAll(currentSettings);
        logger.info('Settings migration completed successfully', {
          fromVersion,
          toVersion: this.currentVersion,
          migrationsApplied: result.migrationsApplied,
        });
      } catch (error) {
        result.errors.push(`Failed to save migrated settings: ${(error as Error).message}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Rollback to a specific version (if down migrations are available)
   */
  async rollback(targetVersion: string): Promise<MigrationResult> {
    const currentVersion = await this.getCurrentVersion();

    const result: MigrationResult = {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsApplied: [],
      errors: [],
      warnings: [],
    };

    if (this.compareVersions(currentVersion, targetVersion) <= 0) {
      result.errors.push('Cannot rollback to same or newer version');
      result.success = false;
      return result;
    }

    // Get migrations to rollback (in reverse order)
    const migrationsToRollback: MigrationDefinition[] = [];
    for (const [version, migration] of this.migrations) {
      if (
        this.compareVersions(targetVersion, version) < 0 &&
        this.compareVersions(version, currentVersion) <= 0
      ) {
        if (!migration.down) {
          result.errors.push(`Migration ${version} does not support rollback`);
          result.success = false;
          return result;
        }
        migrationsToRollback.push(migration);
      }
    }

    // Sort in reverse order
    migrationsToRollback.sort((a, b) => this.compareVersions(b.version, a.version));

    logger.info('Starting settings rollback', {
      fromVersion: currentVersion,
      toVersion: targetVersion,
      rollbackCount: migrationsToRollback.length,
    });

    // Create backup before rollback
    try {
      const backupPath = await this.createMigrationBackup();
      logger.info('Created rollback backup', { path: backupPath });
    } catch (error) {
      result.warnings.push(`Failed to create backup: ${(error as Error).message}`);
    }

    // Apply rollbacks in reverse order
    let currentSettings = await this.repository.getAll();

    for (const migration of migrationsToRollback) {
      try {
        logger.info('Rolling back migration', { version: migration.version });

        const settingsAsRecord = currentSettings as unknown as Record<string, unknown>;
        const rolledBackSettings = migration.down?.(settingsAsRecord);
        currentSettings = rolledBackSettings as AppSettings;

        result.migrationsApplied.push(migration.version);
      } catch (error) {
        const errorMessage = `Failed to rollback migration ${migration.version}: ${(error as Error).message}`;
        logger.error(errorMessage, error as Error);
        result.errors.push(errorMessage);
        result.success = false;
        break;
      }
    }

    // Save rolled back settings if successful
    if (result.success) {
      try {
        await this.repository.setAll(currentSettings);
        logger.info('Settings rollback completed successfully', result);
      } catch (error) {
        result.errors.push(`Failed to save rolled back settings: ${(error as Error).message}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Create a backup before migration
   */
  private async createMigrationBackup(): Promise<string> {
    const backupDir = path.join(app.getPath('userData'), 'migration-backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentVersion = await this.getCurrentVersion();
    const backupPath = path.join(backupDir, `settings-v${currentVersion}-${timestamp}.json`);

    // Ensure backup directory exists
    await fs.promises.mkdir(backupDir, { recursive: true });

    // Export and save settings
    const exportData = await this.repository.export();
    await fs.promises.writeFile(backupPath, exportData, 'utf8');

    return backupPath;
  }

  /**
   * Compare version strings (returns -1, 0, or 1)
   */
  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    const maxLength = Math.max(v1parts.length, v2parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }

    return 0;
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<
    Array<{ version: string; timestamp: string; success: boolean }>
  > {
    const historyPath = path.join(app.getPath('userData'), 'migration-history.json');

    try {
      const historyData = await fs.promises.readFile(historyPath, 'utf8');
      return JSON.parse(historyData);
    } catch {
      return [];
    }
  }

  /**
   * Record migration in history
   */
  async recordMigration(version: string, success: boolean): Promise<void> {
    const historyPath = path.join(app.getPath('userData'), 'migration-history.json');
    const history = await this.getMigrationHistory();

    history.push({
      version,
      timestamp: new Date().toISOString(),
      success,
    });

    // Keep only last 50 entries
    const trimmedHistory = history.slice(-50);

    await fs.promises.writeFile(historyPath, JSON.stringify(trimmedHistory, null, 2));
  }

  /**
   * Clean up old migration backups
   */
  async cleanupOldBackups(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const backupDir = path.join(app.getPath('userData'), 'migration-backups');

    try {
      const files = await fs.promises.readdir(backupDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.promises.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.promises.unlink(filePath);
          logger.info('Cleaned up old migration backup', { path: filePath });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old migration backups', error as Error);
    }
  }

  /**
   * Validate current settings against schema
   */
  async validateCurrentSettings(): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const settings = await this.repository.getAll();
      AppSettingsSchema.parse(settings);
      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message],
      };
    }
  }
}
