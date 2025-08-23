#!/usr/bin/env bun

/**
 * Development server script
 * Runs main, preload, and renderer processes concurrently
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dir, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(process: string, message: string, color: string = colors.reset) {
  console.log(`${color}[${process}]${colors.reset} ${message}`);
}

// Start Vite for renderer process
const viteProcess = spawn('bunx', ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

// Build and watch preload script
const preloadProcess = spawn(
  'bun',
  ['build', 'src/preload/index.ts', '--outdir', 'dist/preload', '--watch'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  }
);

// Build and watch main process
const mainProcess = spawn(
  'bun',
  ['build', 'src/main/index.ts', '--outdir', 'dist/main', '--watch'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  }
);

// Start Electron when main process is built
setTimeout(() => {
  const electronProcess = spawn('bunx', ['electron', '.', '--dev'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electronProcess.on('close', (code) => {
    log('Electron', `Process exited with code ${code}`, colors.yellow);
    process.exit(code || 0);
  });
}, 2000);

// Handle process termination
process.on('SIGINT', () => {
  log('Dev', 'Shutting down development server...', colors.yellow);
  viteProcess.kill();
  preloadProcess.kill();
  mainProcess.kill();
  process.exit(0);
});

log('Dev', 'Starting development server...', colors.green);
log('Dev', 'Main process: watching for changes', colors.blue);
log('Dev', 'Preload script: watching for changes', colors.magenta);
log('Dev', 'Renderer process: Vite dev server starting', colors.cyan);