# Contributing to Video Downloader

Thank you for your interest in contributing to Video Downloader! This guide will help you understand our project structure and conventions.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Code Organization](#code-organization)
- [Testing Conventions](#testing-conventions)
- [Import/Export Patterns](#importexport-patterns)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/video-downloader-app.git`
3. Install dependencies: `mise install && mise run install`
4. Create a feature branch: `git checkout -b feat/your-feature`
5. Make your changes
6. Run tests: `mise run test`
7. Submit a pull request

## Project Structure

For detailed directory structure, see [docs/DIRECTORY_STRUCTURE.md](docs/DIRECTORY_STRUCTURE.md).

### Quick Reference

```
src/
├── main/           # Main process (Electron)
├── renderer/       # Renderer process (React UI)
├── preload/        # Preload scripts
├── shared/         # Shared code between processes
└── test/           # Test utilities and setup
```

## Code Organization

### Where to Place New Code

#### Components
- **Location**: `src/renderer/components/`
- **Convention**: One component per file
- **Example**: `src/renderer/components/Button.tsx`

#### React Hooks
- **Location**: `src/renderer/hooks/`
- **Convention**: Prefix with `use`
- **Example**: `src/renderer/hooks/useDownloadTasks.ts`

#### IPC Handlers
- **Location**: `src/main/ipc/handlers/`
- **Convention**: Group by feature
- **Example**: `src/main/ipc/handlers/download.handler.ts`

#### Database Repositories
- **Location**: `src/main/db/repositories/`
- **Convention**: One repository per entity
- **Example**: `src/main/db/repositories/task.repository.ts`

#### Database Schemas
- **Location**: `src/main/db/schema/`
- **Convention**: One schema per table
- **Example**: `src/main/db/schema/tasks.ts`

#### Shared Types
- **Location**: `src/shared/types/`
- **Convention**: Group by domain
- **Example**: `src/shared/types/download.types.ts`

#### Validation Schemas
- **Location**: `src/shared/validation.ts`
- **Convention**: Zod schemas for IPC validation
- **Example**: 
  ```typescript
  export const downloadSpecSchema = z.object({
    url: z.string().url(),
    outputPath: z.string()
  });
  ```

#### Utilities
- **Main Process**: `src/main/ipc/utils/`
- **Renderer Process**: `src/renderer/utils/`
- **Shared**: `src/shared/` (for cross-process utilities)

## Testing Conventions

### Test File Placement
Tests should be placed in `__tests__` directories next to the source code:

```
src/main/db/
├── repositories/
│   ├── __tests__/
│   │   └── task.repository.vitest.test.ts
│   └── task.repository.ts
```

### Test File Naming

#### Bun Tests (`.bun.test.ts`)
Use for simple unit tests that don't require mocking:
- Fast execution
- No complex mocking needed
- Example: `validation.bun.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';

describe('Validation', () => {
  it('should validate URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });
});
```

#### Vitest Tests (`.vitest.test.ts`)
Use for tests requiring mocks or Electron APIs:
- Complex mocking scenarios
- Electron API testing
- Example: `handlers.vitest.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Handler', () => {
  it('should handle IPC call', async () => {
    const mock = vi.fn();
    // ... test with mocks
  });
});
```

#### E2E Tests
- **Location**: `/e2e` directory
- **Naming**: `*.spec.ts`
- **Framework**: Playwright
- **Example**: `e2e/app.spec.ts`

### Running Tests

```bash
# All tests
mise run test

# Bun tests only
mise run test:bun

# Vitest tests only
mise run test:vitest

# E2E tests
mise run test:e2e

# With coverage
mise run test:coverage
```

## Import/Export Patterns

Following the conventions established in PR #38:

### Components (Default Exports)
```typescript
// src/renderer/components/Button.tsx
export default function Button() {
  return <button>Click me</button>;
}

// Usage
import Button from '@/renderer/components/Button';
```

### Hooks & Utilities (Named Exports)
```typescript
// src/renderer/hooks/useTheme.ts
export function useTheme() {
  // ... hook implementation
}

// src/renderer/utils/format.ts
export function formatDate(date: Date): string {
  // ... implementation
}

// Usage
import { useTheme } from '@/renderer/hooks/useTheme';
import { formatDate } from '@/renderer/utils/format';
```

### Types (Type-Only Exports)
```typescript
// src/shared/types/download.types.ts
export type DownloadStatus = 'pending' | 'downloading' | 'completed';
export interface DownloadTask {
  id: string;
  status: DownloadStatus;
}

// Usage
import type { DownloadTask } from '@/shared/types/download.types';
```

### Barrel Exports
Use `index.ts` files for convenient imports:

```typescript
// src/renderer/components/index.ts
export { default as Button } from './Button';
export { default as Dialog } from './Dialog';

// src/renderer/hooks/index.ts
export * from './useTheme';
export * from './useDownloadTasks';
```

## Development Workflow

### 1. Before Starting
- Check existing issues and PRs
- Ensure your branch is up to date with `main`
- Run `mise run check` to verify setup

### 2. During Development
- Write tests for new features
- Update types when changing interfaces
- Follow the code style guide
- Keep commits atomic and descriptive

### 3. Before Submitting
- Run all checks: `mise run check`
- Run tests: `mise run test`
- Update documentation if needed
- Ensure no empty directories (pre-commit hook will check)

## Code Style

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Define explicit return types for functions
- Use `type` imports for type-only imports

### React
- Functional components with hooks
- Use TypeScript interfaces for props
- Keep components focused and small

### General
- Use ESLint: `mise run lint`
- Format with Prettier: `mise run format`
- Maximum line length: 100 characters
- Use meaningful variable names

## Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

### Examples
```bash
feat(download): add pause/resume functionality
fix(ipc): handle timeout in download handler
docs: update contributing guide with test conventions
chore: update dependencies
```

## Pull Requests

### PR Guidelines

1. **Title**: Clear and descriptive
2. **Description**: Include:
   - What changes were made
   - Why they were necessary
   - How to test them
3. **Size**: Keep PRs focused and small
4. **Tests**: Include tests for new features
5. **Documentation**: Update if needed

### PR Template
```markdown
## Summary
Brief description of changes

## Problem
What issue does this solve?

## Solution
How does this solve it?

## Testing
How to test these changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No empty directories
- [ ] Lint and format checks pass
```

## Questions?

If you have questions:
1. Check existing issues
2. Ask in the PR or issue
3. Refer to [docs/](docs/) for more documentation

Thank you for contributing! 🎉