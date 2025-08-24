#!/usr/bin/env node

/**
 * Pre-commit hook script to check for empty directories
 * Works cross-platform (Windows, Mac, Linux)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to check for empty folders
const DIRS_TO_CHECK = ['src'];

// Directories that are allowed to be empty (if any)
const ALLOWED_EMPTY_DIRS = [
  // Add any intentionally empty directories here
  // Example: 'src/assets/placeholder'
];

/**
 * Recursively find all empty directories
 * @param {string} dir - Directory to search
 * @param {string[]} emptyDirs - Array to collect empty directories
 * @returns {string[]} - Array of empty directory paths
 */
function findEmptyDirs(dir, emptyDirs = []) {
  try {
    const items = fs.readdirSync(dir);

    // Check if directory is empty (no files or subdirectories)
    if (items.length === 0) {
      emptyDirs.push(dir);
      return emptyDirs;
    }

    // Check subdirectories
    let hasFiles = false;
    const subdirs = [];

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and .git directories
        if (item === 'node_modules' || item === '.git') {
          hasFiles = true; // Consider these as "content"
          continue;
        }
        subdirs.push(fullPath);
      } else {
        hasFiles = true;
      }
    }

    // Recursively check subdirectories
    for (const subdir of subdirs) {
      findEmptyDirs(subdir, emptyDirs);
    }

    // If only empty subdirectories exist, this directory is effectively empty
    if (!hasFiles && subdirs.length > 0) {
      const allSubdirsEmpty = subdirs.every(
        (subdir) => emptyDirs.includes(subdir) || isEffectivelyEmpty(subdir, emptyDirs)
      );

      if (allSubdirsEmpty) {
        emptyDirs.push(dir);
      }
    }
  } catch (err) {
    console.error(`Error checking directory ${dir}:`, err.message);
  }

  return emptyDirs;
}

/**
 * Check if a directory is effectively empty (contains only empty directories)
 * @param {string} dir - Directory to check
 * @param {string[]} knownEmptyDirs - Already identified empty directories
 * @returns {boolean} - True if effectively empty
 */
function isEffectivelyEmpty(dir, knownEmptyDirs) {
  try {
    const items = fs.readdirSync(dir);

    if (items.length === 0) {
      return true;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (!stat.isDirectory()) {
        return false; // Has files, not empty
      }

      if (!knownEmptyDirs.includes(fullPath) && !isEffectivelyEmpty(fullPath, knownEmptyDirs)) {
        return false; // Has non-empty subdirectory
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Main function to check for empty directories
 */
function main() {
  console.log('🔍 Checking for empty directories...\n');

  const allEmptyDirs = [];

  for (const dir of DIRS_TO_CHECK) {
    if (fs.existsSync(dir)) {
      findEmptyDirs(dir, allEmptyDirs);
    }
  }

  // Filter out allowed empty directories
  const problematicDirs = allEmptyDirs.filter((dir) => {
    const normalizedDir = path.normalize(dir).replace(/\\/g, '/');
    return !ALLOWED_EMPTY_DIRS.some((allowed) =>
      normalizedDir.includes(path.normalize(allowed).replace(/\\/g, '/'))
    );
  });

  if (problematicDirs.length > 0) {
    console.error('❌ Empty directories found:\n');
    problematicDirs.forEach((dir) => {
      console.error(`   • ${dir}`);
    });
    console.error(
      '\n💡 Please remove these empty directories or add them to ALLOWED_EMPTY_DIRS in scripts/check-empty-dirs.js\n'
    );
    process.exit(1);
  }

  console.log('✅ No empty directories found\n');
  process.exit(0);
}

// Run if called directly
main();
