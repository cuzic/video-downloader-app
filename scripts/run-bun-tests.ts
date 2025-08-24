#!/usr/bin/env bun

import { $ } from 'bun';
import { Glob } from 'bun';
import { join } from 'path';

async function runBunTests() {
  // Find all .bun.test.ts files in the src directory
  const glob = new Glob('src/**/*.bun.test.{ts,tsx}');
  const files = [];

  for await (const file of glob.scan('.')) {
    files.push(file);
  }

  if (files.length === 0) {
    console.error('No .bun.test.ts files found in src directory');
    process.exit(1);
  }

  console.log(`Found ${files.length} bun test files:`);
  files.forEach((file) => console.log(`  - ${file}`));

  // Determine if we should run with coverage based on environment or arguments
  const withCoverage = process.argv.includes('--coverage') || process.env.CI === 'true';

  // Build the command
  const args = ['test', ...files];
  if (withCoverage) {
    args.push('--coverage');
  }

  // Run bun test with the found files
  console.log(`\nRunning: bun ${args.join(' ')}`);
  const result = await $`bun ${args}`.nothrow();

  // Exit with the same code as bun test
  process.exit(result.exitCode ?? 0);
}

runBunTests().catch((error) => {
  console.error('Error running bun tests:', error);
  process.exit(1);
});
