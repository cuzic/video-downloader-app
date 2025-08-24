/**
 * Secrets Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecretsService } from '../secrets.service';

// Mock keytar
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
    findCredentials: vi.fn(),
  },
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

describe('SecretsService', () => {
  let service: SecretsService;
  let mockKeytar: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked keytar
    const keytarModule = await import('keytar');
    mockKeytar = keytarModule.default;

    // Default mock implementations
    mockKeytar.findCredentials.mockResolvedValue([]);
    mockKeytar.setPassword.mockResolvedValue(undefined);
    mockKeytar.getPassword.mockResolvedValue(null);
    mockKeytar.deletePassword.mockResolvedValue(true);

    service = new SecretsService();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully when keytar is available', async () => {
      mockKeytar.findCredentials.mockResolvedValue([]);

      const _newService = new SecretsService();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockKeytar.findCredentials).toHaveBeenCalledWith('video-downloader-app');
    });

    it('should handle initialization failure gracefully', async () => {
      mockKeytar.findCredentials.mockRejectedValue(new Error('Keytar not available'));

      const newService = new SecretsService();
      const unavailableSpy = vi.fn();
      newService.on('secrets:unavailable', unavailableSpy);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(unavailableSpy).toHaveBeenCalledWith({
        reason: 'Keytar not available',
      });
    });
  });

  describe('Proxy Credentials', () => {
    describe('saveProxyCredentials', () => {
      it('should save proxy credentials successfully', async () => {
        mockKeytar.setPassword.mockResolvedValue(undefined);

        await service.saveProxyCredentials('testuser', 'testpass');

        expect(mockKeytar.setPassword).toHaveBeenCalledWith(
          'video-downloader-app',
          'proxy-testuser',
          'testpass'
        );
      });

      it('should emit event on successful save', async () => {
        const savedSpy = vi.fn();
        service.on('secrets:saved', savedSpy);

        await service.saveProxyCredentials('testuser', 'testpass');

        expect(savedSpy).toHaveBeenCalledWith({
          type: 'proxy',
          account: 'testuser',
        });
      });

      it('should throw error on save failure', async () => {
        mockKeytar.setPassword.mockRejectedValue(new Error('Save failed'));

        await expect(service.saveProxyCredentials('testuser', 'testpass')).rejects.toThrow(
          'Failed to save proxy credentials'
        );
      });
    });

    describe('getProxyCredentials', () => {
      it('should retrieve proxy credentials successfully', async () => {
        mockKeytar.getPassword.mockResolvedValue('testpass');

        const result = await service.getProxyCredentials('testuser');

        expect(result).toBe('testpass');
        expect(mockKeytar.getPassword).toHaveBeenCalledWith(
          'video-downloader-app',
          'proxy-testuser'
        );
      });

      it('should return null when credentials not found', async () => {
        mockKeytar.getPassword.mockResolvedValue(null);

        const result = await service.getProxyCredentials('testuser');

        expect(result).toBeNull();
      });

      it('should return null on error', async () => {
        mockKeytar.getPassword.mockRejectedValue(new Error('Get failed'));

        const result = await service.getProxyCredentials('testuser');

        expect(result).toBeNull();
      });
    });

    describe('deleteProxyCredentials', () => {
      it('should delete proxy credentials successfully', async () => {
        mockKeytar.deletePassword.mockResolvedValue(true);

        const result = await service.deleteProxyCredentials('testuser');

        expect(result).toBe(true);
        expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
          'video-downloader-app',
          'proxy-testuser'
        );
      });

      it('should emit event on successful deletion', async () => {
        const deletedSpy = vi.fn();
        service.on('secrets:deleted', deletedSpy);
        mockKeytar.deletePassword.mockResolvedValue(true);

        await service.deleteProxyCredentials('testuser');

        expect(deletedSpy).toHaveBeenCalledWith({
          type: 'proxy',
          account: 'testuser',
        });
      });

      it('should return false on deletion failure', async () => {
        mockKeytar.deletePassword.mockRejectedValue(new Error('Delete failed'));

        const result = await service.deleteProxyCredentials('testuser');

        expect(result).toBe(false);
      });
    });
  });

  describe('API Tokens', () => {
    describe('saveApiToken', () => {
      it('should save API token successfully', async () => {
        await service.saveApiToken('github', 'ghp_token123');

        expect(mockKeytar.setPassword).toHaveBeenCalledWith(
          'video-downloader-app',
          'api-github',
          'ghp_token123'
        );
      });

      it('should emit event on successful save', async () => {
        const savedSpy = vi.fn();
        service.on('secrets:saved', savedSpy);

        await service.saveApiToken('github', 'ghp_token123');

        expect(savedSpy).toHaveBeenCalledWith({
          type: 'api',
          service: 'github',
        });
      });
    });

    describe('getApiToken', () => {
      it('should retrieve API token successfully', async () => {
        mockKeytar.getPassword.mockResolvedValue('ghp_token123');

        const result = await service.getApiToken('github');

        expect(result).toBe('ghp_token123');
        expect(mockKeytar.getPassword).toHaveBeenCalledWith('video-downloader-app', 'api-github');
      });
    });

    describe('deleteApiToken', () => {
      it('should delete API token successfully', async () => {
        mockKeytar.deletePassword.mockResolvedValue(true);

        const result = await service.deleteApiToken('github');

        expect(result).toBe(true);
        expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
          'video-downloader-app',
          'api-github'
        );
      });
    });
  });

  describe('Custom Secrets', () => {
    it('should save custom secret with description', async () => {
      await service.saveCustomSecret('db-password', 'secret123', 'Database password');

      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'video-downloader-app',
        'custom-db-password',
        'secret123'
      );
    });

    it('should retrieve custom secret', async () => {
      mockKeytar.getPassword.mockResolvedValue('secret123');

      const result = await service.getCustomSecret('db-password');

      expect(result).toBe('secret123');
    });

    it('should delete custom secret', async () => {
      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await service.deleteCustomSecret('db-password');

      expect(result).toBe(true);
    });
  });

  describe('listSecrets', () => {
    it('should list all stored secrets metadata', async () => {
      mockKeytar.findCredentials.mockResolvedValue([
        { account: 'proxy-user1', password: 'hidden' },
        { account: 'api-github', password: 'hidden' },
        { account: 'custom-db', password: 'hidden' },
      ]);

      const secrets = await service.listSecrets();

      expect(secrets).toHaveLength(3);
      expect(secrets[0].account).toBe('proxy-user1');
      expect(secrets[1].account).toBe('api-github');
      expect(secrets[2].account).toBe('custom-db');
    });

    it('should return empty array on error', async () => {
      mockKeytar.findCredentials.mockRejectedValue(new Error('List failed'));

      const secrets = await service.listSecrets();

      expect(secrets).toEqual([]);
    });
  });

  describe('clearAllSecrets', () => {
    it('should clear all secrets', async () => {
      mockKeytar.findCredentials.mockResolvedValue([
        { account: 'proxy-user1', password: 'hidden' },
        { account: 'api-github', password: 'hidden' },
      ]);
      mockKeytar.deletePassword.mockResolvedValue(true);

      const count = await service.clearAllSecrets();

      expect(count).toBe(2);
      expect(mockKeytar.deletePassword).toHaveBeenCalledTimes(2);
    });

    it('should emit cleared event', async () => {
      const clearedSpy = vi.fn();
      service.on('secrets:cleared', clearedSpy);

      mockKeytar.findCredentials.mockResolvedValue([
        { account: 'proxy-user1', password: 'hidden' },
      ]);
      mockKeytar.deletePassword.mockResolvedValue(true);

      await service.clearAllSecrets();

      expect(clearedSpy).toHaveBeenCalledWith({ count: 1 });
    });
  });

  describe('migrateFromStore', () => {
    it('should migrate proxy credentials from store', async () => {
      const storeData = {
        network: {
          proxy: {
            auth: {
              username: 'proxyuser',
              password: 'proxypass',
            },
          },
        },
      };

      const result = await service.migrateFromStore(storeData);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'video-downloader-app',
        'proxy-proxyuser',
        'proxypass'
      );
    });

    it('should migrate API tokens from store', async () => {
      const storeData = {
        apiTokens: {
          github: 'ghp_token',
          gitlab: 'glpat_token',
        },
      };

      const result = await service.migrateFromStore(storeData);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(2);
    });

    it('should migrate custom secrets from store', async () => {
      const storeData = {
        secrets: {
          'db-password': 'secret123',
          'api-key': 'key456',
        },
      };

      const result = await service.migrateFromStore(storeData);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
    });

    it('should handle migration errors gracefully', async () => {
      mockKeytar.setPassword.mockRejectedValue(new Error('Save failed'));

      const storeData = {
        network: {
          proxy: {
            auth: {
              username: 'proxyuser',
              password: 'proxypass',
            },
          },
        },
      };

      const result = await service.migrateFromStore(storeData);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to migrate proxy credentials');
    });

    it('should emit migration event', async () => {
      const migratedSpy = vi.fn();
      service.on('secrets:migrated', migratedSpy);

      const storeData = {
        apiTokens: {
          github: 'token',
        },
      };

      await service.migrateFromStore(storeData);

      expect(migratedSpy).toHaveBeenCalledWith({
        success: true,
        migratedCount: 1,
        errors: [],
      });
    });
  });

  describe('isAvailable', () => {
    it('should return true when keytar is available', async () => {
      mockKeytar.findCredentials.mockResolvedValue([]);

      const available = await service.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when keytar is not available', async () => {
      mockKeytar.findCredentials.mockRejectedValue(new Error('Not available'));

      const available = await service.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('metadata tracking', () => {
    it('should track metadata for saved secrets', async () => {
      await service.saveProxyCredentials('user1', 'pass1');

      const metadata = service.getMetadata();

      expect(metadata.has('proxy-user1')).toBe(true);
      const meta = metadata.get('proxy-user1');
      expect(meta?.description).toBe('Proxy authentication credentials');
      expect(meta?.createdAt).toBeInstanceOf(Date);
    });

    it('should update last accessed time on retrieval', async () => {
      mockKeytar.getPassword.mockResolvedValue('pass1');

      await service.saveProxyCredentials('user1', 'pass1');
      await service.getProxyCredentials('user1');

      const metadata = service.getMetadata();
      const meta = metadata.get('proxy-user1');

      expect(meta?.lastAccessed).toBeInstanceOf(Date);
    });

    it('should remove metadata on deletion', async () => {
      await service.saveProxyCredentials('user1', 'pass1');
      mockKeytar.deletePassword.mockResolvedValue(true);

      await service.deleteProxyCredentials('user1');

      const metadata = service.getMetadata();
      expect(metadata.has('proxy-user1')).toBe(false);
    });
  });
});
