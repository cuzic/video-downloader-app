/**
 * Secrets IPC Handler
 * Handles IPC communication for secrets management
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { SecretsService } from '@/main/services/secrets.service';
import { logger } from '@/logging';

export class SecretsHandler {
  private secretsService: SecretsService;

  constructor() {
    this.secretsService = new SecretsService();
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from service to renderer
   */
  private setupEventForwarding(): void {
    // Forward service events to renderer
    this.secretsService.on('secrets:saved', (data) => {
      this.broadcast('on:secrets:saved', data);
    });

    this.secretsService.on('secrets:deleted', (data) => {
      this.broadcast('on:secrets:deleted', data);
    });

    this.secretsService.on('secrets:cleared', (data) => {
      this.broadcast('on:secrets:cleared', data);
    });

    this.secretsService.on('secrets:migrated', (data) => {
      this.broadcast('on:secrets:migrated', data);
    });

    this.secretsService.on('secrets:unavailable', (data) => {
      this.broadcast('on:secrets:unavailable', data);
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
    // Proxy credentials
    ipcMain.handle(
      'app:secrets:save-proxy',
      async (_event: IpcMainInvokeEvent, username: string, password: string) => {
        try {
          await this.secretsService.saveProxyCredentials(username, password);
        } catch (error) {
          logger.error('Failed to save proxy credentials', error as Error);
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:get-proxy',
      async (_event: IpcMainInvokeEvent, username: string): Promise<string | null> => {
        try {
          return await this.secretsService.getProxyCredentials(username);
        } catch (error) {
          logger.error('Failed to get proxy credentials', error as Error);
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:delete-proxy',
      async (_event: IpcMainInvokeEvent, username: string): Promise<boolean> => {
        try {
          return await this.secretsService.deleteProxyCredentials(username);
        } catch (error) {
          logger.error('Failed to delete proxy credentials', error as Error);
          throw error;
        }
      }
    );

    // API tokens
    ipcMain.handle(
      'app:secrets:save-api-token',
      async (_event: IpcMainInvokeEvent, service: string, token: string) => {
        try {
          await this.secretsService.saveApiToken(service, token);
        } catch (error) {
          logger.error('Failed to save API token', error as Error, { service });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:get-api-token',
      async (_event: IpcMainInvokeEvent, service: string): Promise<string | null> => {
        try {
          return await this.secretsService.getApiToken(service);
        } catch (error) {
          logger.error('Failed to get API token', error as Error, { service });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:delete-api-token',
      async (_event: IpcMainInvokeEvent, service: string): Promise<boolean> => {
        try {
          return await this.secretsService.deleteApiToken(service);
        } catch (error) {
          logger.error('Failed to delete API token', error as Error, { service });
          throw error;
        }
      }
    );

    // Custom secrets
    ipcMain.handle(
      'app:secrets:save-custom',
      async (_event: IpcMainInvokeEvent, key: string, value: string, description?: string) => {
        try {
          await this.secretsService.saveCustomSecret(key, value, description);
        } catch (error) {
          logger.error('Failed to save custom secret', error as Error, { key });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:get-custom',
      async (_event: IpcMainInvokeEvent, key: string): Promise<string | null> => {
        try {
          return await this.secretsService.getCustomSecret(key);
        } catch (error) {
          logger.error('Failed to get custom secret', error as Error, { key });
          throw error;
        }
      }
    );

    ipcMain.handle(
      'app:secrets:delete-custom',
      async (_event: IpcMainInvokeEvent, key: string): Promise<boolean> => {
        try {
          return await this.secretsService.deleteCustomSecret(key);
        } catch (error) {
          logger.error('Failed to delete custom secret', error as Error, { key });
          throw error;
        }
      }
    );

    // List secrets (metadata only)
    ipcMain.handle('app:secrets:list', async () => {
      try {
        return await this.secretsService.listSecrets();
      } catch (error) {
        logger.error('Failed to list secrets', error as Error);
        throw error;
      }
    });

    // Clear all secrets
    ipcMain.handle('app:secrets:clear-all', async (): Promise<number> => {
      try {
        return await this.secretsService.clearAllSecrets();
      } catch (error) {
        logger.error('Failed to clear all secrets', error as Error);
        throw error;
      }
    });

    // Migration
    ipcMain.handle(
      'app:secrets:migrate-from-store',
      async (_event: IpcMainInvokeEvent, storeData: Record<string, any>) => {
        try {
          return await this.secretsService.migrateFromStore(storeData);
        } catch (error) {
          logger.error('Failed to migrate secrets from store', error as Error);
          throw error;
        }
      }
    );

    // Check availability
    ipcMain.handle('app:secrets:is-available', async (): Promise<boolean> => {
      try {
        return await this.secretsService.isAvailable();
      } catch (error) {
        logger.error('Failed to check secrets availability', error as Error);
        return false;
      }
    });

    // Get metadata
    ipcMain.handle('app:secrets:get-metadata', () => {
      try {
        const metadata = this.secretsService.getMetadata();
        // Convert Map to array for serialization
        return Array.from(metadata.entries()).map(([key, value]) => ({
          key,
          ...value,
        }));
      } catch (error) {
        logger.error('Failed to get secrets metadata', error as Error);
        throw error;
      }
    });

    logger.info('Secrets IPC handlers registered');
  }

  /**
   * Unregister all handlers
   */
  unregister(): void {
    const channels = [
      'app:secrets:save-proxy',
      'app:secrets:get-proxy',
      'app:secrets:delete-proxy',
      'app:secrets:save-api-token',
      'app:secrets:get-api-token',
      'app:secrets:delete-api-token',
      'app:secrets:save-custom',
      'app:secrets:get-custom',
      'app:secrets:delete-custom',
      'app:secrets:list',
      'app:secrets:clear-all',
      'app:secrets:migrate-from-store',
      'app:secrets:is-available',
      'app:secrets:get-metadata',
    ];

    channels.forEach((channel) => {
      ipcMain.removeHandler(channel);
    });

    logger.info('Secrets IPC handlers unregistered');
  }
}
