/**
 * Secrets Service
 * Manages sensitive information using OS keychain (via keytar)
 *
 * This service provides secure storage for:
 * - Proxy authentication credentials
 * - API tokens for external services
 * - Other sensitive configuration data
 */
import keytar from 'keytar';
import { logger } from '@/logging';
import { EventEmitter } from 'node:events';

export interface SecretMetadata {
  service: string;
  account: string;
  createdAt?: Date;
  lastAccessed?: Date;
  description?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
}

export class SecretsService extends EventEmitter {
  private readonly SERVICE_NAME = 'video-downloader-app';
  private readonly PROXY_PREFIX = 'proxy';
  private readonly API_PREFIX = 'api';
  private readonly CUSTOM_PREFIX = 'custom';

  // Track metadata in memory (non-sensitive)
  private metadata: Map<string, SecretMetadata> = new Map();

  constructor() {
    super();
    void this.initializeService();
  }

  /**
   * Initialize the secrets service
   */
  private async initializeService(): Promise<void> {
    try {
      // Test keytar availability
      await keytar.findCredentials(this.SERVICE_NAME);
      logger.info('Secrets service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize secrets service', error as Error);
      logger.warn('Secrets will not be persisted - keytar unavailable');
      this.emit('secrets:unavailable', { reason: (error as Error).message });
    }
  }

