/**
 * Settings Store IPC Handler
 * Handles IPC communication for the electron-store based settings system
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { SettingsService } from '@/main/services/settings.service';
import { logger } from '@/logging';
import type {
  AppSettings,
  SettingSectionKey,
  SettingsValidationResult,
} from '@/shared/types/settings';

export class SettingsStoreHandler {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from service to renderer
   */
  private setupEventForwarding(): void {
    // Forward settings change events to all windows
    this.settingsService.on('settings:changed', (event) => {
      this.broadcast('on:settings:changed', event);
    });

    this.settingsService.on('settings:reset', (data) => {
      this.broadcast('on:settings:reset', data);
    });

    this.settingsService.on('settings:imported', (data) => {
      this.broadcast('on:settings:imported', data);
    });

    this.settingsService.on('settings:backup', (data) => {
      this.broadcast('on:settings:backup', data);
    });

    this.settingsService.on('settings:restored', (data) => {
      this.broadcast('on:settings:restored', data);
    });

    this.settingsService.on('settings:cleared', (data) => {
      this.broadcast('on:settings:cleared', data);
    });

    // Forward migration events
    this.settingsService.on('settings:migrated', (data) => {
      this.broadcast('on:settings:migrated', data);
    });

    this.settingsService.on('settings:migration-failed', (data) => {
      this.broadcast('on:settings:migration-failed', data);
    });

    this.settingsService.on('settings:rolled-back', (data) => {
      this.broadcast('on:settings:rolled-back', data);
    });

    this.settingsService.on('settings:rollback-failed', (data) => {
      this.broadcast('on:settings:rollback-failed', data);
    });

    // Forward theme and language changes
    this.settingsService.on('theme:change', (theme) => {
      this.broadcast('on:theme:change', theme);
    });

    this.settingsService.on('language:change', (language) => {
      this.broadcast('on:language:change', language);
    });
  }

  /**
   * Broadcast event to all windows
   */
  private broadcast(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }

  /**
   * Register all IPC handlers
   */
  register(): void {
    // Get all settings
    ipcMain.handle('app:settings:get-all', async () => {
      try {
        return await this.settingsService.getAll();
      } catch (error) {
        logger.error('Failed to get all settings', error as Error);
        throw error;
      }
    });

    // Get settings with defaults applied
    ipcMain.handle('app:settings:get-with-defaults', async () => {
      try {
        return await this.settingsService.getWithDefaults();
      } catch (error) {
        logger.error('Failed to get settings with defaults', error as Error);
        throw error;
      }
    });

    // Get specific settings section
    ipcMain.handle(
      'app:settings:get-section',
      async (_event: IpcMainInvokeEvent, section: SettingSectionKey) => {
        try {
          return await this.settingsService.get(section);
        } catch (error) {
          logger.error('Failed to get settings section', error as Error, { section });
          throw error;
        }
      }
    );

    // Set all settings
    ipcMain.handle(
      'app:settings:set-all',
      async (_event: IpcMainInvokeEvent, settings: AppSettings) => {
        try {
          await this.settingsService.setAll(settings);
          await this.settingsService.applySettings(settings);
        } catch (error) {
          logger.error('Failed to set all settings', error as Error);
          throw error;
        }
      }
    );

    // Set specific settings section
    ipcMain.handle(
      'app:settings:set-section',
      async (
        _event: IpcMainInvokeEvent,
        section: SettingSectionKey,
        value: AppSettings[SettingSectionKey]
      ) => {
        try {
          await this.settingsService.set(section, value);

          // Apply settings after update
          const allSettings = await this.settingsService.getAll();
          await this.settingsService.applySettings(allSettings);
        } catch (error) {
          logger.error('Failed to set settings section', error as Error, { section });
          throw error;
        }
      }
    );

    // Update single setting
    ipcMain.handle(
      'app:settings:update-setting',
      async (
        _event: IpcMainInvokeEvent,
        section: SettingSectionKey,
        key: string,
        value: unknown
      ) => {
        try {
          await this.settingsService.updateSetting(
            section,
            key as keyof AppSettings[SettingSectionKey],
            value
          );

          // Apply settings after update
          const allSettings = await this.settingsService.getAll();
          await this.settingsService.applySettings(allSettings);
        } catch (error) {
          logger.error('Failed to update setting', error as Error, { section, key });
          throw error;
        }
      }
    );

    // Reset settings
    ipcMain.handle(
      'app:settings:reset',
      async (_event: IpcMainInvokeEvent, section?: SettingSectionKey) => {
        try {
          await this.settingsService.reset(section);

          // Apply default settings
          const allSettings = await this.settingsService.getAll();
          await this.settingsService.applySettings(allSettings);
        } catch (error) {
          logger.error('Failed to reset settings', error as Error, { section });
          throw error;
        }
      }
    );

    // Validate settings
    ipcMain.handle(
      'app:settings:validate',
      async (
        _event: IpcMainInvokeEvent,
        settings: Partial<AppSettings>
      ): Promise<SettingsValidationResult> => {
        try {
          return await this.settingsService.validateSettings(settings);
        } catch (error) {
          logger.error('Failed to validate settings', error as Error);
          throw error;
        }
      }
    );

    // Export settings
    ipcMain.handle('app:settings:export', async (): Promise<string> => {
      try {
        return await this.settingsService.export();
      } catch (error) {
        logger.error('Failed to export settings', error as Error);
        throw error;
      }
    });

    // Import settings
    ipcMain.handle(
      'app:settings:import',
      async (_event: IpcMainInvokeEvent, jsonString: string) => {
        try {
          await this.settingsService.import(jsonString);

          // Apply imported settings
          const allSettings = await this.settingsService.getAll();
          await this.settingsService.applySettings(allSettings);
        } catch (error) {
          logger.error('Failed to import settings', error as Error);
          throw error;
        }
      }
    );

    // Backup settings
    ipcMain.handle('app:settings:backup', async (): Promise<string> => {
      try {
        return await this.settingsService.backup();
      } catch (error) {
        logger.error('Failed to backup settings', error as Error);
        throw error;
      }
    });

    // Restore settings from backup
    ipcMain.handle(
      'app:settings:restore',
      async (_event: IpcMainInvokeEvent, backupPath: string) => {
        try {
          await this.settingsService.restore(backupPath);

          // Apply restored settings
          const allSettings = await this.settingsService.getAll();
          await this.settingsService.applySettings(allSettings);
        } catch (error) {
          logger.error('Failed to restore settings', error as Error, { backupPath });
          throw error;
        }
      }
    );

    // List available backups
    ipcMain.handle('app:settings:list-backups', async (): Promise<string[]> => {
      try {
        return await this.settingsService.listBackups();
      } catch (error) {
        logger.error('Failed to list backups', error as Error);
        throw error;
      }
    });

    // Auto-backup
    ipcMain.handle('app:settings:auto-backup', async () => {
      try {
        await this.settingsService.autoBackup();
      } catch (error) {
        logger.error('Failed to perform auto-backup', error as Error);
        throw error;
      }
    });

    // Get change history
    ipcMain.handle('app:settings:get-history', () => {
      try {
        return this.settingsService.getChangeHistory();
      } catch (error) {
        logger.error('Failed to get change history', error as Error);
        throw error;
      }
    });

    // Get store info
    ipcMain.handle('app:settings:get-store-info', () => {
      try {
        return this.settingsService.getStoreInfo();
      } catch (error) {
        logger.error('Failed to get store info', error as Error);
        throw error;
      }
    });

    // Clear all settings (dangerous!)
    ipcMain.handle('app:settings:clear-all', async () => {
      try {
        await this.settingsService.clearAll();
      } catch (error) {
        logger.error('Failed to clear all settings', error as Error);
        throw error;
      }
    });

    // Migrate from legacy settings
    ipcMain.handle(
      'app:settings:migrate-legacy',
      async (_event: IpcMainInvokeEvent, legacySettings: Record<string, unknown>) => {
        try {
          await this.settingsService.migrateFromLegacy(legacySettings);
        } catch (error) {
          logger.error('Failed to migrate legacy settings', error as Error);
          throw error;
        }
      }
    );

    // Check if migration is needed
    ipcMain.handle('app:settings:needs-migration', async (): Promise<boolean> => {
      try {
        return await this.settingsService.needsMigration();
      } catch (error) {
        logger.error('Failed to check migration status', error as Error);
        throw error;
      }
    });

    // Get pending migrations
    ipcMain.handle('app:settings:get-pending-migrations', async () => {
      try {
        return await this.settingsService.getPendingMigrations();
      } catch (error) {
        logger.error('Failed to get pending migrations', error as Error);
        throw error;
      }
    });

    // Run migration
    ipcMain.handle('app:settings:run-migration', async () => {
      try {
        return await this.settingsService.runMigration();
      } catch (error) {
        logger.error('Failed to run migration', error as Error);
        throw error;
      }
    });

    // Rollback settings
    ipcMain.handle(
      'app:settings:rollback',
      async (_event: IpcMainInvokeEvent, targetVersion: string) => {
        try {
          return await this.settingsService.rollbackSettings(targetVersion);
        } catch (error) {
          logger.error('Failed to rollback settings', error as Error, { targetVersion });
          throw error;
        }
      }
    );

    // Get migration history
    ipcMain.handle('app:settings:get-migration-history', async () => {
      try {
        return await this.settingsService.getMigrationHistory();
      } catch (error) {
        logger.error('Failed to get migration history', error as Error);
        throw error;
      }
    });

    // Validate current settings
    ipcMain.handle('app:settings:validate-current', async () => {
      try {
        return await this.settingsService.validateCurrentSettings();
      } catch (error) {
        logger.error('Failed to validate current settings', error as Error);
        throw error;
      }
    });

    // Cleanup migration backups
    ipcMain.handle(
      'app:settings:cleanup-migration-backups',
      async (_event: IpcMainInvokeEvent, maxAgeDays: number = 30) => {
        try {
          await this.settingsService.cleanupMigrationBackups(maxAgeDays);
        } catch (error) {
          logger.error('Failed to cleanup migration backups', error as Error);
          throw error;
        }
      }
    );

    logger.info('Settings store IPC handlers registered');
  }

  /**
   * Unregister all handlers
   */
  unregister(): void {
    const channels = [
      'app:settings:get-all',
      'app:settings:get-with-defaults',
      'app:settings:get-section',
      'app:settings:set-all',
      'app:settings:set-section',
      'app:settings:update-setting',
      'app:settings:reset',
      'app:settings:validate',
      'app:settings:export',
      'app:settings:import',
      'app:settings:backup',
      'app:settings:restore',
      'app:settings:list-backups',
      'app:settings:auto-backup',
      'app:settings:get-history',
      'app:settings:get-store-info',
      'app:settings:clear-all',
      'app:settings:migrate-legacy',
      'app:settings:needs-migration',
      'app:settings:get-pending-migrations',
      'app:settings:run-migration',
      'app:settings:rollback',
      'app:settings:get-migration-history',
      'app:settings:validate-current',
      'app:settings:cleanup-migration-backups',
    ];

    channels.forEach((channel) => {
      ipcMain.removeHandler(channel);
    });

    logger.info('Settings store IPC handlers unregistered');
  }
}
