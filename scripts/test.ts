#!/usr/bin/env bun

/**
 * Test runner script
 */

import { $ } from 'bun';
import { parseArgs } from 'util';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    watch: {
      type: 'boolean',
      short: 'w',
    },
    coverage: {
      type: 'boolean',
      short: 'c',
    },
    ui: {
      type: 'boolean',
    },
    unit: {
      type: 'boolean',
    },
    e2e: {
      type: 'boolean',
    },
  },
  strict: false,
  allowPositionals: true,
});

console.log('🧪 Running tests...\n');

const args: string[] = [];

// Add test patterns based on type
if (values.unit) {
  args.push('src/**/*.test.ts', 'src/**/*.test.tsx');
  console.log('  Running unit tests...');
} else if (values.e2e) {
  console.log('  Running E2E tests...');
  await $`bunx playwright test`;
  process.exit(0);
} else {
  // Run all tests by default
  console.log('  Running all tests...');
}

// Add options
if (values.watch) {
  args.push('--watch');
  console.log('  Watch mode enabled');
}

if (values.coverage) {
  args.push('--coverage');
  console.log('  Coverage enabled');
}

// Run tests with Bun
try {
  await $`bun test ${args}`;
  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Some tests failed');
  process.exit(1);
}