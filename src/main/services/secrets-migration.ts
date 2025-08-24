/**
 * Secrets Migration
 * Migrates sensitive data from electron-store to OS keychain
 */
import { app } from 'electron';
import Store from 'electron-store';
import { SecretsService } from './secrets.service';
import { logger } from '@/logging';
import type { AppSettings } from '@/shared/types';

export interface SecretsMigrationResult {
  success: boolean;
  migratedCount: number;
  removedFromStore: number;
  errors: string[];
  timestamp: Date;
}

export class SecretsMigration {
  private secretsService: SecretsService;
  private store: Store;
  private readonly MIGRATION_FLAG_KEY = 'secrets.migrated';

  constructor() {
    this.secretsService = new SecretsService();
    this.store = new Store({
      name: 'settings',
      cwd: app.getPath('userData'),
    });
  }

  /**
   * Check if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    // Check if already migrated
    const migrated = this.store.get(this.MIGRATION_FLAG_KEY, false);
    if (migrated) {
      logger.debug('Secrets already migrated');
      return false;
    }

    // Check if keytar is available
    const available = await this.secretsService.isAvailable();
    if (!available) {
      logger.warn('Keytar not available, skipping secrets migration');
      return false;
    }

    // Check if there are secrets to migrate
    const hasSensitiveData = this.hasSensitiveData();

    return hasSensitiveData;
  }

  /**
   * Check if store has sensitive data
   */
  private hasSensitiveData(): boolean {
    const settings = this.store.get('settings') as AppSettings | undefined;

    if (!settings) {
      return false;
    }

    // Check for proxy credentials
    if (settings.proxy?.auth?.password) {
      return true;
    }

    // Check for API tokens (custom fields)
    const apiTokens = this.store.get('apiTokens') as Record<string, string> | undefined;
    if (apiTokens && Object.keys(apiTokens).length > 0) {
      return true;
    }

    // Check for custom secrets
    const secrets = this.store.get('secrets') as Record<string, string> | undefined;
    if (secrets && Object.keys(secrets).length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Run the migration
   */
  async migrate(): Promise<SecretsMigrationResult> {
    const result: SecretsMigrationResult = {
      success: true,
      migratedCount: 0,
      removedFromStore: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      logger.info('Starting secrets migration');

      // Check if keytar is available
      const available = await this.secretsService.isAvailable();
      if (!available) {
        throw new Error('Keytar is not available');
      }

      // Get current settings
      const settings = this.store.get('settings') as AppSettings | undefined;

      // Migrate proxy credentials
      if (settings?.proxy?.auth) {
        const { username, password } = settings.proxy.auth;
        if (username && password) {
          try {
            await this.secretsService.saveProxyCredentials(username, password);

            // Remove password from store, keep username
            settings.proxy.auth = { username, password: '' };
            this.store.set('settings', settings);

            result.migratedCount++;
            result.removedFromStore++;
            logger.info('Migrated proxy credentials', { username });
          } catch (error) {
            const errorMsg = `Failed to migrate proxy credentials: ${(error as Error).message}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }
      }

      // Migrate API tokens
      const apiTokens = this.store.get('apiTokens') as Record<string, string> | undefined;
      if (apiTokens) {
        for (const [service, token] of Object.entries(apiTokens)) {
          try {
            await this.secretsService.saveApiToken(service, token);
            result.migratedCount++;
            logger.info('Migrated API token', { service });
          } catch (error) {
            const errorMsg = `Failed to migrate API token for ${service}: ${(error as Error).message}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        // Remove all API tokens from store
        if (result.migratedCount > 0) {
          this.store.delete('apiTokens');
          result.removedFromStore += Object.keys(apiTokens).length;
        }
      }

      // Migrate custom secrets
      const secrets = this.store.get('secrets') as Record<string, string> | undefined;
      if (secrets) {
        for (const [key, value] of Object.entries(secrets)) {
          try {
            await this.secretsService.saveCustomSecret(key, value);
            result.migratedCount++;
            logger.info('Migrated custom secret', { key });
          } catch (error) {
            const errorMsg = `Failed to migrate secret ${key}: ${(error as Error).message}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        // Remove all secrets from store
        if (result.migratedCount > 0) {
          this.store.delete('secrets');
          result.removedFromStore += Object.keys(secrets).length;
        }
      }

      // Set migration flag
      if (result.migratedCount > 0) {
        this.store.set(this.MIGRATION_FLAG_KEY, true);
        this.store.set('secrets.migrationTimestamp', result.timestamp.toISOString());
        this.store.set('secrets.migrationResult', {
          migratedCount: result.migratedCount,
          removedFromStore: result.removedFromStore,
        });
      }

      // Determine overall success
      result.success = result.errors.length === 0;

      logger.info('Secrets migration completed', {
        success: result.success,
        migratedCount: result.migratedCount,
        removedFromStore: result.removedFromStore,
        errorCount: result.errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Secrets migration failed', error as Error);
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  /**
   * Rollback migration (restore secrets to store from keytar)
   * WARNING: This should only be used in emergency situations
   */
  async rollback(): Promise<SecretsMigrationResult> {
    const result: SecretsMigrationResult = {
      success: true,
      migratedCount: 0,
      removedFromStore: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      logger.warn('Starting secrets migration rollback');

      // Get all secrets from keytar
      const secrets = await this.secretsService.listSecrets();

      for (const secret of secrets) {
        const account = secret.account;

        // Determine secret type and restore
        if (account.startsWith('proxy-')) {
          const username = account.replace('proxy-', '');
          const password = await this.secretsService.getProxyCredentials(username);

          if (password) {
            // Restore to store
            const settings = (this.store.get('settings') as AppSettings) || {};
            if (!settings.proxy) {
              settings.proxy = {
                enabled: false,
                type: 'http',
                auth: { username, password },
              };
            } else {
              settings.proxy.auth = { username, password };
            }

            this.store.set('settings', settings);
            result.migratedCount++;

            // Remove from keytar
            await this.secretsService.deleteProxyCredentials(username);
            result.removedFromStore++;
          }
        } else if (account.startsWith('api-')) {
          const service = account.replace('api-', '');
          const token = await this.secretsService.getApiToken(service);

          if (token) {
            // Restore to store
            const apiTokens = this.store.get('apiTokens', {}) as Record<string, string>;
            apiTokens[service] = token;
            this.store.set('apiTokens', apiTokens);
            result.migratedCount++;

            // Remove from keytar
            await this.secretsService.deleteApiToken(service);
            result.removedFromStore++;
          }
        } else if (account.startsWith('custom-')) {
          const key = account.replace('custom-', '');
          const value = await this.secretsService.getCustomSecret(key);

          if (value) {
            // Restore to store
            const customSecrets = this.store.get('secrets', {}) as Record<string, string>;
            customSecrets[key] = value;
            this.store.set('secrets', customSecrets);
            result.migratedCount++;

            // Remove from keytar
            await this.secretsService.deleteCustomSecret(key);
            result.removedFromStore++;
          }
        }
      }

      // Clear migration flag
      this.store.delete(this.MIGRATION_FLAG_KEY);
      this.store.delete('secrets.migrationTimestamp');
      this.store.delete('secrets.migrationResult');

      logger.warn('Secrets migration rollback completed', {
        restoredToStore: result.migratedCount,
        removedFromKeytar: result.removedFromStore,
      });

      return result;
    } catch (error) {
      logger.error('Secrets migration rollback failed', error as Error);
      result.success = false;
      result.errors.push((error as Error).message);
      return result;
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): {
    migrated: boolean;
    timestamp?: string;
    result?: {
      migratedCount: number;
      removedFromStore: number;
    };
  } {
    const migrated = this.store.get(this.MIGRATION_FLAG_KEY, false) as boolean;

    if (!migrated) {
      return { migrated: false };
    }

    return {
      migrated: true,
      timestamp: this.store.get('secrets.migrationTimestamp') as string | undefined,
      result: this.store.get('secrets.migrationResult') as
        | {
            migratedCount: number;
            removedFromStore: number;
          }
        | undefined,
    };
  }

  /**
   * Auto-migrate on app startup
   */
  static async autoMigrate(): Promise<void> {
    try {
      const migration = new SecretsMigration();

      const needsMigration = await migration.needsMigration();
      if (!needsMigration) {
        return;
      }

      logger.info('Auto-migrating secrets to keytar');
      const result = await migration.migrate();

      if (result.success) {
        logger.info('Auto-migration completed successfully', {
          migratedCount: result.migratedCount,
        });
      } else {
        logger.error('Auto-migration completed with errors', { errors: result.errors } as any);
      }
    } catch (error) {
      logger.error('Auto-migration failed', error as Error);
    }
  }
}
