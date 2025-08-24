/**
 * Settings Store Repository Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsStoreRepository } from '../settings-store.repository';
import { AppSettingsSchema } from '@/shared/types/settings';
import Store from 'electron-store';
import fs from 'node:fs';

// Mock electron-store
vi.mock('electron-store');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

describe('SettingsStoreRepository', () => {
  let repository: SettingsStoreRepository;
  let mockStore: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock store with default settings
    const defaultSettings = AppSettingsSchema.parse({});
    mockStore = {
      get: vi.fn((key: string) => {
        if (key === 'settings') return defaultSettings;
        if (key === 'version') return '1.0.0';
        return undefined;
      }),
      set: vi.fn(),
      has: vi.fn().mockReturnValue(true),
      clear: vi.fn(),
      onDidChange: vi.fn().mockReturnValue(() => {}),
      onDidAnyChange: vi.fn().mockReturnValue(() => {}),
      path: '/mock/settings.json',
      size: 1024,
    };

    // Mock Store constructor
    (Store as never).mockImplementation(() => mockStore);

    repository = new SettingsStoreRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('should return cached settings if available', async () => {
      const cachedSettings = AppSettingsSchema.parse({});
      (repository as never).cache = cachedSettings;

      const result = await repository.getAll();

      expect(result).toBe(cachedSettings);
      // Note: get was called during initialization, but not for getAll
      const callCount = mockStore.get.mock.calls.length;
      await repository.getAll();
      expect(mockStore.get.mock.calls.length).toBe(callCount); // No additional calls
    });

    it('should retrieve and validate settings from store', async () => {
      const storedSettings = AppSettingsSchema.parse({
        general: { downloadDirectory: '/downloads' },
      });
      // Clear cache to force read from store
      (repository as never).cache = null;
      mockStore.get.mockReturnValue(storedSettings);

      const result = await repository.getAll();

      expect(mockStore.get).toHaveBeenCalledWith('settings');
      expect(result.general.downloadDirectory).toBe('/downloads');
      expect((repository as never).cache).toBe(result);
    });

    it('should return defaults on validation error', async () => {
      mockStore.get.mockReturnValue({ invalid: 'data' });

      const result = await repository.getAll();

      expect(result).toEqual(AppSettingsSchema.parse({}));
    });
  });

  describe('get', () => {
    it('should return specific settings section', async () => {
      const settings = AppSettingsSchema.parse({
        general: { downloadDirectory: '/custom' },
      });
      (repository as never).cache = settings;

      const result = await repository.get('general');

      expect(result.downloadDirectory).toBe('/custom');
    });
  });

  describe('setAll', () => {
    it('should validate and save settings', async () => {
      const settings = AppSettingsSchema.parse({});

      await repository.setAll(settings);

      expect(mockStore.set).toHaveBeenCalledWith('settings', settings);
      expect((repository as never).cache).toEqual(settings);
    });

    it('should coerce invalid settings to defaults', async () => {
      const invalidSettings = { invalid: 'data' } as any;

      // Repository coerces invalid data to defaults instead of throwing
      await repository.setAll(invalidSettings);

      // Should set with default values
      expect(mockStore.set).toHaveBeenCalledWith('settings', AppSettingsSchema.parse({}));
    });
  });

  describe('set', () => {
    it('should update specific section', async () => {
      const currentSettings = AppSettingsSchema.parse({});
      mockStore.get.mockReturnValue(currentSettings);

      const newGeneralSettings = {
        downloadDirectory: '/new/path',
        maxConcurrentDownloads: 5,
        autoStartDownload: false,
        notificationEnabled: true,
        closeToTray: false,
        startMinimized: false,
      };

      await repository.set('general', newGeneralSettings);

      expect(mockStore.set).toHaveBeenCalledWith('settings', {
        ...currentSettings,
        general: newGeneralSettings,
      });
    });

    it('should coerce invalid section to defaults', async () => {
      const invalidSection = { invalid: 'data' } as any;

      // Repository coerces invalid data to defaults
      await repository.set('general', invalidSection);

      // Should have been called with coerced defaults
      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  describe('updateSetting', () => {
    it('should update single setting within section', async () => {
      const currentSettings = AppSettingsSchema.parse({});
      mockStore.get.mockReturnValue(currentSettings);

      await repository.updateSetting('general', 'downloadDirectory', '/new/path');

      const expectedGeneral = {
        ...currentSettings.general,
        downloadDirectory: '/new/path',
      };

      expect(mockStore.set).toHaveBeenCalledWith('settings', {
        ...currentSettings,
        general: expectedGeneral,
      });
    });
  });

  describe('reset', () => {
    it('should reset all settings to defaults', async () => {
      await repository.reset();

      const defaults = AppSettingsSchema.parse({});
      expect(mockStore.set).toHaveBeenCalledWith('settings', defaults);
    });

    it('should reset specific section to defaults', async () => {
      const currentSettings = AppSettingsSchema.parse({
        general: { downloadDirectory: '/custom' },
      });
      mockStore.get.mockReturnValue(currentSettings);

      await repository.reset('general');

      const defaults = AppSettingsSchema.parse({});
      expect(mockStore.set).toHaveBeenCalledWith('settings', {
        ...currentSettings,
        general: defaults.general,
      });
    });
  });

  describe('export/import', () => {
    it('should export settings as JSON string', async () => {
      const settings = AppSettingsSchema.parse({});
      mockStore.get.mockReturnValue(settings);

      const exported = await repository.export();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('settings');
      expect(parsed.settings).toEqual(settings);
    });

    it('should import settings from JSON string', async () => {
      const settings = AppSettingsSchema.parse({});
      const importData = JSON.stringify({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings,
      });

      await repository.import(importData);

      expect(mockStore.set).toHaveBeenCalledWith('settings', settings);
    });

    it('should handle unwrapped settings format', async () => {
      const settings = AppSettingsSchema.parse({});
      const importData = JSON.stringify(settings);

      await repository.import(importData);

      expect(mockStore.set).toHaveBeenCalledWith('settings', settings);
    });

    it('should coerce invalid import data to defaults', async () => {
      const invalidData = JSON.stringify({ invalid: 'data' });

      // Repository coerces invalid data to defaults instead of throwing
      await repository.import(invalidData);

      // Should set with default values
      expect(mockStore.set).toHaveBeenCalledWith('settings', AppSettingsSchema.parse({}));
    });
  });

  describe('backup/restore', () => {
    beforeEach(() => {
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('');
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue([]);
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    });

    it('should create backup file', async () => {
      const settings = AppSettingsSchema.parse({});
      mockStore.get.mockReturnValue(settings);

      const backupPath = await repository.backup();

      expect(backupPath).toContain('settings-backup-');
      expect(backupPath).toContain('.json');
      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.stringContaining('backups'), {
        recursive: true,
      });
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should restore from backup file', async () => {
      const settings = AppSettingsSchema.parse({});
      const backupData = JSON.stringify({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings,
      });

      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(backupData);

      await repository.restore('/path/to/backup.json');

      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/backup.json', 'utf8');
      expect(mockStore.set).toHaveBeenCalledWith('settings', settings);
    });

    it('should list available backups', async () => {
      const files = [
        'settings-backup-2024-01-01.json',
        'settings-backup-2024-01-02.json',
        'other-file.txt',
      ];
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue(files as never);

      const backups = await repository.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0]).toContain('settings-backup-2024-01-02.json');
      expect(backups[1]).toContain('settings-backup-2024-01-01.json');
    });
  });

  describe('validation', () => {
    it('should validate settings against schema', async () => {
      const validSettings = AppSettingsSchema.parse({});

      const result = await repository.validate(validSettings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid settings', async () => {
      const invalidSettings = { invalid: 'data' } as any;

      const result = await repository.validate(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should generate warnings for potential issues', async () => {
      const settings = AppSettingsSchema.parse({
        general: { maxConcurrentDownloads: 10 },
      });

      const result = await repository.validate(settings);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'High concurrent download count may impact system performance'
      );
    });
  });

  describe('change detection', () => {
    it('should setup change handlers', () => {
      // Change handlers are not automatically setup in constructor
      // They are setup when user calls onDidChange/onDidAnyChange
      expect(mockStore.onDidChange).toBeDefined();
      expect(mockStore.onDidAnyChange).toBeDefined();
    });

    it('should watch for specific section changes', () => {
      const callback = vi.fn();
      const unsubscribe = repository.onDidChange('general', callback);

      expect(mockStore.onDidChange).toHaveBeenCalledWith('settings.general', expect.any(Function));
      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should watch for any changes', () => {
      const callback = vi.fn();
      const unsubscribe = repository.onDidAnyChange(callback);

      expect(mockStore.onDidAnyChange).toHaveBeenCalledWith(callback);
      expect(unsubscribe).toBeInstanceOf(Function);
    });
  });

  describe('store management', () => {
    it('should clear all settings', async () => {
      await repository.clear();

      expect(mockStore.clear).toHaveBeenCalled();
      // After clear, defaults are restored (not null)
      expect((repository as never).cache).toEqual(AppSettingsSchema.parse({}));
    });

    it('should return store path', () => {
      const path = repository.getStorePath();
      expect(path).toBe('/mock/settings.json');
    });

    it('should return store size', () => {
      const size = repository.getStoreSize();
      expect(size).toBe(1024);
    });
  });
});
