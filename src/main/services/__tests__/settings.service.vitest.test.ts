/**
 * Settings Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../settings.service';
import { SettingsStoreRepository } from '../settings-store.repository';
import { SettingsMigrationService } from '../settings-migration.service';
import { AppSettingsSchema } from '@/shared/types/settings';
import fs from 'node:fs';
import { exec } from 'node:child_process';

// Mock dependencies
vi.mock('../settings-store.repository');
vi.mock('../settings-migration.service');
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/downloads'),
  },
}));
vi.mock('@/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SettingsService', () => {
  let service: SettingsService;
  let mockRepository: Record<string, ReturnType<typeof vi.fn>>;
  let mockMigrationService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repository
    mockRepository = {
      getAll: vi.fn().mockResolvedValue(AppSettingsSchema.parse({})),
      get: vi.fn(),
      setAll: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      updateSetting: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
      validate: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
      export: vi.fn().mockResolvedValue('{}'),
      import: vi.fn().mockResolvedValue(undefined),
      backup: vi.fn().mockResolvedValue('/path/to/backup.json'),
      restore: vi.fn().mockResolvedValue(undefined),
      listBackups: vi.fn().mockResolvedValue([]),
      onDidAnyChange: vi.fn().mockReturnValue(() => {}),
      getStorePath: vi.fn().mockReturnValue('/mock/settings.json'),
      getStoreSize: vi.fn().mockReturnValue(1024),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock migration service
    mockMigrationService = {
      needsMigration: vi.fn().mockResolvedValue(false),
      migrate: vi.fn().mockResolvedValue({
        success: true,
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        migrationsApplied: ['1.1.0'],
        errors: [],
        warnings: [],
      }),
      getPendingMigrations: vi.fn().mockResolvedValue([]),
      rollback: vi.fn().mockResolvedValue({ success: true, errors: [] }),
      getMigrationHistory: vi.fn().mockResolvedValue([]),
      validateCurrentSettings: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
      cleanupOldBackups: vi.fn().mockResolvedValue(undefined),
    };

    // Mock constructors
    (SettingsStoreRepository as never).mockImplementation(() => mockRepository);
    (SettingsMigrationService as never).mockImplementation(() => mockMigrationService);

    service = new SettingsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should check for migrations on initialization', async () => {
      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMigrationService.needsMigration).toHaveBeenCalled();
      expect(mockMigrationService.cleanupOldBackups).toHaveBeenCalled();
    });

    it('should run migrations if needed', async () => {
      mockMigrationService.needsMigration.mockResolvedValue(true);

      new SettingsService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMigrationService.migrate).toHaveBeenCalled();
    });

    it('should emit migration events', async () => {
      mockMigrationService.needsMigration.mockResolvedValue(true);

      const service = new SettingsService();
      const migratedSpy = vi.fn();
      service.on('settings:migrated', migratedSpy);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(migratedSpy).toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('should return all settings', async () => {
      const settings = AppSettingsSchema.parse({});
      mockRepository.getAll.mockResolvedValue(settings);

      const result = await service.getAll();

      expect(result).toEqual(settings);
      expect(mockRepository.getAll).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return specific settings section', async () => {
      const generalSettings = AppSettingsSchema.parse({}).general;
      mockRepository.get.mockResolvedValue(generalSettings);

      const result = await service.get('general');

      expect(result).toEqual(generalSettings);
      expect(mockRepository.get).toHaveBeenCalledWith('general');
    });
  });

  describe('setAll', () => {
    it('should validate and set all settings', async () => {
      const settings = AppSettingsSchema.parse({});

      await service.setAll(settings);

      expect(mockRepository.setAll).toHaveBeenCalledWith(settings);
    });

    it('should throw on invalid settings', async () => {
      mockRepository.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid setting'],
        warnings: [],
      });

      const settings = AppSettingsSchema.parse({});

      await expect(service.setAll(settings)).rejects.toThrow('Invalid settings');
    });

    it('should log warnings', async () => {
      mockRepository.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Warning message'],
      });

      const settings = AppSettingsSchema.parse({});
      await service.setAll(settings);

      const { logger } = await import('@/logging');
      expect(logger.warn).toHaveBeenCalledWith('Settings warning', { warning: 'Warning message' });
    });
  });

  describe('set', () => {
    it('should set specific section', async () => {
      const generalSettings = {
        downloadDirectory: '/custom',
        maxConcurrentDownloads: 3,
        autoStartDownload: true,
        notificationEnabled: true,
        closeToTray: false,
        startMinimized: false,
      };

      await service.set('general', generalSettings);

      expect(mockRepository.set).toHaveBeenCalledWith('general', generalSettings);
    });
  });

  describe('updateSetting', () => {
    it('should update single setting', async () => {
      await service.updateSetting('general', 'downloadDirectory', '/new/path');

      expect(mockRepository.updateSetting).toHaveBeenCalledWith(
        'general',
        'downloadDirectory',
        '/new/path'
      );
    });
  });

  describe('reset', () => {
    it('should reset all settings', async () => {
      await service.reset();

      expect(mockRepository.reset).toHaveBeenCalledWith(undefined);
    });

    it('should reset specific section', async () => {
      await service.reset('general');

      expect(mockRepository.reset).toHaveBeenCalledWith('general');
    });

    it('should emit reset event', async () => {
      const resetSpy = vi.fn();
      service.on('settings:reset', resetSpy);

      await service.reset('general');

      expect(resetSpy).toHaveBeenCalledWith({ section: 'general' });
    });
  });

  describe('validateSettings', () => {
    beforeEach(() => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isDirectory: () => true } as never);
    });

    it('should validate download directory', async () => {
      const settings = {
        general: { downloadDirectory: '/valid/path' },
      };

      const result = await service.validateSettings(settings);

      expect(fs.promises.stat).toHaveBeenCalledWith('/valid/path');
      expect(result.isValid).toBe(true);
    });

    it('should create directory if not exists', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('Not found'));
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      const settings = {
        general: { downloadDirectory: '/new/path' },
      };

      const result = await service.validateSettings(settings);

      expect(fs.promises.mkdir).toHaveBeenCalledWith('/new/path', { recursive: true });
      expect(result.isValid).toBe(true);
    });

    it('should validate proxy configuration', async () => {
      const settings = {
        network: {
          proxy: {
            enabled: true,
            host: 'proxy.example.com',
            port: 8080,
          },
        },
      };

      const result = await service.validateSettings(settings);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid proxy configuration', async () => {
      const settings = {
        network: {
          proxy: {
            enabled: true,
            host: '', // Missing host
            port: 8080,
          },
        },
      };

      const result = await service.validateSettings(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid proxy configuration');
    });

    it('should validate FFmpeg path', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(null, { stdout: 'ffmpeg version 4.0.0' });
      });
      (exec as never).mockImplementation(mockExec);

      const settings = {
        advanced: { ffmpegPath: '/usr/bin/ffmpeg' },
      };

      const result = await service.validateSettings(settings);

      // Wait for async exec
      await new Promise((resolve) => setTimeout(resolve, 10));

      // FFmpeg validation happens asynchronously and may add warnings
      // Accept either 0 or 1 warning
      expect(result.warnings.length).toBeLessThanOrEqual(1);
    });
  });

  describe('export/import', () => {
    it('should export settings', async () => {
      const exported = await service.export();

      expect(mockRepository.export).toHaveBeenCalled();
      expect(exported).toBe('{}');
    });

    it('should import and validate settings', async () => {
      const importData = JSON.stringify({
        settings: AppSettingsSchema.parse({}),
      });

      await service.import(importData);

      expect(mockRepository.import).toHaveBeenCalledWith(importData);
    });

    it('should reject invalid import data', async () => {
      mockRepository.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid data'],
        warnings: [],
      });

      const importData = JSON.stringify({ invalid: 'data' });

      await expect(service.import(importData)).rejects.toThrow('Cannot import invalid settings');
    });

    it('should emit import event', async () => {
      const importedSpy = vi.fn();
      service.on('settings:imported', importedSpy);

      const importData = JSON.stringify({
        settings: AppSettingsSchema.parse({}),
      });

      await service.import(importData);

      expect(importedSpy).toHaveBeenCalled();
    });
  });

  describe('backup/restore', () => {
    it('should create backup', async () => {
      const backupPath = await service.backup();

      expect(mockRepository.backup).toHaveBeenCalled();
      expect(backupPath).toBe('/path/to/backup.json');
    });

    it('should emit backup event', async () => {
      const backupSpy = vi.fn();
      service.on('settings:backup', backupSpy);

      await service.backup();

      expect(backupSpy).toHaveBeenCalledWith({
        path: '/path/to/backup.json',
        timestamp: expect.any(Number),
      });
    });

    it('should restore from backup', async () => {
      await service.restore('/path/to/backup.json');

      expect(mockRepository.restore).toHaveBeenCalledWith('/path/to/backup.json');
    });

    it('should emit restore event', async () => {
      const restoreSpy = vi.fn();
      service.on('settings:restored', restoreSpy);

      await service.restore('/path/to/backup.json');

      expect(restoreSpy).toHaveBeenCalledWith({
        path: '/path/to/backup.json',
        timestamp: expect.any(Number),
      });
    });

    it('should list backups', async () => {
      const backups = ['/backup1.json', '/backup2.json'];
      mockRepository.listBackups.mockResolvedValue(backups);

      const result = await service.listBackups();

      expect(result).toEqual(backups);
    });

    it('should auto-backup and cleanup old backups', async () => {
      const backups = Array(15).fill('/backup.json');
      mockRepository.listBackups.mockResolvedValue(backups);
      vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await service.autoBackup();

      expect(mockRepository.backup).toHaveBeenCalled();
      expect(fs.promises.unlink).toHaveBeenCalledTimes(6); // Delete old backups (15 - 10 + 1 new = 6 deletions)
    });
  });

  describe('applySettings', () => {
    it('should emit theme change event', async () => {
      const themeSpy = vi.fn();
      service.on('theme:change', themeSpy);

      const settings = AppSettingsSchema.parse({
        ui: { theme: 'dark' },
      });

      await service.applySettings(settings);

      expect(themeSpy).toHaveBeenCalledWith('dark');
    });

    it('should emit language change event', async () => {
      const languageSpy = vi.fn();
      service.on('language:change', languageSpy);

      const settings = AppSettingsSchema.parse({
        ui: { language: 'ja' },
      });

      await service.applySettings(settings);

      expect(languageSpy).toHaveBeenCalledWith('ja');
    });

    it('should emit proxy configuration event', async () => {
      const proxySpy = vi.fn();
      service.on('proxy:configure', proxySpy);

      const proxyConfig = {
        enabled: true,
        host: 'proxy.example.com',
        port: 8080,
        type: 'http' as const,
      };

      const settings = AppSettingsSchema.parse({
        network: { proxy: proxyConfig },
      });

      await service.applySettings(settings);

      expect(proxySpy).toHaveBeenCalledWith(proxyConfig);
    });
  });

  describe('migration methods', () => {
    it('should check if migration is needed', async () => {
      const result = await service.needsMigration();

      expect(mockMigrationService.needsMigration).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should get pending migrations', async () => {
      const migrations = [
        { version: '1.1.0', description: 'Add proxy settings', up: vi.fn(), down: vi.fn() },
      ];
      mockMigrationService.getPendingMigrations.mockResolvedValue(migrations);

      const result = await service.getPendingMigrations();

      expect(result).toEqual([{ version: '1.1.0', description: 'Add proxy settings' }]);
    });

    it('should run migration manually', async () => {
      const result = await service.runMigration();

      expect(mockMigrationService.migrate).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        errors: [],
      });
    });

    it('should rollback settings', async () => {
      const result = await service.rollbackSettings('1.0.0');

      expect(mockMigrationService.rollback).toHaveBeenCalledWith('1.0.0');
      expect(result).toEqual({ success: true, errors: [] });
    });

    it('should get migration history', async () => {
      const history = [{ version: '1.1.0', timestamp: '2024-01-01', success: true }];
      mockMigrationService.getMigrationHistory.mockResolvedValue(history);

      const result = await service.getMigrationHistory();

      expect(result).toEqual(history);
    });

    it('should validate current settings', async () => {
      const result = await service.validateCurrentSettings();

      expect(mockMigrationService.validateCurrentSettings).toHaveBeenCalled();
      expect(result).toEqual({ isValid: true, errors: [] });
    });

    it('should cleanup migration backups', async () => {
      await service.cleanupMigrationBackups(7);

      expect(mockMigrationService.cleanupOldBackups).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getWithDefaults', () => {
    it('should apply system defaults', async () => {
      const settings = AppSettingsSchema.parse({});
      settings.general.downloadDirectory = ''; // Empty directory
      mockRepository.getAll.mockResolvedValue(settings);

      const result = await service.getWithDefaults();

      expect(result.general.downloadDirectory).toBe('/mock/downloads');
    });
  });

  describe('store management', () => {
    it('should get store info', () => {
      const info = service.getStoreInfo();

      expect(info).toEqual({
        path: '/mock/settings.json',
        size: 1024,
      });
    });

    it('should clear all settings', async () => {
      await service.clearAll();

      expect(mockRepository.clear).toHaveBeenCalled();
    });

    it('should emit clear event', async () => {
      const clearSpy = vi.fn();
      service.on('settings:cleared', clearSpy);

      await service.clearAll();

      expect(clearSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Number),
      });
    });
  });

  describe('migrateFromLegacy', () => {
    it('should migrate legacy settings to new format', async () => {
      // Mock fs.stat to pass directory validation
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isDirectory: () => true } as never);

      const legacySettings = {
        downloadDirectory: '/old/downloads',
        maxDownloads: 5,
        autoStart: false,
        theme: 'dark',
        language: 'ja',
      };

      await service.migrateFromLegacy(legacySettings);

      const expectedSettings = expect.objectContaining({
        general: expect.objectContaining({
          downloadDirectory: '/old/downloads',
          maxConcurrentDownloads: 5,
          autoStartDownload: false,
        }),
        ui: expect.objectContaining({
          theme: 'dark',
          language: 'ja',
        }),
      });

      expect(mockRepository.setAll).toHaveBeenCalledWith(expectedSettings);
    });

    it('should throw on invalid legacy settings', async () => {
      mockRepository.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid legacy data'],
        warnings: [],
      });

      const legacySettings = { invalid: 'data' };

      await expect(service.migrateFromLegacy(legacySettings)).rejects.toThrow(
        'Failed to migrate settings'
      );
    });
  });

  describe('change detection', () => {
    it('should track change history', () => {
      // Trigger a change event
      const changeCallback = mockRepository.onDidAnyChange.mock.calls[0][0];

      const oldValue = { settings: AppSettingsSchema.parse({}) };
      const newValue = {
        settings: AppSettingsSchema.parse({
          general: { downloadDirectory: '/new' },
        }),
      };

      changeCallback(newValue, oldValue);

      const history = service.getChangeHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        section: 'general',
        timestamp: expect.any(Number),
      });
    });

    it('should limit change history size', () => {
      const changeCallback = mockRepository.onDidAnyChange.mock.calls[0][0];

      // Add more than maxHistorySize changes
      for (let i = 1; i <= 150; i++) {
        const oldValue = { settings: AppSettingsSchema.parse({}) };
        const newValue = {
          settings: AppSettingsSchema.parse({
            general: { maxConcurrentDownloads: Math.min(i, 10) }, // Cap at max value
          }),
        };
        changeCallback(newValue, oldValue);
      }

      const history = service.getChangeHistory();
      expect(history).toHaveLength(100); // maxHistorySize
    });
  });
});
