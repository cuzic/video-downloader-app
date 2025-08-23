# Directory Structure

## Overview
This document describes the organized directory structure of the Video Downloader application after cleanup (Issue #32).

## Project Structure

```
src/
├── main/                   # Main process (Electron backend)
│   ├── db/                 # Database layer
│   │   ├── repositories/   # Repository pattern implementations
│   │   ├── schema/         # Database schemas (Drizzle ORM)
│   │   └── __tests__/      # Database tests
│   ├── ipc/                # IPC communication
│   │   ├── handlers/       # IPC request handlers
│   │   ├── utils/          # IPC utilities
│   │   └── __tests__/      # IPC tests
│   ├── security/           # Security modules
│   │   └── __tests__/      # Security tests
│   └── __mocks__/          # Mock files for testing
│
├── renderer/               # Renderer process (React frontend)
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Global styles and themes
│   └── utils/              # Frontend utilities
│
├── shared/                 # Shared between main and renderer
│   ├── constants/          # Shared constants
│   ├── types/              # TypeScript type definitions
│   ├── __tests__/          # Shared module tests
│   └── validation.ts       # Validation schemas and utilities
│
├── preload/                # Preload scripts (context bridge)
│   └── index.ts            # Main preload script
│
└── test/                   # Test configuration and utilities
    ├── setup.ts            # Test setup file
    └── *.test.ts           # Test files
```

## Directory Purposes

### Main Process (`/src/main`)

#### `/src/main/db`
- **Purpose**: Database management and data persistence
- **Contents**: SQLite/Drizzle ORM setup, repositories, schemas
- **Key Files**: 
  - `client.ts` - Database connection
  - `init.ts` - Database initialization
  - `backup.ts` - Backup utilities

#### `/src/main/ipc`
- **Purpose**: Inter-process communication handlers
- **Contents**: IPC handlers for main-renderer communication
- **Key Files**:
  - `handlers/` - Specific domain handlers (download, settings, system)
  - `utils/` - Error handling, performance utilities

#### `/src/main/security`
- **Purpose**: Security implementations
- **Contents**: Path validation, network security, CSP
- **Key Files**:
  - `path-validator.ts` - File path security
  - `network-security.ts` - Network request filtering

### Renderer Process (`/src/renderer`)

#### `/src/renderer/components`
- **Purpose**: React UI components
- **Contents**: Reusable UI components
- **Export Pattern**: Default exports (for React.lazy)

#### `/src/renderer/hooks`
- **Purpose**: Custom React hooks
- **Contents**: Business logic hooks
- **Export Pattern**: Named exports

#### `/src/renderer/styles`
- **Purpose**: Styling and theming
- **Contents**: Global styles, theme definitions

#### `/src/renderer/utils`
- **Purpose**: Frontend utility functions
- **Contents**: Formatters, helpers
- **Export Pattern**: Named exports

### Shared (`/src/shared`)

#### `/src/shared/constants`
- **Purpose**: Shared constant values
- **Contents**: Channel names, enums

#### `/src/shared/types`
- **Purpose**: TypeScript type definitions
- **Contents**: Shared interfaces and types
- **Export Pattern**: Type-only exports

#### `/src/shared/validation.ts`
- **Purpose**: Data validation schemas
- **Contents**: Zod schemas, validation utilities

### Preload (`/src/preload`)
- **Purpose**: Secure bridge between main and renderer
- **Contents**: Context bridge API exposure

### Test (`/src/test`)
- **Purpose**: Test configuration and utilities
- **Contents**: Test setup, mock utilities

## Removed Directories

The following empty or redundant directories were removed during cleanup:

- `/src/main/db/maintenance` - Empty, unused
- `/src/main/db/migrations` - Empty, migrations handled differently
- `/src/main/services` - Empty, functionality in handlers
- `/src/main/utils` - Empty, utilities in specific modules
- `/src/renderer/pages` - Empty, using components instead
- `/src/renderer/services` - Empty, logic in hooks
- `/src/renderer/store` - Empty, state management not yet implemented
- `/src/shared/utils` - Empty, utilities in validation.ts
- `/src/shared/validation/` - Consolidated to validation.ts
- `/src/utils` - Redundant, moved test to /src/test

## Import Path Aliases

The project uses TypeScript path aliases for cleaner imports:

- `@/` - Maps to `/src/`
- `@main/` - Maps to `/src/main/`
- `@renderer/` - Maps to `/src/renderer/`
- `@shared/` - Maps to `/src/shared/`
- `@preload/` - Maps to `/src/preload/`
- `@test/` - Maps to `/src/test/`

## Testing Structure

Tests are colocated with their source files in `__tests__` directories:
- Unit tests: `*.bun.test.ts` (Bun test runner)
- Integration tests: `*.vitest.test.ts` (Vitest)
- E2E tests: Located in `/e2e` directory

## Benefits of This Structure

1. **Clear Separation**: Main/Renderer/Shared boundaries are clear
2. **No Empty Directories**: All directories serve a purpose
3. **Consistent Testing**: Tests colocated with source
4. **Type Safety**: Shared types in dedicated location
5. **Security First**: Dedicated security module
6. **Scalable**: Easy to add new features in appropriate locations

## Maintenance Guidelines

1. **No Empty Directories**: Remove directories that become empty
2. **Colocate Tests**: Keep tests in `__tests__` next to source
3. **Follow Export Patterns**: 
   - Components: Default exports
   - Hooks/Utils: Named exports
   - Types: Type-only exports
4. **Use Path Aliases**: Prefer `@shared/` over relative imports
5. **Document Purpose**: Each directory should have clear purpose