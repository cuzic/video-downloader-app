# Testing Guide

## Overview
This project uses a dual testing strategy:
- **Vitest** for tests that require extensive mocking (Electron, IPC, etc.)
- **Bun's native test runner** for simple unit tests
- **Playwright** for E2E tests

Test files are distinguished by their extensions:
- `*.vitest.test.ts` - Tests run with Vitest
- `*.bun.test.ts` - Tests run with Bun's native test runner
- `*.spec.ts` - E2E tests run with Playwright

## Running Tests

### All Tests
```bash
# Run all tests (Bun + Vitest)
bun run test

# Run only Bun tests
bun run test:bun

# Run only Vitest tests
bun run test:vitest

# Run tests in watch mode (Vitest only)
bun run test:watch

# Run tests with coverage (Vitest only)
bun run test:coverage
```

### E2E Tests
```bash
# Run E2E tests
bun run test:e2e
```

## Test Structure

```
src/
├── main/
│   ├── db/
│   │   └── repositories/
│   │       └── __tests__/     # Repository unit tests
│   ├── ipc/
│   │   └── handlers/
│   │       └── __tests__/     # IPC handler tests
│   └── __mocks__/              # Electron mocks
├── shared/
│   └── tests/                  # Shared utility tests
├── test/
│   └── setup.ts                # Global test setup
└── e2e/
    └── app.spec.ts             # E2E tests
```

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Mocking Electron
The project includes centralized Electron mocks in `src/main/__mocks__/electron.ts`. These are automatically loaded via the test setup.

### Test Conventions
- Test files should be named `*.test.ts` or `*.spec.ts`
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Keep tests isolated and independent

## Coverage
Coverage reports are generated in the `coverage/` directory. Aim for:
- 80% statement coverage
- 70% branch coverage
- 60% function coverage

## CI/CD
Tests run automatically on:
- Push to main branch
- Pull request creation
- Pre-commit hooks (via Husky)