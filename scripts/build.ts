#!/usr/bin/env tsx

/**
 * Build script for production
 */

import { execa } from 'execa';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

// Build main process with esbuild
console.log('\n📦 Building main process...');
await execa('pnpm', [
  'exec', 'esbuild', 
  'src/main/index.ts', 
  '--bundle',
  '--outdir=dist/main', 
  '--platform=node',
  '--target=node20',
  '--format=esm',
  '--minify',
  '--sourcemap=external',
  '--external:electron',
  '--external:better-sqlite3',
  '--external:keytar',
  '--external:electron-store',
  '--external:winston',
  '--external:winston-daily-rotate-file',
  '--external:drizzle-orm'
], { cwd: rootDir });
console.log('  ✓ Main process built');

// Build preload script with esbuild
console.log('\n📦 Building preload script...');
await execa('pnpm', [
  'exec', 'esbuild',
  'src/preload/index.ts',
  '--bundle',
  '--outdir=dist/preload',
  '--platform=node',
  '--target=node20',
  '--format=esm',
  '--minify',
  '--sourcemap=external'
], { cwd: rootDir });
console.log('  ✓ Preload script built');

// Build renderer process with esbuild instead of Vite
console.log('\n📦 Building renderer process...');
await execa('pnpm', [
  'exec', 'esbuild',
  'src/renderer/main.tsx',
  '--bundle',
  '--outdir=dist/renderer',
  '--platform=browser',
  '--target=es2020',
  '--format=esm',
  '--minify',
  '--sourcemap=external',
  '--loader:.tsx=tsx',
  '--loader:.ts=ts',
  '--loader:.css=css'
], { cwd: rootDir });
console.log('  ✓ Renderer process built');

// Run TypeScript type checking
console.log('\n🔍 Running type check...');
try {
  await execa('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: rootDir });
  console.log('  ✓ Type check passed');
} catch (error) {
  console.error('  ✗ Type check failed');
  process.exit(1);
}

console.log('\n✅ Build completed successfully!');