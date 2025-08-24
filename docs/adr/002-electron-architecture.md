# ADR-002: Electron Process Architecture

## Status
Accepted

## Context
Electron applications consist of multiple processes that need to communicate securely. We need to decide on the architecture for process separation and communication.

## Decision
We will use a strict three-process architecture:
1. **Main Process**: Handles system operations, database, and download management
2. **Renderer Process**: React UI with no direct system access
3. **Preload Script**: Secure bridge using contextBridge API

## Consequences

### Positive
- **Security**: Complete isolation between web content and system resources
- **Stability**: Renderer crashes don't affect main process
- **Performance**: UI remains responsive during heavy operations
- **Maintainability**: Clear separation of concerns

### Negative
- **Complexity**: Requires IPC for all cross-process communication
- **Boilerplate**: More code needed for type-safe IPC
- **Debugging**: Cross-process debugging is more challenging

### Neutral
- All IPC must go through validated channels
- Database operations only in main process
- File system access restricted to main process

## Implementation Details

### Main Process (`src/main/`)
- Database client and repositories
- IPC handlers
- Download management
- Security validations
- System operations

### Renderer Process (`src/renderer/`)
- React components
- UI state management
- User interactions
- Display logic only

### Preload Script (`src/preload/`)
- Exposes limited, safe API to renderer
- Uses contextBridge.exposeInMainWorld
- Type-safe window.api interface

### IPC Communication
```typescript
// Renderer → Main (invoke)
const result = await window.api.download.start(spec);

// Main → Renderer (event)
window.api.download.onProgress(callback);
```

## Security Considerations
- Context isolation enabled
- Node integration disabled in renderer
- All inputs validated with Zod schemas
- Path traversal prevention
- SSRF protection