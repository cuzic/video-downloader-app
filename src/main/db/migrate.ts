#!/usr/bin/env bun
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';

async function runMigrations() {
  console.log('🚀 Running database migrations...');

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'video-downloader.db');
  const migrationsFolder = path.join(process.cwd(), 'drizzle');

  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  try {
    // Create database connection
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);

    // Enable foreign keys
    sqlite.pragma('foreign_keys = ON');

    // Run migrations
    console.log(`📁 Migrations folder: ${migrationsFolder}`);
    console.log(`💾 Database path: ${dbPath}`);

    await migrate(db, { migrationsFolder });

    console.log('✅ Migrations completed successfully!');

    // Close connection
    sqlite.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  runMigrations();
}

export { runMigrations };
