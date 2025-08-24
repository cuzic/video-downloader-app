/**
 * Settings Migration Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsMigrationService } from '../settings-migration.service';
import { SettingsStoreRepository } from '../settings-store.repository';
import { AppSettingsSchema } from '@/shared/types/settings';
import fs from 'node:fs';

// Mock dependencies
vi.mock('../settings-store.repository');
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
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

describe('SettingsMigrationService', () => {
  let service: SettingsMigrationService;
  let mockRepository: ReturnType<typeof vi.mocked<typeof SettingsStoreRepository>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repository
    mockRepository = {
      getAll: vi.fn().mockResolvedValue(AppSettingsSchema.parse({})),
      setAll: vi.fn().mockResolvedValue(undefined),
      export: vi.fn().mockResolvedValue('{}'),
      getStorePath: vi.fn().mockReturnValue('/mock/settings.json'),
    };

    // Mock constructors
    (SettingsStoreRepository as ReturnType<typeof vi.fn>).mockImplementation(() => mockRepository);

    // Mock fs operations
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.0.0"}');
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'readdir').mockResolvedValue([]);
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({
      mtime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day old
    } as never);
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    service = new SettingsMigrationService(mockRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with migrations', () => {
      const migrations = (service as never).migrations;

      expect(migrations.has('1.0.0')).toBe(true);
      expect(migrations.has('1.1.0')).toBe(true);
      expect(migrations.has('1.2.0')).toBe(true);
    });
  });

  describe('needsMigration', () => {
    it('should return true if current version is older', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.0.0"}');

      const result = await service.needsMigration();

      expect(result).toBe(true);
    });

    it('should return false if current version is up to date', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.2.0"}');

      const result = await service.needsMigration();

      expect(result).toBe(false);
    });

    it('should handle missing version file', async () => {
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('File not found'));

      const result = await service.needsMigration();

      expect(result).toBe(true); // Assumes version 0.0.0
    });
  });

  describe('getPendingMigrations', () => {
    it('should return pending migrations in order', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.0.0"}');

      const pending = await service.getPendingMigrations();

      expect(pending).toHaveLength(2); // 1.1.0 and 1.2.0
      expect(pending[0].version).toBe('1.1.0');
      expect(pending[1].version).toBe('1.2.0');
    });

    it('should return empty array if up to date', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.2.0"}');

      const pending = await service.getPendingMigrations();

      expect(pending).toHaveLength(0);
    });
  });

  describe('migrate', () => {
    it('should apply pending migrations', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"0.0.0"}');

      const flatSettings = {
        downloadDirectory: '/downloads',
        maxDownloads: 5,
        theme: 'dark',
      };
      mockRepository.getAll.mockResolvedValue(flatSettings);

      const result = await service.migrate();

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.2.0');
      expect(result.migrationsApplied).toContain('1.0.0');
      expect(mockRepository.setAll).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"0.0.0"}');
      // Return invalid data that will fail validation during migration
      mockRepository.getAll.mockResolvedValue({
        general: { maxConcurrentDownloads: 'invalid' }, // This will fail Zod validation
      });

      const result = await service.migrate();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create backup before migration', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.0.0"}');

      await service.migrate();

      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.stringContaining('migration-backups'), {
        recursive: true,
      });
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings-v1.0.0'),
        expect.any(String),
        'utf8'
      );
    });

    it('should skip migration if already up to date', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.2.0"}');

      const result = await service.migrate();

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toHaveLength(0);
      expect(mockRepository.setAll).not.toHaveBeenCalled();
    });
  });

  describe('migration definitions', () => {
    describe('1.0.0 migration', () => {
      it('should migrate flat structure to nested', () => {
        const migration = (service as never).migrations.get('1.0.0');

        const flatSettings = {
          downloadDirectory: '/downloads',
          maxDownloads: 5,
          autoStart: false,
          theme: 'dark',
          language: 'ja',
          ffmpegPath: '/usr/bin/ffmpeg',
        };

        const migrated = migration.up(flatSettings);

        expect(migrated.general).toMatchObject({
          downloadDirectory: '/downloads',
          maxConcurrentDownloads: 5,
          autoStartDownload: false,
        });
        expect(migrated.ui).toMatchObject({
          theme: 'dark',
          language: 'ja',
        });
        expect(migrated.advanced).toMatchObject({
          ffmpegPath: '/usr/bin/ffmpeg',
        });
      });

      it('should skip if already in new format', () => {
        const migration = (service as never).migrations.get('1.0.0');

        const nestedSettings = AppSettingsSchema.parse({});

        const migrated = migration.up(nestedSettings);

        expect(migrated).toEqual(nestedSettings);
      });

      it('should support down migration', () => {
        const migration = (service as never).migrations.get('1.0.0');

        const nestedSettings = {
          general: {
            downloadDirectory: '/downloads',
            maxConcurrentDownloads: 5,
          },
          ui: {
            theme: 'dark',
          },
        };

        const migrated = migration.down(nestedSettings);

        expect(migrated).toMatchObject({
          downloadDirectory: '/downloads',
          maxDownloads: 5,
          theme: 'dark',
        });
      });
    });

    describe('1.1.0 migration', () => {
      it('should add proxy settings', () => {
        const migration = (service as never).migrations.get('1.1.0');

        const settings = {
          network: {},
        };

        const migrated = migration.up(settings);

        expect(migrated.network.proxy).toMatchObject({
          enabled: false,
          host: '',
          port: 8080,
          protocol: 'http',
        });
      });

      it('should skip if proxy already exists', () => {
        const migration = (service as never).migrations.get('1.1.0');

        const settings = {
          network: {
            proxy: { enabled: true },
          },
        };

        const migrated = migration.up(settings);

        expect(migrated.network.proxy.enabled).toBe(true);
      });

      it('should support down migration', () => {
        const migration = (service as never).migrations.get('1.1.0');

        const settings = {
          network: {
            proxy: { enabled: true },
          },
        };

        const migrated = migration.down(settings);

        expect(migrated.network.proxy).toBeUndefined();
      });
    });

    describe('1.2.0 migration', () => {
      it('should add advanced settings', () => {
        const migration = (service as never).migrations.get('1.2.0');

        const settings = {
          quality: {},
          network: {},
          advanced: {},
        };

        const migrated = migration.up(settings);

        expect(migrated.quality.minResolution).toBeUndefined();
        expect(migrated.quality.maxResolution).toBeUndefined();
        expect(migrated.quality.preferredCodec).toBeUndefined();
        expect(migrated.network.userAgent).toBeUndefined();
        expect(migrated.network.headers).toEqual({});
        expect(migrated.advanced.concurrentSegments).toBe(4);
      });

      it('should support down migration', () => {
        const migration = (service as never).migrations.get('1.2.0');

        const settings = {
          quality: {
            minResolution: '720p',
            maxResolution: '1080p',
            preferredCodec: 'h264',
          },
          network: {
            userAgent: 'Custom',
            headers: { 'X-Custom': 'value' },
          },
          advanced: {
            concurrentSegments: 8,
          },
        };

        const migrated = migration.down(settings);

        expect(migrated.quality.minResolution).toBeUndefined();
        expect(migrated.quality.maxResolution).toBeUndefined();
        expect(migrated.quality.preferredCodec).toBeUndefined();
        expect(migrated.network.userAgent).toBeUndefined();
        expect(migrated.network.headers).toBeUndefined();
        expect(migrated.advanced.concurrentSegments).toBeUndefined();
      });
    });
  });

  describe('rollback', () => {
    it('should rollback to target version', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.2.0"}');

      const result = await service.rollback('1.0.0');

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('1.2.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.migrationsApplied).toContain('1.2.0');
      expect(result.migrationsApplied).toContain('1.1.0');
    });

    it('should reject rollback to newer version', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.0.0"}');

      const result = await service.rollback('1.2.0');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cannot rollback to same or newer version');
    });

    it('should reject if migration lacks down function', async () => {
      // Mock a migration without down function
      const migrations = (service as never).migrations;
      const mockMigration = { version: '1.3.0', up: vi.fn() };
      migrations.set('1.3.0', mockMigration);

      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.3.0"}');

      const result = await service.rollback('1.0.0');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('does not support rollback');
    });

    it('should create backup before rollback', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"version":"1.2.0"}');

      await service.rollback('1.1.0');

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings-v1.2.0'),
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('getMigrationHistory', () => {
    it('should return migration history', async () => {
      const history = [{ version: '1.1.0', timestamp: '2024-01-01', success: true }];
      vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce(JSON.stringify(history));

      const result = await service.getMigrationHistory();

      expect(result).toEqual(history);
    });

    it('should return empty array if no history', async () => {
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('Not found'));

      const result = await service.getMigrationHistory();

      expect(result).toEqual([]);
    });
  });

  describe('recordMigration', () => {
    it('should record migration in history', async () => {
      // Ensure getMigrationHistory returns an array
      vi.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('[]');

      await service.recordMigration('1.1.0', true);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/mock/userData/migration-history.json',
        expect.stringContaining('1.1.0')
      );
    });

    it('should limit history to 50 entries', async () => {
      const history = Array(60).fill({
        version: '1.0.0',
        timestamp: '2024-01-01',
        success: true,
      });
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(history));

      await service.recordMigration('1.1.0', true);

      const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);

      expect(written).toHaveLength(50);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should delete old backup files', async () => {
      const files = ['backup1.json', 'backup2.json'];
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue(files as never);
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        mtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days old
      } as never);

      await service.cleanupOldBackups();

      expect(fs.promises.unlink).toHaveBeenCalledTimes(2);
    });

    it('should keep recent backup files', async () => {
      const files = ['backup1.json'];
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue(files as never);
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
      } as never);

      await service.cleanupOldBackups();

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.spyOn(fs.promises, 'readdir').mockRejectedValue(new Error('Permission denied'));

      await expect(service.cleanupOldBackups()).resolves.not.toThrow();
    });
  });

  describe('validateCurrentSettings', () => {
    it('should validate settings against schema', async () => {
      const validSettings = AppSettingsSchema.parse({});
      mockRepository.getAll.mockResolvedValue(validSettings);

      const result = await service.validateCurrentSettings();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid settings', async () => {
      mockRepository.getAll.mockRejectedValue(new Error('Invalid settings'));

      const result = await service.validateCurrentSettings();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('compareVersions', () => {
    it('should compare version strings correctly', () => {
      const service = new SettingsMigrationService(mockRepository);
      const compare = (service as never).compareVersions.bind(service);

      expect(compare('1.0.0', '1.0.0')).toBe(0);
      expect(compare('1.0.0', '1.1.0')).toBe(-1);
      expect(compare('1.1.0', '1.0.0')).toBe(1);
      expect(compare('1.0.0', '2.0.0')).toBe(-1);
      expect(compare('1.0', '1.0.0')).toBe(0);
      expect(compare('1.0.1', '1.0')).toBe(1);
    });
  });
});
