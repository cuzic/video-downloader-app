#!/usr/bin/env bun
/**
 * Initial setup script for development environment
 * Run with: bun run scripts/setup.ts or mise run setup
 */

import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

console.log('🚀 Setting up Video Downloader development environment...\n');

// Check Node version
const nodeVersion = await $`node --version`.text();
console.log(`✓ Node version: ${nodeVersion.trim()}`);

// Check Bun version
const bunVersion = await $`bun --version`.text();
console.log(`✓ Bun version: ${bunVersion.trim()}`);

// Create .env from .env.example if it doesn't exist
if (!existsSync('.env')) {
  if (existsSync('.env.example')) {
    copyFileSync('.env.example', '.env');
    console.log('✓ Created .env from .env.example');
  } else {
    console.warn('⚠ .env.example not found, skipping .env creation');
  }
} else {
  console.log('✓ .env already exists');
}

// Create necessary directories
const directories = [
  'data',
  'database',
  'database/backups',
  'logs',
  'tmp',
  'dist',
  'coverage',
];

directories.forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  } else {
    console.log(`✓ Directory exists: ${dir}`);
  }
});

// Install dependencies
console.log('\n📦 Installing dependencies...');
await $`bun install`;
console.log('✓ Dependencies installed');

// Setup git hooks
console.log('\n🔧 Setting up Git hooks...');
try {
  await $`bun run prepare`;
  console.log('✓ Git hooks configured');
} catch (error) {
  console.warn('⚠ Could not setup Git hooks (may already be configured)');
}

// Initialize database
console.log('\n🗄️ Initializing database...');
try {
  // Create database file if it doesn't exist
  const dbPath = join('data', 'video-downloader.db');
  if (!existsSync(dbPath)) {
    // Database will be created on first migration
    console.log('✓ Database will be created on first migration');
  } else {
    console.log('✓ Database already exists');
  }
  
  // Run migrations if available
  if (existsSync('src/main/db/migrate.ts')) {
    console.log('Running database migrations...');
    await $`bun run db:migrate`;
    console.log('✓ Database migrations completed');
  }
} catch (error) {
  console.warn('⚠ Database setup skipped (migrations may not be ready yet)');
}

// Type checking
console.log('\n🔍 Running type check...');
try {
  await $`bun run typecheck`;
  console.log('✓ TypeScript configuration is valid');
} catch (error) {
  console.warn('⚠ TypeScript errors found - please run "mise run typecheck" to see details');
}

// Display next steps
console.log('\n✅ Setup completed!\n');
console.log('Next steps:');
console.log('  1. Review and update .env with your configuration');
console.log('  2. Run "mise run dev" to start development server');
console.log('  3. Run "mise tasks" to see all available commands');
console.log('  4. Check docs/COMMANDS.md for command usage guide');
console.log('\nHappy coding! 🎉');