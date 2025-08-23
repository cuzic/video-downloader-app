#!/usr/bin/env bun

/**
 * Build script for production
 */

import { $ } from 'bun';
import { existsSync, rmSync } from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dir, '..');

console.log('🔨 Building Video Downloader...\n');

// Clean previous builds
console.log('📦 Cleaning previous builds...');
const distDirs = ['dist', 'dist-electron'];
for (const dir of distDirs) {
  const dirPath = path.join(rootDir, dir);
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
    console.log(`  ✓ Removed ${dir}`);
  }
}

// Build main process
console.log('\n📦 Building main process...');
await $`bun build src/main/index.ts --outdir dist/main --target node --minify --sourcemap=external`;
console.log('  ✓ Main process built');

// Build preload script
console.log('\n📦 Building preload script...');
await $`bun build src/preload/index.ts --outdir dist/preload --target node --minify --sourcemap=external`;
console.log('  ✓ Preload script built');

// Build renderer process with Vite
console.log('\n📦 Building renderer process...');
await $`bunx vite build`;
console.log('  ✓ Renderer process built');

// Run TypeScript type checking
console.log('\n🔍 Running type check...');
try {
  await $`bunx tsc --noEmit`;
  console.log('  ✓ Type check passed');
} catch (error) {
  console.error('  ✗ Type check failed');
  process.exit(1);
}

console.log('\n✅ Build completed successfully!');