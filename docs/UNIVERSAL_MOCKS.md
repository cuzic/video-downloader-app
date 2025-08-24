# Universal Mock System

## Overview

This project uses a universal mock system that works with both Bun and Vitest test runners, solving the compatibility issues with electron mocks.

## The Problem

- Vitest uses `vi.fn()` for creating mock functions
- Bun uses `jest.fn()` or custom mock implementations
- Electron mocks using `vi.fn()` fail in Bun tests with "vi is not defined"
- Previously required renaming test files to `.vitest.test.ts` to avoid electron imports in Bun

## The Solution

### 1. Universal Mock Utilities (`src/test/mock-utils.ts`)

Provides a `createMockFn()` function that:
- Detects the test runner environment
- Uses `vi.fn()` when running in Vitest
- Uses `jest.fn()` when available in Bun
- Falls back to a custom mock implementation when neither is available

```typescript
import { createMockFn } from '@/test/mock-utils';

// Works in both Bun and Vitest
const mockFunction = createMockFn(() => 'default value');
mockFunction.mockReturnValue('custom value');
```

### 2. Universal Electron Mock (`src/main/__mocks__/electron.ts`)

Uses `createMockFn()` instead of `vi.fn()`:

```typescript
import { createMockFn } from '@/test/mock-utils';

export const app = {
  getPath: createMockFn((name: string) => `/mock/path/${name}`),
  getVersion: createMockFn(() => '1.0.0-test'),
  // ... other mocks
};
```

### 3. Test Setup (`src/test/setup.ts`)

Conditionally configures mocks based on the test runner:

```typescript
if (isVitest()) {
  // Vitest-specific setup
  vi.mock('electron');
} else if (isBunTest()) {
  // Bun-specific setup
  // Uses Bun's mock.module() or other approaches
}
```

## Usage

### For Bun Tests

```typescript
import { describe, it, expect, mock } from 'bun:test';
import * as electronMock from '@/main/__mocks__/electron';

// Mock electron module
mock.module('electron', () => electronMock);

describe('My Test', () => {
  it('should use electron mocks', () => {
    const path = electronMock.app.getPath('userData');
    expect(path).toBe('/mock/path/userData');
  });
});
```

### For Vitest Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock electron module
vi.mock('electron', async () => {
  const electronMock = await import('@/main/__mocks__/electron');
  return electronMock;
});

import { app } from 'electron';

describe('My Test', () => {
  it('should use electron mocks', () => {
    const path = app.getPath('userData');
    expect(path).toBe('/mock/path/userData');
  });
});
```

## Mock Function API

The `createMockFn()` function returns a mock with the following methods:

- `mockClear()` - Clear call history
- `mockReset()` - Reset to initial state
- `mockImplementation(fn)` - Set implementation
- `mockImplementationOnce(fn)` - Set one-time implementation
- `mockReturnValue(value)` - Set return value
- `mockReturnValueOnce(value)` - Set one-time return value
- `mockResolvedValue(value)` - Set resolved promise value
- `mockResolvedValueOnce(value)` - Set one-time resolved value
- `mockRejectedValue(value)` - Set rejected promise value
- `mockRejectedValueOnce(value)` - Set one-time rejected value

### Mock Properties

- `mock.calls` - Array of call arguments
- `mock.results` - Array of call results

## Benefits

1. **No More File Renaming**: Tests can import electron regardless of test runner
2. **Consistent API**: Same mock API works in both environments
3. **Type Safety**: Full TypeScript support
4. **Easy Migration**: Existing tests require minimal changes
5. **Future Proof**: Easy to add support for new test runners

## Migration Guide

### From vi.fn() to createMockFn()

```typescript
// Before (only works in Vitest)
import { vi } from 'vitest';
const mockFn = vi.fn(() => 'value');

// After (works in both)
import { createMockFn } from '@/test/mock-utils';
const mockFn = createMockFn(() => 'value');
```

### From Renamed Test Files

```typescript
// Before: Had to rename to .vitest.test.ts
// src/main/handlers/__tests__/download.handler.vitest.test.ts

// After: Can use standard naming
// src/main/handlers/__tests__/download.handler.test.ts
```

## Troubleshooting

### Mock not resetting between tests

Ensure you're calling `mockClear()` or `mockReset()` in `beforeEach`:

```typescript
beforeEach(() => {
  if (typeof mockFn.mockClear === 'function') {
    mockFn.mockClear();
  }
});
```

### Mock tracking not working

The custom implementation always provides `mock.calls` and `mock.results`. Check that you're accessing them correctly:

```typescript
expect(mockFn.mock.calls).toHaveLength(1);
expect(mockFn.mock.calls[0]).toEqual(['arg1', 'arg2']);
```

### Module mocking differences

- **Bun**: Use `mock.module('electron', () => electronMock)`
- **Vitest**: Use `vi.mock('electron', async () => await import('@/main/__mocks__/electron'))`

## Related Files

- `src/test/mock-utils.ts` - Universal mock utilities
- `src/main/__mocks__/electron.ts` - Electron mock using universal system
- `src/test/setup.ts` - Test runner setup
- `src/test/mock-utils.bun.test.ts` - Tests for Bun compatibility
- `src/test/electron-mock.vitest.test.ts` - Tests for Vitest compatibility