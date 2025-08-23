# Path Aliases Configuration

This project uses TypeScript's path mapping as the single source of truth for path aliases, which works seamlessly across TypeScript, Vite, Vitest, and Bun.

## Available Aliases

| Alias | Path | Description |
|-------|------|-------------|
| `@` | `src/` | Root source directory |
| `@main` | `src/main/` | Main process (Electron) code |
| `@renderer` | `src/renderer/` | Renderer process (React) code |
| `@shared` | `src/shared/` | Shared code between processes |
| `@preload` | `src/preload/` | Preload scripts |
| `@test` | `src/test/` | Test utilities and setup |

## Configuration

Path aliases are defined in `tsconfig.base.json` and automatically used by all tools:

- **TypeScript**: Native support via `tsconfig.json` (extends base)
- **Vite/Vitest**: Uses `vite-tsconfig-paths` plugin to read from tsconfig
- **Bun**: Native support - automatically reads tsconfig.json paths

## Usage Examples

```typescript
// Instead of relative imports
import { validateInput } from '../../../shared/validation';

// Use path aliases
import { validateInput } from '@shared/validation';
```

## Adding New Aliases

1. Edit `tsconfig.base.json` and add your new alias:
   ```json
   {
     "compilerOptions": {
       "paths": {
         // ... existing aliases
         "@newAlias/*": ["src/newPath/*"],
         "@newAlias": ["src/newPath"]
       }
     }
   }
   ```

2. The alias is immediately available in all environments (TypeScript, Vite, Vitest, Bun)

## Benefits

- **Single Source of Truth**: All aliases defined in tsconfig.base.json
- **Zero Sync Required**: Tools automatically read from tsconfig
- **Industry Standard**: Following TypeScript best practices
- **Type Safety**: Full TypeScript IntelliSense support
- **Clean Imports**: No more `../../../` relative paths