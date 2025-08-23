# Import/Export Conventions

This project follows a consistent pattern for imports and exports optimized for React + Electron architecture.

## 📋 Quick Reference

| Module Type | Export Style | Import Example |
|------------|--------------|----------------|
| **UI Components** | `export default` | `import Button from '@renderer/components/Button'` |
| **Pages** | `export default` | `import HomePage from '@renderer/pages/Home'` |
| **Hooks** | `export function` | `import { useTheme } from '@renderer/hooks'` |
| **Utils/Helpers** | `export function` | `import { formatBytes } from '@renderer/utils'` |
| **Types** | `export type` | `import type { DownloadSpec } from '@shared/types'` |
| **Constants** | `export const` | `import { DOWNLOAD_CHANNELS } from '@shared/constants'` |
| **Main/Preload** | `export function` | Named exports only |
| **Shared** | `export` (named) | Named exports only (no defaults) |

## 🎯 Core Rules

### 1. UI Components = Default Export

```typescript
// src/renderer/components/Button.tsx
function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}

export default Button;
```

**Barrel re-export:**
```typescript
// src/renderer/components/index.ts
export { default as Button } from './Button';
export { default as Dialog } from './Dialog';
```

**Usage:**
```typescript
// Direct import
import Button from '@renderer/components/Button';

// Via barrel
import { Button, Dialog } from '@renderer/components';
```

### 2. Hooks/Utils/Types = Named Export

```typescript
// src/renderer/hooks/useTheme.ts
export function useTheme() {
  const [theme, setTheme] = useState('light');
  return { theme, setTheme };
}

// src/renderer/utils/format.ts
export function formatBytes(bytes: number): string {
  // ...
}

// src/shared/types/download.types.ts
export type DownloadSpec = {
  url: string;
  type: MediaType;
};
```

### 3. Shared Module = Named Only

The `shared` directory is accessed by both main and renderer processes, so it MUST use named exports only:

```typescript
// ✅ Good - shared/constants/channels.ts
export const DOWNLOAD_CHANNELS = {
  START: 'app:download:start',
  PAUSE: 'app:download:pause',
} as const;

// ❌ Bad - No default exports in shared
export default DOWNLOAD_CHANNELS; // Don't do this!
```

## 📁 Directory Structure

```
src/
├── main/                 # Electron main process (named exports only)
│   ├── ipc/
│   ├── db/
│   └── services/
├── preload/             # Preload scripts (named exports only)
├── renderer/            # React app
│   ├── components/      # Default exports, barrel with named re-exports
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   └── index.ts    # Barrel
│   ├── pages/          # Default exports
│   │   ├── Home.tsx
│   │   └── Settings.tsx
│   ├── hooks/          # Named exports
│   │   ├── useTheme.ts
│   │   └── index.ts    # Barrel
│   └── utils/          # Named exports
│       ├── format.ts
│       └── index.ts    # Barrel
└── shared/             # Named exports only
    ├── types/
    ├── constants/
    └── validation/
```

## 🔧 ESLint Configuration

The project enforces these rules automatically:

```json
{
  "overrides": [
    {
      "files": ["src/renderer/components/**", "src/renderer/pages/**"],
      "rules": {
        "import/no-default-export": "off",
        "import/prefer-default-export": "error"
      }
    },
    {
      "files": ["src/shared/**", "src/renderer/hooks/**", "src/main/**"],
      "rules": {
        "import/no-default-export": "error"
      }
    }
  ]
}
```

## 🚀 Best Practices

### Barrel Exports

Use explicit named re-exports instead of `export *`:

```typescript
// ✅ Good - Explicit and tree-shakeable
export { formatBytes, formatDuration } from './format';
export { parseUrl, validateUrl } from './url';

// ❌ Avoid - Can cause issues
export * from './format';
export * from './url';
```

### Type Imports

Always use type imports for type-only imports:

```typescript
// ✅ Good
import type { DownloadSpec } from '@shared/types';
import { DOWNLOAD_CHANNELS } from '@shared/constants';

// ❌ Bad
import { DownloadSpec, DOWNLOAD_CHANNELS } from '@shared';
```

### Avoid Circular Dependencies

- Barrels should only exist in leaf directories
- Don't create barrels that import from parent directories
- `pages/` should import from `components/`, not vice versa

## 💡 Decision Guide

Ask yourself:

1. **"Is this the main export of the file?"** 
   - Yes & it's a component/page → Default export
   - No or multiple exports → Named exports

2. **"Will both main and renderer use this?"**
   - Yes → Put in `shared/` with named exports
   - No → Put in appropriate process directory

3. **"Do I need a barrel export?"**
   - Multiple related modules → Yes, create `index.ts`
   - Single module or unrelated → No, import directly

## 🔄 Migration

When refactoring existing code:

```typescript
// Before (mixed exports)
export default function Button() { /* ... */ }
export const ButtonVariant = { /* ... */ };

// After (consistent pattern)
// Button.tsx
function Button() { /* ... */ }
export default Button;

// ButtonVariant.ts
export const ButtonVariant = { /* ... */ };

// index.ts (barrel)
export { default as Button } from './Button';
export { ButtonVariant } from './ButtonVariant';
```