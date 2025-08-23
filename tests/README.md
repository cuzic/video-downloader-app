# Test Suite

This directory contains all tests for the Video Downloader application.

## Structure

```
tests/
├── unit/           # Unit tests for individual functions/modules
├── e2e/            # End-to-end tests using Playwright
└── README.md       # This file
```

## Running Tests

### All Tests
```bash
mise run test
# or
bun test
```

### Unit Tests Only
```bash
mise run test:unit
# or
bun test tests/unit
```

### E2E Tests Only
```bash
mise run test:e2e
# or
bun run test:e2e
```

### Watch Mode
```bash
mise run test:watch
# or
bun test --watch
```

### Coverage
```bash
mise run test:coverage
# or
bun test --coverage
```

## Writing Tests

### Unit Tests
- Place unit tests in `tests/unit/`
- Name files with `.test.ts` or `.spec.ts` suffix
- Test individual functions, classes, or modules
- Mock external dependencies

### E2E Tests
- Place E2E tests in `tests/e2e/`
- Name files with `.e2e.test.ts` suffix
- Test complete user workflows
- Use Playwright for Electron testing

## Test Conventions

1. **File Naming**: `<feature>.test.ts` or `<feature>.e2e.test.ts`
2. **Test Structure**: Use `describe` blocks for grouping related tests
3. **Assertions**: Use Bun's built-in `expect` API
4. **Setup/Teardown**: Use `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
5. **Async Tests**: Always use `async/await` for asynchronous operations

## Example Test

```typescript
import { describe, it, expect } from 'bun:test';

describe('Feature Name', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

## Mocking

For mocking in Bun tests:

```typescript
import { mock } from 'bun:test';

const mockFn = mock(() => 'mocked value');
expect(mockFn()).toBe('mocked value');
expect(mockFn).toHaveBeenCalled();
```

## CI Integration

Tests are automatically run in CI via:
```yaml
- run: mise run test
```

## Debugging Tests

To debug a specific test:
```bash
bun test tests/unit/specific.test.ts --inspect
```

Then connect with Chrome DevTools or VS Code debugger.