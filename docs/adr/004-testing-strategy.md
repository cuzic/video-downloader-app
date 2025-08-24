# ADR-004: Dual Test Runner Strategy (Bun and Vitest)

## Status
Accepted

## Context
The project needs a comprehensive testing strategy that can handle both simple unit tests and complex integration tests requiring mocks (especially for Electron APIs).

## Decision
We will use a dual test runner approach:
- **Bun test runner** for simple unit tests (`.bun.test.ts`)
- **Vitest** for tests requiring complex mocking (`.vitest.test.ts`)
- **Universal mock utilities** to ensure compatibility between both runners

## Consequences

### Positive
- **Performance**: Bun tests run extremely fast for simple cases
- **Flexibility**: Vitest provides powerful mocking for complex scenarios
- **Compatibility**: Universal mocks work with both runners
- **Developer experience**: Choose the right tool for each test type

### Negative
- **Complexity**: Two test runners to maintain
- **Learning curve**: Developers need to know when to use which
- **Configuration**: Separate configs for each runner

### Neutral
- Test files clearly indicate runner via extension
- Both runners can coexist in the same project
- CI/CD runs both test suites

## Implementation Details

### File Naming Convention
```
src/feature/__tests__/
├── simple.bun.test.ts      # Bun test (no mocking needed)
└── complex.vitest.test.ts  # Vitest test (requires mocks)
```

### Universal Mock System
```typescript
// src/test/mock-utils.ts
export function createMockFn(impl?: Function): MockFunction {
  if (typeof globalThis.vi !== 'undefined') {
    return globalThis.vi.fn(impl);
  }
  if (typeof globalThis.jest !== 'undefined') {
    return globalThis.jest.fn(impl);
  }
  // Fallback implementation
}
```

### When to Use Which

#### Use Bun Tests For:
- Pure functions
- Simple utilities
- Data transformations
- Validation logic
- No external dependencies

#### Use Vitest For:
- Electron API mocking
- Complex module mocking
- Timer-based tests
- File system mocking
- Network request mocking

## Migration Path
1. New tests default to Bun unless mocking needed
2. Gradually migrate simple Vitest tests to Bun
3. Keep Vitest for integration tests
4. Maintain universal mock compatibility