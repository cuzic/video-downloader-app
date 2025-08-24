# Project Directory Structure

This document describes the organization of the Video Downloader codebase after the cleanup in PR #39.

## Overview

The project follows a clear separation between Electron's main process, renderer process, and shared code.

```
video-downloader-app/
├── .github/            # GitHub Actions workflows
├── .husky/             # Git hooks
├── docs/               # Documentation
├── e2e/                # End-to-end tests
├── scripts/            # Build and utility scripts
├── src/                # Source code
├── tests/              # Additional test files
└── [config files]      # Various configuration files
```

## Source Code Structure (`/src`)

### `/src/main` - Main Process (Electron Backend)

The main process handles system-level operations, database access, and download management.

```
src/main/
├── index.ts                     # Main process entry point
├── db/                          # Database layer
│   ├── client.ts               # SQLite client setup
│   ├── init.ts                 # Database initialization
│   ├── migrate.ts              # Migration runner
│   ├── backup.ts               # Backup utilities
│   ├── validation.ts           # DB-specific validation
│   ├── repositories/           # Data access layer
│   │   ├── __tests__/         # Repository tests
│   │   ├── index.ts           # Barrel export
│   │   ├── task.repository.ts # Download tasks
│   │   ├── segment.repository.ts
│   │   ├── settings.repository.ts
│   │   ├── history.repository.ts
│   │   ├── detection.repository.ts
│   │   ├── statistics.repository.ts
│   │   └── audit-log.repository.ts
│   └── schema/                 # Database schemas (Drizzle)
│       ├── index.ts
│       ├── tasks.ts
│       ├── segments.ts
│       ├── settings.ts
│       ├── history.ts
│       ├── detections.ts
│       ├── statistics.ts
│       └── audit-logs.ts
├── ipc/                        # Inter-Process Communication
│   ├── index.ts               # IPC setup and registration
│   ├── types.ts               # IPC-specific types
│   ├── handlers/              # IPC message handlers
│   │   ├── __tests__/
│   │   ├── download.handler.ts
│   │   ├── settings.handler.ts
│   │   └── system.handler.ts
│   └── utils/                 # IPC utilities
│       ├── error-handler.ts  # Error handling wrapper
│       └── performance.ts    # Rate limiting, caching
└── security/                  # Security modules
    ├── __tests__/
    ├── csp.ts                # Content Security Policy
    ├── path-validator.ts      # Path traversal prevention
    ├── network-security.ts    # SSRF prevention
    ├── drm-detector.ts        # DRM detection
    └── legal-consent.ts       # Terms acceptance
```

### `/src/renderer` - Renderer Process (React UI)

The renderer process contains the React application and UI components.

```
src/renderer/
├── index.html              # HTML entry point
├── main.tsx               # React app entry point
├── App.tsx                # Root component
├── components/            # React components
│   ├── index.ts          # Barrel export
│   ├── Button.tsx        # UI components
│   └── Dialog.tsx
├── hooks/                 # Custom React hooks
│   ├── index.ts
│   ├── useTheme.ts
│   └── useDownloadTasks.ts
├── styles/                # CSS/styling
│   └── index.css
└── utils/                 # Renderer utilities
    ├── index.ts
    └── format.ts         # Formatting helpers
```

### `/src/preload` - Preload Scripts

Bridge between main and renderer processes with security context.

```
src/preload/
├── index.ts              # Preload script
└── types.d.ts           # Window API types
```

### `/src/shared` - Shared Code

Code used by both main and renderer processes.

```
src/shared/
├── constants/            # Shared constants
│   └── channels.ts      # IPC channel names
├── types/               # Shared TypeScript types
│   ├── index.ts        # Barrel export
│   ├── ipc.types.ts    # IPC message types
│   ├── download.types.ts
│   ├── media.types.ts
│   ├── settings.types.ts
│   └── error.types.ts
├── validation.ts        # Zod validation schemas
└── __tests__/          # Shared code tests
    └── validation.bun.test.ts
```