  /**
   * Save proxy credentials
   */
  async saveProxyCredentials(username: string, password: string): Promise<void> {
    const account = `${this.PROXY_PREFIX}-${username}`;

    try {
      await keytar.setPassword(this.SERVICE_NAME, account, password);

      // Update metadata
      this.metadata.set(account, {
        service: this.SERVICE_NAME,
        account,
        createdAt: new Date(),
        description: 'Proxy authentication credentials',
      });

      logger.info('Proxy credentials saved securely', { username });
      this.emit('secrets:saved', { type: 'proxy', account: username });
    } catch (error) {
      logger.error('Failed to save proxy credentials', error as Error);
      throw new Error(`Failed to save proxy credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Get proxy credentials
   */
  async getProxyCredentials(username: string): Promise<string | null> {
    const account = `${this.PROXY_PREFIX}-${username}`;

    try {
      const password = await keytar.getPassword(this.SERVICE_NAME, account);

      if (password) {
        // Update last accessed
        const meta = this.metadata.get(account);
        if (meta) {
          meta.lastAccessed = new Date();
        }

        logger.debug('Proxy credentials retrieved', { username });
      }

      return password;
    } catch (error) {
      logger.error('Failed to get proxy credentials', error as Error);
      return null;
    }
  }

  /**
   * Delete proxy credentials
   */
  async deleteProxyCredentials(username: string): Promise<boolean> {
    const account = `${this.PROXY_PREFIX}-${username}`;

    try {
      const result = await keytar.deletePassword(this.SERVICE_NAME, account);

      if (result) {
        this.metadata.delete(account);
        logger.info('Proxy credentials deleted', { username });
        this.emit('secrets:deleted', { type: 'proxy', account: username });
      }

      return result;
    } catch (error) {
      logger.error('Failed to delete proxy credentials', error as Error);
      return false;
    }
  }

  /**
   * Save API token for external service
   */
  async saveApiToken(service: string, token: string): Promise<void> {
    const account = `${this.API_PREFIX}-${service}`;

    try {
      await keytar.setPassword(this.SERVICE_NAME, account, token);

      // Update metadata
      this.metadata.set(account, {
        service: this.SERVICE_NAME,
        account,
        createdAt: new Date(),
        description: `API token for ${service}`,
      });

      logger.info('API token saved securely', { service });
      this.emit('secrets:saved', { type: 'api', service });
    } catch (error) {
      logger.error('Failed to save API token', error as Error, { service });
      throw new Error(`Failed to save API token: ${(error as Error).message}`);
    }
  }

  /**
   * Get API token for external service
   */
  async getApiToken(service: string): Promise<string | null> {
    const account = `${this.API_PREFIX}-${service}`;

    try {
      const token = await keytar.getPassword(this.SERVICE_NAME, account);

      if (token) {
        // Update last accessed
        const meta = this.metadata.get(account);
        if (meta) {
          meta.lastAccessed = new Date();
        }

        logger.debug('API token retrieved', { service });
      }

      return token;
    } catch (error) {
      logger.error('Failed to get API token', error as Error, { service });
      return null;
    }
  }

  /**
   * Delete API token
   */
  async deleteApiToken(service: string): Promise<boolean> {
    const account = `${this.API_PREFIX}-${service}`;

    try {
      const result = await keytar.deletePassword(this.SERVICE_NAME, account);

      if (result) {
        this.metadata.delete(account);
        logger.info('API token deleted', { service });
        this.emit('secrets:deleted', { type: 'api', service });
      }

      return result;
    } catch (error) {
      logger.error('Failed to delete API token', error as Error, { service });
      return false;
    }
  }

  /**
   * Save custom secret
   */
  async saveCustomSecret(key: string, value: string, description?: string): Promise<void> {
    const account = `${this.CUSTOM_PREFIX}-${key}`;

    try {
      await keytar.setPassword(this.SERVICE_NAME, account, value);

      // Update metadata
      this.metadata.set(account, {
        service: this.SERVICE_NAME,
        account,
        createdAt: new Date(),
        description: description || `Custom secret: ${key}`,
      });

      logger.info('Custom secret saved securely', { key });
      this.emit('secrets:saved', { type: 'custom', key });
    } catch (error) {
      logger.error('Failed to save custom secret', error as Error, { key });
      throw new Error(`Failed to save custom secret: ${(error as Error).message}`);
    }
  }

  /**
   * Get custom secret
   */
  async getCustomSecret(key: string): Promise<string | null> {
    const account = `${this.CUSTOM_PREFIX}-${key}`;

    try {
      const value = await keytar.getPassword(this.SERVICE_NAME, account);

      if (value) {
        // Update last accessed
        const meta = this.metadata.get(account);
        if (meta) {
          meta.lastAccessed = new Date();
        }

        logger.debug('Custom secret retrieved', { key });
      }

      return value;
    } catch (error) {
      logger.error('Failed to get custom secret', error as Error, { key });
      return null;
    }
  }

  /**
   * Delete custom secret
   */
  async deleteCustomSecret(key: string): Promise<boolean> {
    const account = `${this.CUSTOM_PREFIX}-${key}`;

    try {
      const result = await keytar.deletePassword(this.SERVICE_NAME, account);

      if (result) {
        this.metadata.delete(account);
        logger.info('Custom secret deleted', { key });
        this.emit('secrets:deleted', { type: 'custom', key });
      }

      return result;
    } catch (error) {
      logger.error('Failed to delete custom secret', error as Error, { key });
      return false;
    }
  }

  /**
   * List all stored secrets (returns metadata only, not actual secrets)
   */
  async listSecrets(): Promise<SecretMetadata[]> {
    try {
      const credentials = await keytar.findCredentials(this.SERVICE_NAME);

      return credentials.map((cred) => {
        const meta = this.metadata.get(cred.account);
        return (
          meta || {
            service: this.SERVICE_NAME,
            account: cred.account,
            description: this.getDescriptionFromAccount(cred.account),
          }
        );
      });
    } catch (error) {
      logger.error('Failed to list secrets', error as Error);
      return [];
    }
  }

  /**
   * Get description from account name
   */
  private getDescriptionFromAccount(account: string): string {
    if (account.startsWith(this.PROXY_PREFIX)) {
      return 'Proxy authentication credentials';
    } else if (account.startsWith(this.API_PREFIX)) {
      const service = account.replace(`${this.API_PREFIX}-`, '');
      return `API token for ${service}`;
    } else if (account.startsWith(this.CUSTOM_PREFIX)) {
      const key = account.replace(`${this.CUSTOM_PREFIX}-`, '');
      return `Custom secret: ${key}`;
    }
    return 'Unknown secret';
  }

  /**
   * Clear all secrets (dangerous!)
   */
  async clearAllSecrets(): Promise<number> {
    try {
      const credentials = await keytar.findCredentials(this.SERVICE_NAME);
      let deletedCount = 0;

      for (const cred of credentials) {
        const deleted = await keytar.deletePassword(this.SERVICE_NAME, cred.account);
        if (deleted) {
          deletedCount++;
          this.metadata.delete(cred.account);
        }
      }

      logger.warn('All secrets cleared', { count: deletedCount });
      this.emit('secrets:cleared', { count: deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to clear all secrets', error as Error);
      throw new Error(`Failed to clear secrets: ${(error as Error).message}`);
    }
  }

  /**
   * Migrate secrets from electron-store to keytar
   */
  async migrateFromStore(storeData: Record<string, any>): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errors: [],
    };

    try {
      // Migrate proxy credentials
      if (storeData.network?.proxy?.auth) {
        const { username, password } = storeData.network.proxy.auth;
        if (username && password) {
          try {
            await this.saveProxyCredentials(username, password);
            result.migratedCount++;
            logger.info('Migrated proxy credentials', { username });
          } catch (error) {
            result.errors.push(`Failed to migrate proxy credentials: ${(error as Error).message}`);
            result.success = false;
          }
        }
      }

      // Migrate API tokens (if any exist in custom format)
      if (storeData.apiTokens) {
        for (const [service, token] of Object.entries(storeData.apiTokens)) {
          if (typeof token === 'string') {
            try {
              await this.saveApiToken(service, token);
              result.migratedCount++;
              logger.info('Migrated API token', { service });
            } catch (error) {
              result.errors.push(
                `Failed to migrate API token for ${service}: ${(error as Error).message}`
              );
              result.success = false;
            }
          }
        }
      }

      // Migrate custom secrets
      if (storeData.secrets) {
        for (const [key, value] of Object.entries(storeData.secrets)) {
          if (typeof value === 'string') {
            try {
              await this.saveCustomSecret(key, value);
              result.migratedCount++;
              logger.info('Migrated custom secret', { key });
            } catch (error) {
              result.errors.push(`Failed to migrate secret ${key}: ${(error as Error).message}`);
              result.success = false;
            }
          }
        }
      }

      if (result.migratedCount > 0) {
        logger.info('Secrets migration completed', {
          migratedCount: result.migratedCount,
          success: result.success,
        });
        this.emit('secrets:migrated', result);
      }

      return result;
    } catch (error) {
      logger.error('Failed to migrate secrets', error as Error);
      result.success = false;
      result.errors.push(`Migration failed: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Check if keytar is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await keytar.findCredentials(this.SERVICE_NAME);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for all secrets
   */
  getMetadata(): Map<string, SecretMetadata> {
    return new Map(this.metadata);
  }
}
