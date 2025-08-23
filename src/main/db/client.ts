import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import { app } from 'electron';
import * as schema from './schema';

// SQLite connection instance
const dbPath = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(app.getPath('userData'), 'database', 'app.db');

export const sqlite = new Database(dbPath);

// Drizzle ORM instance
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

// PRAGMA settings (run once at startup)
export function initializePragma(): void {
  sqlite.pragma('journal_mode = WAL');            // Crash resilience
  sqlite.pragma('synchronous = NORMAL');          // Balance between performance and safety
  sqlite.pragma('foreign_keys = ON');             // Enable foreign key constraints
  sqlite.pragma('busy_timeout = 5000');           // Lock timeout 5 seconds
  sqlite.pragma('cache_size = -10000');           // Cache size 10MB
  sqlite.pragma('auto_vacuum = INCREMENTAL');     // Automatic VACUUM
  sqlite.pragma('mmap_size = 30000000');          // Memory-mapped I/O 30MB
}

// Initialize database on app startup
export async function initializeDatabase(): Promise<void> {
  initializePragma();
  
  // Run custom migrations if needed
  await runCustomMigrations();
}

// Execute custom SQL (constraints, views, triggers, etc.)
async function runCustomMigrations(): Promise<void> {
  // This will be implemented in migrations/custom
  // For now, just ensure the database is ready
  console.log('Database initialized at:', dbPath);
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
    return operations.map(op => op());
  })();
}