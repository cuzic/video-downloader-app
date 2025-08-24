import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { sqlite, initializeDatabase } from './client';
import { settingsRepo, auditLogRepo } from './repositories';
import { dbBackup } from './backup';
import { runMigrations } from './migrate';

/**
 * Initialize the database system
 * This should be called once during app startup
 */
export async function initDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing database system...');

    // Ensure database directory exists
    const dbDir = path.join(app.getPath('userData'), 'database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Run migrations if needed
    const dbPath = path.join(dbDir, 'app.db');
    const isNewDatabase = !fs.existsSync(dbPath);

    if (isNewDatabase) {
      console.log('📦 Creating new database...');
      await runMigrations();
    } else {
      console.log('📂 Using existing database...');
      // Check if migrations are needed
      try {
        const migrationCheck = sqlite
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'`)
          .get();

        if (!migrationCheck) {
          console.log('🔄 Running pending migrations...');
          await runMigrations();
        }
      } catch (error) {
        console.error('Migration check failed:', error);
        await runMigrations();
      }
    }

    // Initialize database connection and pragmas
    await initializeDatabase();

    // Initialize default settings
    console.log('⚙️ Initializing default settings...');
    await settingsRepo.initializeDefaults();

    // Create auto-backup if needed
    console.log('💾 Checking backup status...');
    const backupPath = await dbBackup.createAutoBackup(24); // Daily backups
    if (backupPath) {
      await auditLogRepo.info('database', 'backup_created', `Auto-backup created: ${backupPath}`);
    }

    // Clean up old backups (keep last 10)
    const deletedBackups = await dbBackup.cleanupOldBackups(10);
    if (deletedBackups > 0) {
      await auditLogRepo.info(
        'database',
        'backup_cleanup',
        `Deleted ${deletedBackups} old backups`
      );
    }

    // Verify database integrity
    console.log('🔍 Verifying database integrity...');
    const isValid = await dbBackup.verifyIntegrity();
    if (!isValid) {
      await auditLogRepo.error(
        'database',
        'integrity_check_failed',
        new Error('Database integrity check failed')
      );
      throw new Error('Database integrity check failed');
    }

    // Log successful initialization
    await auditLogRepo.info('database', 'initialized', 'Database system initialized successfully', {
      isNewDatabase,
      dbPath,
    });

    console.log('✅ Database system initialized successfully!');

    // Set up periodic maintenance
    setupPeriodicMaintenance();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);

    // Try to log the error if possible
    try {
      await auditLogRepo.error('database', 'initialization_failed', error);
    } catch {
      // Ignore logging errors during initialization failure
    }

    throw error;
  }
}

/**
 * Setup periodic database maintenance tasks
 */
function setupPeriodicMaintenance(): void {
  // Daily backup at 3 AM
  const dailyBackup = setInterval(
    async () => {
      const hour = new Date().getHours();
      if (hour === 3) {
        try {
          const backupPath = await dbBackup.createBackup();
          await auditLogRepo.info(
            'database',
            'scheduled_backup',
            `Scheduled backup created: ${backupPath}`
          );
          await dbBackup.cleanupOldBackups(10);
        } catch (error) {
          await auditLogRepo.error('database', 'scheduled_backup_failed', error);
        }
      }
    },
    60 * 60 * 1000
  ); // Check every hour

  // Weekly cleanup of old data
  const weeklyCleanup = setInterval(
    async () => {
      const day = new Date().getDay();
      const hour = new Date().getHours();

      if (day === 0 && hour === 4) {
        // Sunday at 4 AM
        try {
          const {
            taskRepo,
            historyRepo,
            detectionRepo,
            statisticsRepo,
            auditLogRepo: auditRepo,
          } = await import('./repositories');

          // Clean up completed tasks older than 30 days
          const deletedTasks = await taskRepo.cleanup(30);

          // Clean up history older than 90 days
          const deletedHistory = await historyRepo.cleanup(90);

          // Clean up detections marked for deletion older than 7 days
          const deletedDetections = await detectionRepo.cleanupOld(7);

          // Clean up statistics older than 1 year
          const deletedStats = await statisticsRepo.cleanup(365);

          // Clean up audit logs older than 30 days (90 for errors)
          const deletedLogs = await auditRepo.cleanup(30);

          await auditLogRepo.info('database', 'scheduled_cleanup', 'Weekly cleanup completed', {
            deletedTasks,
            deletedHistory,
            deletedDetections,
            deletedStats,
            deletedLogs,
          });
        } catch (error) {
          await auditLogRepo.error('database', 'scheduled_cleanup_failed', error);
        }
      }
    },
    60 * 60 * 1000
  ); // Check every hour

  // Store interval IDs for cleanup
  (global as any).__dbMaintenanceIntervals = { dailyBackup, weeklyCleanup };
}

/**
 * Cleanup database maintenance tasks
 */
export function cleanupMaintenance(): void {
  const intervals = (global as any).__dbMaintenanceIntervals;
  if (intervals) {
    clearInterval(intervals.dailyBackup);
    clearInterval(intervals.weeklyCleanup);
    delete (global as any).__dbMaintenanceIntervals;
  }
}

/**
 * Shutdown database system gracefully
 */
export async function shutdownDatabase(): Promise<void> {
  try {
    console.log('🔌 Shutting down database system...');

    // Stop maintenance tasks
    cleanupMaintenance();

    // Log shutdown
    await auditLogRepo.info('database', 'shutdown', 'Database system shutting down');

    // Close database connection
    sqlite.close();

    console.log('✅ Database system shut down successfully');
  } catch (error) {
    console.error('❌ Database shutdown error:', error);
  }
}
