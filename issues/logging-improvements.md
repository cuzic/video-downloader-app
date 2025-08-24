# Logging Module Improvement Issues

## Issue 1: Improve Type Safety in PII Scrubbing
**Priority**: Low
**Module**: `src/logging/formats.ts`

### Current State
- Using `any` type in `scrubPII` function (lines 67, 86, 119)
- Metadata types are generic `Record<string, unknown>`

### Proposed Improvements
```typescript
// Define specific types for scrubbing
type ScrubbableValue = string | number | boolean | null | undefined | ScrubbableObject | ScrubbableArray;
type ScrubbableObject = { [key: string]: ScrubbableValue };
type ScrubbableArray = ScrubbableValue[];

// Define metadata interface
interface LogMetadata {
  cid?: string;
  scope?: string;
  userId?: string;
  error?: ErrorInfo;
  [key: string]: unknown;
}
```

### Benefits
- Better type checking at compile time
- Improved IDE autocomplete
- Reduced runtime errors

---

## Issue 2: Improve Electron Dependency Injection
**Priority**: Medium
**Module**: `src/logging/config.ts`

### Current State
- Dynamic `require('electron')` with ESLint disable (line 120-121)
- Runtime dependency resolution

### Proposed Improvements
```typescript
// Option 1: Dependency injection pattern
interface PathProvider {
  getUserDataPath(): string;
}

class LogConfig {
  constructor(private pathProvider?: PathProvider) {}
  
  private parseLogDir(): string {
    if (this.pathProvider) {
      return path.join(this.pathProvider.getUserDataPath(), 'logs');
    }
    // fallback logic
  }
}

// Option 2: Configuration factory
export function createLogConfig(electron?: { app: ElectronApp }): LogConfig {
  return new LogConfig(electron);
}
```

### Benefits
- Testability improvement
- No ESLint disable needed
- Clear dependency management
- Better for non-Electron environments

---

## Issue 3: Implement Graceful Shutdown
**Priority**: Medium
**Module**: `src/logging/exceptions.ts`

### Current State
- Hardcoded 1000ms timeout for process exit
- No coordination with other services

### Proposed Improvements
```typescript
interface ShutdownOptions {
  timeout?: number;
  onShutdown?: () => Promise<void>;
}

export class GracefulShutdown {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  
  register(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }
  
  async shutdown(reason: string, options?: ShutdownOptions): Promise<void> {
    const timeout = options?.timeout ?? 5000;
    
    try {
      await Promise.race([
        Promise.all(this.shutdownHandlers.map(h => h())),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
        )
      ]);
    } finally {
      process.exit(1);
    }
  }
}
```

### Benefits
- Configurable shutdown timeout
- Service coordination
- Clean resource cleanup
- Better error handling

---

## Implementation Plan

1. **Phase 1**: Type safety improvements (can be done anytime)
   - Low risk, high value
   - No breaking changes

2. **Phase 2**: Electron dependency injection
   - Medium risk, requires careful testing
   - May affect initialization code

3. **Phase 3**: Graceful shutdown
   - Higher complexity
   - Needs coordination with other services
   - Best done when implementing service lifecycle management