### `/src/test` - Test Utilities

Test setup and utilities.

```
src/test/
├── setup.ts            # Test environment setup
├── alias-test.bun.test.ts
└── alias-test.vitest.test.ts
```

## Testing Structure

### Test File Organization

Tests are co-located with source files in `__tests__` directories:

```
feature/
├── __tests__/
│   ├── feature.bun.test.ts      # Bun unit tests
│   └── feature.vitest.test.ts   # Vitest tests (with mocks)
└── feature.ts
```

### Test Types

1. **Unit Tests (`.bun.test.ts`)**
   - Simple, fast unit tests
   - No complex mocking required
   - Run with: `bun test`

2. **Integration Tests (`.vitest.test.ts`)**
   - Tests requiring mocks
   - Electron API testing
   - Run with: `vitest`

3. **E2E Tests (`/e2e/*.spec.ts`)**
   - Full application testing
   - Playwright-based
   - Run with: `playwright test`

## Configuration Files

### Root Directory Configs

```
.
├── bunfig.toml         # Bun configuration
├── .mise.toml          # Tool versions and tasks
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vitest.config.ts    # Vitest test configuration
├── playwright.config.ts # E2E test configuration
├── .eslintrc.json      # ESLint rules
├── .prettierrc         # Code formatting
└── .lintstagedrc.json  # Pre-commit hooks config
```

## Build Output Structure

```
dist/                   # Build output
├── main/              # Compiled main process
├── preload/           # Compiled preload scripts
└── renderer/          # Compiled renderer process

dist-electron/         # Electron distribution packages
├── mac/
├── win/
└── linux/
```

## Key Principles

### 1. Separation of Concerns
- Main process: System operations, database, downloads
- Renderer process: UI and user interactions
- Preload: Secure bridge with minimal API surface

### 2. Co-location
- Tests next to source files
- Related code grouped together
- Clear module boundaries

### 3. Type Safety
- Shared types in `/src/shared/types`
- Zod validation for IPC messages
- Strict TypeScript configuration

### 4. Security First
- All security modules in `/src/main/security`
- Input validation at boundaries
- Path and network security enforced

## Import Aliases

The project uses TypeScript path aliases:

```typescript
// Instead of: import { something } from '../../../shared/types';
import { something } from '@/shared/types';

// Aliases:
@/main/*     -> src/main/*
@/renderer/* -> src/renderer/*
@/shared/*   -> src/shared/*
@/preload/*  -> src/preload/*
```

## Adding New Features

When adding new features, follow this structure:

1. **Types**: Define in `/src/shared/types/`
2. **Validation**: Add schemas to `/src/shared/validation.ts`
3. **Database**: Create schema in `/src/main/db/schema/`
4. **Repository**: Add to `/src/main/db/repositories/`
5. **IPC Handler**: Create in `/src/main/ipc/handlers/`
6. **UI Components**: Add to `/src/renderer/components/`
7. **Hooks**: Create in `/src/renderer/hooks/`
8. **Tests**: Add `__tests__` directory next to source

## Maintenance

### Preventing Empty Directories
A pre-commit hook (added in PR #41) prevents committing empty directories. See [EMPTY_DIRECTORIES.md](EMPTY_DIRECTORIES.md).

### Code Quality
- ESLint for linting
- Prettier for formatting
- TypeScript for type checking
- Husky for git hooks
- lint-staged for pre-commit checks

## Recent Changes

### PR #39 - Directory Cleanup
- Removed 8 empty directories
- Consolidated validation files
- Organized test structure
- Documented structure

### PR #41 - Empty Directory Prevention
- Added pre-commit hook
- Automated empty directory detection

### PR #38 - Import/Export Conventions
- Standardized component exports (default)
- Standardized hook/util exports (named)
- Established type-only exports