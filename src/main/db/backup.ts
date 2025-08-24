import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import crypto from 'crypto';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

export class DatabaseBackup {
  private dbPath: string;
  private backupDir: string;
  private encryptionKey?: string;

  constructor(dbPath?: string, encryptionKey?: string) {
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'database', 'app.db');
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.encryptionKey = encryptionKey || this.getOrCreateEncryptionKey();
    this.ensureBackupDirectory();
  }

  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(app.getPath('userData'), '.backup-key');

    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf-8');
    }

    // Generate new key
    const key = crypto.randomBytes(32).toString('base64');
    fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Restrict file permissions
    return key;
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private encrypt(data: Buffer): Buffer {
    if (!this.encryptionKey) throw new Error('Encryption key not set');

    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, ITERATIONS, 32, 'sha256');
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Combine salt, iv, tag, and encrypted data
    return Buffer.concat([salt, iv, tag, encrypted]);
  }

  private decrypt(encryptedData: Buffer): Buffer {
    if (!this.encryptionKey) throw new Error('Encryption key not set');

    // Extract components
    const salt = encryptedData.slice(0, SALT_LENGTH);
    const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = encryptedData.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedData.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, ITERATIONS, 32, 'sha256');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Create a backup of the database
   * @param compress Whether to compress the backup
   * @param encrypt Whether to encrypt the backup
   * @returns Path to the backup file
   */
  async createBackup(compress = true, encrypt = true): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = encrypt ? '.enc' : compress ? '.gz' : '.db';
    const backupName = `backup-${timestamp}${extension}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // Open source database
      const sourceDb = new Database(this.dbPath, { readonly: true });

      let backupData: Buffer;

      // Export database to buffer
      const data = await this.exportToBuffer(sourceDb);

      // Compress if requested
      if (compress) {
        backupData = await gzipAsync(data);
      } else {
        backupData = data;
      }

      // Encrypt if requested
      if (encrypt) {
        backupData = this.encrypt(backupData);
      }

      // Write to file
      fs.writeFileSync(backupPath, backupData);
      sourceDb.close();

      console.log(
        `✅ Backup created: ${backupPath} (compressed: ${compress}, encrypted: ${encrypt})`
      );
      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore database from a backup
   * @param backupPath Path to the backup file
   * @param targetPath Optional target database path
   */
  async restoreBackup(backupPath: string, targetPath?: string): Promise<void> {
    const target = targetPath || this.dbPath;

    try {
      // Check if backup exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Create a safety backup of current database
      if (fs.existsSync(target)) {
        const safetyBackup = `${target}.before-restore-${Date.now()}`;
        fs.copyFileSync(target, safetyBackup);
        console.log(`📦 Safety backup created: ${safetyBackup}`);
      }

      let data: Buffer = fs.readFileSync(backupPath);

      // Decrypt if encrypted
      if (backupPath.endsWith('.enc')) {
        data = this.decrypt(data);

        // Check if decrypted data is compressed
        if (data[0] === 0x1f && data[1] === 0x8b) {
          // Gzip magic numbers
          data = await gunzipAsync(data);
        }
      } else if (backupPath.endsWith('.gz')) {
        // Just decompress
        data = await gunzipAsync(data);
      }

      // Write restored data
      fs.writeFileSync(target, data);

      // Verify restored database
      const db = new Database(target);
      db.pragma('integrity_check');
      db.close();

      console.log(`✅ Database restored from: ${backupPath}`);
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  listBackups(): Array<{
    name: string;
    path: string;
    size: number;
    created: Date;
    compressed: boolean;
    encrypted: boolean;
  }> {
    const files = fs.readdirSync(this.backupDir);

    return files
      .filter(
        (f) =>
          f.startsWith('backup-') && (f.endsWith('.db') || f.endsWith('.gz') || f.endsWith('.enc'))
      )
      .map((name) => {
        const filePath = path.join(this.backupDir, name);
        const stats = fs.statSync(filePath);

        return {
          name,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          compressed: name.endsWith('.gz'),
          encrypted: name.endsWith('.enc'),
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Clean up old backups
   * @param keepCount Number of backups to keep
   */
  async cleanupOldBackups(keepCount = 10): Promise<number> {
    const backups = this.listBackups();
    let deletedCount = 0;

    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount);

      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
          deletedCount++;
          console.log(`🗑️ Deleted old backup: ${backup.name}`);
        } catch (error) {
          console.error(`Failed to delete ${backup.name}:`, error);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Create an automated backup if needed
   * @param intervalHours Minimum hours between backups
   */
  async createAutoBackup(intervalHours = 24): Promise<string | null> {
    const backups = this.listBackups();

    if (backups.length > 0) {
      const lastBackup = backups[0];
      const hoursSinceLastBackup =
        (Date.now() - (lastBackup?.created.getTime() || 0)) / (1000 * 60 * 60);

      if (hoursSinceLastBackup < intervalHours) {
        console.log(
          `⏰ Skipping auto-backup (last backup ${hoursSinceLastBackup.toFixed(1)}h ago)`
        );
        return null;
      }
    }

    return this.createBackup();
  }

  /**
   * Export database to a JSON format
   */
  async exportToJson(outputPath?: string): Promise<string> {
    const exportPath = outputPath || path.join(this.backupDir, `export-${Date.now()}.json`);

    try {
      const db = new Database(this.dbPath, { readonly: true });
      const tables = this.getTableNames(db);
      const data: Record<string, any[]> = {};

      for (const table of tables) {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all();
      }

      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      db.close();

      console.log(`✅ Exported to JSON: ${exportPath}`);
      return exportPath;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  /**
   * Import database from JSON
   */
  async importFromJson(jsonPath: string, targetPath?: string): Promise<void> {
    const target = targetPath || this.dbPath;

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const db = new Database(target);

      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        for (const [table, rows] of Object.entries(jsonData)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          // Clear existing data
          db.prepare(`DELETE FROM ${table}`).run();

          // Insert new data
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const stmt = db.prepare(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
          );

          for (const row of rows) {
            stmt.run(...columns.map((col) => row[col]));
          }
        }
      })();

      db.pragma('foreign_keys = ON');
      db.close();

      console.log(`✅ Imported from JSON: ${jsonPath}`);
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Calculate checksum of database
   */
  async calculateChecksum(): Promise<string> {
    const data = fs.readFileSync(this.dbPath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify database integrity
   */
  async verifyIntegrity(): Promise<boolean> {
    try {
      const db = new Database(this.dbPath, { readonly: true });
      const result = db.pragma('integrity_check');
      db.close();

      return (result as any)[0]?.integrity_check === 'ok';
    } catch (error) {
      console.error('❌ Integrity check failed:', error);
      return false;
    }
  }

  // Private helper methods
  private async exportToBuffer(db: any): Promise<Buffer> {
    const tables = this.getTableNames(db);
    const data: Record<string, any[]> = {};

    for (const table of tables) {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    }

    return Buffer.from(JSON.stringify(data));
  }

  private getTableNames(db: any): string[] {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;

    return tables.map((t) => t.name);
  }
}

// Export singleton instance
export const dbBackup = new DatabaseBackup();
