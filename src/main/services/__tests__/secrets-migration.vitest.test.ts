/**
 * Secrets Migration Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecretsMigration } from '../secrets-migration';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
}));

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
    })),
  };
});

// Mock SecretsService
vi.mock('../secrets.service', () => ({
  SecretsService: vi.fn().mockImplementation(() => ({
    isAvailable: vi.fn().mockResolvedValue(true),
    saveProxyCredentials: vi.fn().mockResolvedValue(undefined),
    saveApiToken: vi.fn().mockResolvedValue(undefined),
    saveCustomSecret: vi.fn().mockResolvedValue(undefined),
    listSecrets: vi.fn().mockResolvedValue([]),
    getProxyCredentials: vi.fn().mockResolvedValue(null),
    getApiToken: vi.fn().mockResolvedValue(null),
    getCustomSecret: vi.fn().mockResolvedValue(null),
    deleteProxyCredentials: vi.fn().mockResolvedValue(true),
    deleteApiToken: vi.fn().mockResolvedValue(true),
    deleteCustomSecret: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock logging
vi.mock('@/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SecretsMigration', () => {
  let migration: SecretsMigration;
  let mockStore: any;
  let mockSecretsService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock instances
    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
    };

    mockSecretsService = {
      isAvailable: vi.fn().mockResolvedValue(true),
      saveProxyCredentials: vi.fn().mockResolvedValue(undefined),
      saveApiToken: vi.fn().mockResolvedValue(undefined),
      saveCustomSecret: vi.fn().mockResolvedValue(undefined),
      listSecrets: vi.fn().mockResolvedValue([]),
      getProxyCredentials: vi.fn().mockResolvedValue(null),
      getApiToken: vi.fn().mockResolvedValue(null),
      getCustomSecret: vi.fn().mockResolvedValue(null),
      deleteProxyCredentials: vi.fn().mockResolvedValue(true),
      deleteApiToken: vi.fn().mockResolvedValue(true),
      deleteCustomSecret: vi.fn().mockResolvedValue(true),
    };

    // Update mocks to return our instances
    const Store = (await import('electron-store')).default as any;
    Store.mockImplementation(() => mockStore);

    const { SecretsService } = await import('../secrets.service') as any;
    SecretsService.mockImplementation(() => mockSecretsService);

    migration = new SecretsMigration();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('needsMigration', () => {
    it('should return false if already migrated', async () => {
      mockStore.get.mockReturnValue(true);

      const result = await migration.needsMigration();

      expect(result).toBe(false);
      expect(mockStore.get).toHaveBeenCalledWith('secrets.migrated', false);
    });

    it('should return false if keytar is not available', async () => {
      mockStore.get.mockReturnValue(false);
      mockSecretsService.isAvailable.mockResolvedValue(false);

      const result = await migration.needsMigration();

      expect(result).toBe(false);
    });

    it('should return true if there are proxy credentials to migrate', async () => {
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'secrets.migrated') return false;
        if (key === 'settings') {
          return {
            proxy: {
              auth: {
                username: 'proxyuser',
                password: 'proxypass',
              },
            },
          };
        }
        return undefined;
      });

      const result = await migration.needsMigration();

      expect(result).toBe(true);
    });

    it('should return true if there are API tokens to migrate', async () => {
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'secrets.migrated') return false;
        if (key === 'apiTokens') {
          return {
            github: 'ghp_token123',
            gitlab: 'glpat_token456',
          };
        }
        return undefined;
      });

      const result = await migration.needsMigration();

      expect(result).toBe(true);
    });
  });

  describe('migrate', () => {
    it('should migrate proxy credentials successfully', async () => {
      const settings = {
        proxy: {
          auth: {
            username: 'proxyuser',
            password: 'proxypass',
          },
        },
      };

      mockStore.get.mockImplementation((key: string) => {
        if (key === 'settings') return settings;
        return undefined;
      });

      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.removedFromStore).toBe(1);
      expect(mockSecretsService.saveProxyCredentials).toHaveBeenCalledWith(
        'proxyuser',
        'proxypass'
      );
      expect(mockStore.set).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({
          proxy: {
            auth: {
              username: 'proxyuser',
              password: '',
            },
          },
        })
      );
    });

    it('should migrate API tokens successfully', async () => {
      const apiTokens = {
        github: 'ghp_token123',
        gitlab: 'glpat_token456',
      };

      mockStore.get.mockImplementation((key: string) => {
        if (key === 'apiTokens') return apiTokens;
        return undefined;
      });

      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
      expect(result.removedFromStore).toBe(2);
      expect(mockSecretsService.saveApiToken).toHaveBeenCalledWith('github', 'ghp_token123');
      expect(mockSecretsService.saveApiToken).toHaveBeenCalledWith('gitlab', 'glpat_token456');
      expect(mockStore.delete).toHaveBeenCalledWith('apiTokens');
    });

    it('should migrate custom secrets successfully', async () => {
      const secrets = {
        'db-password': 'secret123',
        'api-key': 'key456',
      };

      mockStore.get.mockImplementation((key: string) => {
        if (key === 'secrets') return secrets;
        return undefined;
      });

      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
      expect(result.removedFromStore).toBe(2);
      expect(mockSecretsService.saveCustomSecret).toHaveBeenCalledWith('db-password', 'secret123');
      expect(mockSecretsService.saveCustomSecret).toHaveBeenCalledWith('api-key', 'key456');
      expect(mockStore.delete).toHaveBeenCalledWith('secrets');
    });

    it('should handle migration errors gracefully', async () => {
      const settings = {
        proxy: {
          auth: {
            username: 'proxyuser',
            password: 'proxypass',
          },
        },
      };

      mockStore.get.mockImplementation((key: string) => {
        if (key === 'settings') return settings;
        return undefined;
      });

      mockSecretsService.saveProxyCredentials.mockRejectedValue(new Error('Save failed'));

      const result = await migration.migrate();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to migrate proxy credentials');
    });

    it('should set migration flag after successful migration', async () => {
      const apiTokens = { github: 'token' };

      mockStore.get.mockImplementation((key: string) => {
        if (key === 'apiTokens') return apiTokens;
        return undefined;
      });

      await migration.migrate();

      expect(mockStore.set).toHaveBeenCalledWith('secrets.migrated', true);
      expect(mockStore.set).toHaveBeenCalledWith('secrets.migrationTimestamp', expect.any(String));
      expect(mockStore.set).toHaveBeenCalledWith('secrets.migrationResult', {
        migratedCount: 1,
        removedFromStore: 1,
      });
    });
  });

  describe('rollback', () => {
    it('should rollback proxy credentials', async () => {
      mockSecretsService.listSecrets.mockResolvedValue([
        { account: 'proxy-testuser', service: 'video-downloader-app' },
      ]);
      mockSecretsService.getProxyCredentials.mockResolvedValue('testpass');

      const result = await migration.rollback();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(mockStore.set).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({
          proxy: {
            auth: {
              username: 'testuser',
              password: 'testpass',
            },
          },
        })
      );
      expect(mockSecretsService.deleteProxyCredentials).toHaveBeenCalledWith('testuser');
    });

    it('should rollback API tokens', async () => {
      mockSecretsService.listSecrets.mockResolvedValue([
        { account: 'api-github', service: 'video-downloader-app' },
      ]);
      mockSecretsService.getApiToken.mockResolvedValue('ghp_token');

      const result = await migration.rollback();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(mockStore.set).toHaveBeenCalledWith('apiTokens', { github: 'ghp_token' });
      expect(mockSecretsService.deleteApiToken).toHaveBeenCalledWith('github');
    });

    it('should clear migration flag after rollback', async () => {
      mockSecretsService.listSecrets.mockResolvedValue([]);

      await migration.rollback();

      expect(mockStore.delete).toHaveBeenCalledWith('secrets.migrated');
      expect(mockStore.delete).toHaveBeenCalledWith('secrets.migrationTimestamp');
      expect(mockStore.delete).toHaveBeenCalledWith('secrets.migrationResult');
    });
  });

  describe('getMigrationStatus', () => {
    it('should return not migrated status', () => {
      mockStore.get.mockReturnValue(false);

      const status = migration.getMigrationStatus();

      expect(status.migrated).toBe(false);
      expect(status.timestamp).toBeUndefined();
      expect(status.result).toBeUndefined();
    });

    it('should return migrated status with details', () => {
      mockStore.get.mockImplementation((key: string) => {
        if (key === 'secrets.migrated') return true;
        if (key === 'secrets.migrationTimestamp') return '2025-08-24T10:00:00Z';
        if (key === 'secrets.migrationResult')
          return {
            migratedCount: 3,
            removedFromStore: 3,
          };
        return undefined;
      });

      const status = migration.getMigrationStatus();

      expect(status.migrated).toBe(true);
      expect(status.timestamp).toBe('2025-08-24T10:00:00Z');
      expect(status.result).toEqual({
        migratedCount: 3,
        removedFromStore: 3,
      });
    });
  });

  describe('autoMigrate', () => {
    it('should perform migration automatically if needed', async () => {
      const Store = (await import('electron-store')).default;
      const { SecretsService } = await import('../secrets.service');

      // Reset mocks for static method test
      vi.clearAllMocks();

      // Create a new mock for the static method call
      const mockStaticStore = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'secrets.migrated') return false;
          if (key === 'apiTokens') return { github: 'token' };
          return undefined;
        }),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const mockStaticSecretsService = {
        isAvailable: vi.fn().mockResolvedValue(true),
        saveApiToken: vi.fn().mockResolvedValue(undefined),
      };

      (Store as any).mockImplementation(() => mockStaticStore);
      (SecretsService as any).mockImplementation(() => mockStaticSecretsService);

      await SecretsMigration.autoMigrate();

      expect(mockStaticSecretsService.saveApiToken).toHaveBeenCalledWith('github', 'token');
      expect(mockStaticStore.set).toHaveBeenCalledWith('secrets.migrated', true);
    });

    it('should skip migration if already migrated', async () => {
      const Store = (await import('electron-store')).default;
      const { SecretsService } = await import('../secrets.service');

      vi.clearAllMocks();

      const mockStaticStore = {
        get: vi.fn().mockReturnValue(true), // Already migrated
        set: vi.fn(),
      };

      const mockStaticSecretsService = {
        isAvailable: vi.fn().mockResolvedValue(true),
        saveApiToken: vi.fn(),
      };

      (Store as any).mockImplementation(() => mockStaticStore);
      (SecretsService as any).mockImplementation(() => mockStaticSecretsService);

      await SecretsMigration.autoMigrate();

      expect(mockStaticSecretsService.saveApiToken).not.toHaveBeenCalled();
      expect(mockStaticStore.set).not.toHaveBeenCalledWith('secrets.migrated', true);
    });
  });
});
