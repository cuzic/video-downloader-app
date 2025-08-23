# Video Downloader

A modern Electron application for downloading HLS/DASH video streams with advanced features.

## Features

- HLS/DASH stream detection and downloading
- Smart naming system with customizable templates
- SQLite database with Drizzle ORM
- Secure architecture with proper IPC isolation
- DRM protection detection and blocking
- Batch download management
- Progress tracking with pause/resume support

## Tech Stack

- **Framework**: Electron 28+
- **Language**: TypeScript 5.3+
- **Database**: SQLite 3.40+ with Drizzle ORM
- **Build**: Vite + electron-builder
- **Video Processing**: FFmpeg
- **IPC**: Type-safe with Zod validation

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Architecture

- Main Process: Database, FFmpeg, download management
- Renderer Process: React UI with Material-UI
- Preload Script: Secure IPC bridge with contextBridge
- Worker Threads: Video processing tasks

## Security

- Content Security Policy enforced
- Context isolation enabled
- Node integration disabled
- Path traversal protection
- DRM content blocking

## License

MIT