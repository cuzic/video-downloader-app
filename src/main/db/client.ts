import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as schema from './schema';

// Get database connection based on environment
function getDatabaseConnection() {
  if (process.env.NODE_ENV === 'test') {
    // Create fresh in-memory database for each test run
    const sqlite = new Database(':memory:');

    // Create all tables manually since migrations might not exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        media_type TEXT NOT NULL,
        filename TEXT,
        save_dir TEXT,
        file_size INTEGER,
        status TEXT DEFAULT 'queued',
        progress REAL DEFAULT 0,
        percent REAL DEFAULT 0,
        speed_bps INTEGER,
        downloaded_bytes INTEGER DEFAULT 0,
        total_bytes INTEGER,
        eta_ms INTEGER,
        error TEXT,
        error_code TEXT,
        error_message TEXT,
        error_details TEXT,
        retry_count INTEGER DEFAULT 0,
        headers TEXT,
        variant TEXT,
        quality_rule TEXT,
        priority INTEGER DEFAULT 0,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        started_at INTEGER,
        paused_at INTEGER,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        type TEXT,
        description TEXT,
        updated_at INTEGER DEFAULT (unixepoch()),
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS detections (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        media_type TEXT NOT NULL,
        page_url TEXT,
        page_title TEXT,
        thumbnail_url TEXT,
        duration_sec REAL,
        file_size_bytes INTEGER,
        variants TEXT,
        headers TEXT,
        skip_reason TEXT,
        detected_at INTEGER DEFAULT (unixepoch()),
        last_seen_at INTEGER DEFAULT (unixepoch()),
        download_count INTEGER DEFAULT 0,
        auto_delete INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        event TEXT NOT NULL,
        details TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        segment_index INTEGER NOT NULL,
        url TEXT NOT NULL,
        duration_sec REAL,
        size_bytes INTEGER,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        temp_path TEXT,
        error_message TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        downloaded_at INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, segment_index)
      );

      CREATE TABLE IF NOT EXISTS statistics (
        date TEXT PRIMARY KEY,
        total_downloads INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        canceled_count INTEGER DEFAULT 0,
        total_bytes INTEGER DEFAULT 0,
        total_time_ms INTEGER DEFAULT 0,
        average_speed_bps REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS statistics_domains (
        date TEXT NOT NULL,
        domain TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        bytes INTEGER DEFAULT 0,
        PRIMARY KEY (date, domain),
        FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS statistics_media_types (
        date TEXT NOT NULL,
        media_type TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        bytes INTEGER DEFAULT 0,
        PRIMARY KEY (date, media_type),
        FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER DEFAULT (unixepoch()),
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        event TEXT NOT NULL,
        message TEXT,
        task_id TEXT,
        user_id TEXT,
        context TEXT,
        error_code TEXT,
        error_stack TEXT
      );
    `);

    const db = drizzle(sqlite, { schema });
    return { sqlite, db };
  } else {
    // Production/development database
    const { app } = require('electron');
    const dbPath = path.join(app.getPath('userData'), 'database', 'app.db');
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite, { schema });
    return { sqlite, db };
  }
}

const { sqlite, db } = getDatabaseConnection();

// Export the instances
export { sqlite };
export { db };
export type { BetterSQLite3Database };

// PRAGMA settings (run once at startup)
export function initializePragma(): void {
  sqlite.pragma('journal_mode = WAL'); // Crash resilience
  sqlite.pragma('synchronous = NORMAL'); // Balance between performance and safety
  sqlite.pragma('foreign_keys = ON'); // Enable foreign key constraints
  sqlite.pragma('busy_timeout = 5000'); // Lock timeout 5 seconds
  sqlite.pragma('cache_size = -10000'); // Cache size 10MB
  sqlite.pragma('auto_vacuum = INCREMENTAL'); // Automatic VACUUM
  sqlite.pragma('mmap_size = 30000000'); // Memory-mapped I/O 30MB
}

// Initialize database on app startup
export function initializeDatabase(): void {
  initializePragma();

  // Run custom migrations if needed
  runCustomMigrations();
}

// Execute custom SQL (constraints, views, triggers, etc.)
function runCustomMigrations(): void {
  // This will be implemented in migrations/custom
  // For now, just ensure the database is ready
  if (process.env.NODE_ENV !== 'test') {
    console.log('Database initialized');
  }
}

// Close database connection
export function closeDatabase(): void {
  sqlite.close();
}

// Transaction helper
export async function transaction<T>(
  callback: (tx: BetterSQLite3Database<typeof schema>) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await callback(tx);
  });
}

// Batch operation helper
export function batch<T>(operations: (() => T)[]): T[] {
  return sqlite.transaction(() => {
    return operations.map((op) => op());
  })();
}
