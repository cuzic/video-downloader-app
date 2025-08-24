# Developer Onboarding Guide

Welcome to the Video Downloader project! This guide will help you get started with development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Key Concepts](#key-concepts)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)
- [Testing](#testing)
- [Resources](#resources)

## Prerequisites

### Required Software

1. **Bun** (latest version)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **mise** (for tool version management)
   ```bash
   curl https://mise.run | sh
   ```

3. **Git** (for version control)

4. **FFmpeg** (for video processing)
   - macOS: `brew install ffmpeg`
   - Ubuntu: `sudo apt install ffmpeg`
   - Windows: Download from [ffmpeg.org](https://ffmpeg.org)

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript
  - Bun for Visual Studio Code
- **GitHub CLI** (`gh`) for PR management

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/cuzic/video-downloader-app.git
cd video-downloader-app
```

### 2. Install Dependencies

```bash
# Install tool versions
mise install

# Install npm packages
mise run install
# or directly with bun
bun install
```

### 3. Environment Setup

Create a `.env` file (Bun loads this automatically):

```env
# Development settings
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug

# Paths (optional, defaults provided)
DOWNLOAD_PATH=~/Downloads
TEMP_PATH=/tmp/video-downloader
```

### 4. Verify Setup

```bash
# Run tests
mise run test

# Type checking
mise run typecheck

# Start development server
mise run dev
```

## Development Workflow

### Starting Development

```bash
# Start the app in development mode
mise run dev
# or
bun run scripts/dev.ts
```

This will:
1. Start the Electron app
2. Enable hot module replacement (HMR)
3. Open DevTools automatically
4. Watch for file changes

### Code Organization

```
src/
├── main/           # Main process (backend)
│   ├── db/        # Database layer
│   ├── ipc/       # IPC handlers
│   └── security/  # Security modules
├── renderer/       # Renderer process (frontend)
│   ├── components/# React components
│   ├── hooks/     # Custom hooks
│   └── styles/    # CSS files
├── preload/        # Preload scripts
└── shared/         # Shared code
    ├── types/     # TypeScript types
    └── validation.ts # Zod schemas
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Follow the conventions**
   - Components: Default exports
   - Hooks/Utils: Named exports
   - Types: Type-only exports
   - Tests: Co-located in `__tests__` directories

3. **Write tests**
   - Simple tests: `.bun.test.ts`
   - Complex mocks: `.vitest.test.ts`

4. **Run checks before committing**
   ```bash
   mise run check  # Runs lint, format, and typecheck
   ```

## Key Concepts

### 1. Process Separation

Electron uses multiple processes for security:

- **Main Process**: System access, database, downloads
- **Renderer Process**: UI only, no system access
- **Preload Script**: Secure bridge between processes

### 2. IPC Communication

All communication between processes uses typed IPC:

```typescript
// Renderer side
const result = await window.api.download.start({
  url: 'https://example.com/video.m3u8',
  outputPath: '/Downloads/video.mp4'
});

// Main side (handler)
ipcMain.handle('download:start', async (event, spec) => {
  // Validated with Zod
  const validated = downloadSpecSchema.parse(spec);
  return await downloadService.start(validated);
});
```

### 3. Database Access

Only the main process can access the database:

```typescript
// In main process
const task = await taskRepository.create({
  url: spec.url,
  outputPath: spec.outputPath,
  status: 'queued'
});

// Renderer gets data via IPC
const tasks = await window.api.tasks.getAll();
```

### 4. Security First

All inputs are validated:

```typescript
// Path validation
if (!PathValidator.isPathSafe(outputPath)) {
  throw new Error('Invalid output path');
}

// URL validation
if (!isValidStreamUrl(url)) {
  throw new Error('Invalid stream URL');
}
```

## Common Tasks

### Adding a New IPC Handler

1. Define types in `src/shared/types/`
2. Add validation in `src/shared/validation.ts`
3. Create handler in `src/main/ipc/handlers/`
4. Register in `src/main/ipc/index.ts`
5. Expose in `src/preload/index.ts`
6. Use in renderer components

### Adding a Database Table

1. Define schema in `src/main/db/schema/`
2. Create repository in `src/main/db/repositories/`
3. Generate migration: `mise run db:generate`
4. Apply migration: `mise run db:migrate`

### Creating a Component

```typescript
// src/renderer/components/MyComponent.tsx
export default function MyComponent() {
  return <div>Component content</div>;
}

// Add to barrel export
// src/renderer/components/index.ts
export { default as MyComponent } from './MyComponent';
```

### Writing Tests

```typescript
// Simple test (Bun)
// src/utils/__tests__/format.bun.test.ts
import { describe, it, expect } from 'bun:test';
import { formatBytes } from '../format';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });
});

// Complex test (Vitest)
// src/main/ipc/__tests__/handler.vitest.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('electron'); // Mocking available
```

## Debugging

### Main Process

1. Add breakpoints in VS Code
2. Use Debug configuration:
   ```json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug Main",
     "runtimeExecutable": "bun",
     "program": "${workspaceFolder}/src/main/index.ts"
   }
   ```

### Renderer Process

1. Open DevTools: `Cmd/Ctrl + Shift + I`
2. Use React DevTools extension
3. Console logging with proper context

### IPC Communication

```typescript
// Log IPC calls
ipcMain.on('*', (event, channel, ...args) => {
  console.log('IPC:', channel, args);
});
```

## Testing

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

### Test Organization

```
__tests__/
├── unit/          # Unit tests
├── integration/   # Integration tests
└── e2e/          # End-to-end tests
```

### Mocking

Use the universal mock system:

```typescript
import { createMockFn } from '@/test/mock-utils';

const mock = createMockFn(() => 'mocked');
mock.mockReturnValue('different');
```

## Resources

### Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture Decision Records](./adr/) - Key architectural decisions
- [Contributing Guidelines](../CONTRIBUTING.md) - Contribution process
- [Directory Structure](./DIRECTORY_STRUCTURE.md) - Project organization

### Key Technologies

- [Bun Documentation](https://bun.sh/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Drizzle ORM](https://orm.drizzle.team)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Internal Docs

- [Security Policy](./design/video-downloader/security-policy.md)
- [IPC Specification](./design/video-downloader/ipc-specification.md)
- [Database Schema](./design/video-downloader/database-schema.sql)

## Getting Help

1. Check existing documentation
2. Search closed issues on GitHub
3. Ask in PR comments
4. Create a new issue with:
   - Clear problem description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information

## Next Steps

1. ✅ Complete the setup
2. ✅ Run the development server
3. ✅ Make a small change and test it
4. ✅ Submit your first PR
5. 🎉 Welcome to the team!

## Tips for Success

- **Start small**: Pick a simple issue for your first contribution
- **Ask questions**: Better to ask than to guess
- **Test thoroughly**: Run tests before committing
- **Follow conventions**: Consistency is key
- **Document changes**: Update relevant docs with your code
- **Review others' PRs**: Great way to learn the codebase

Happy coding! 🚀