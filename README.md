# Video Downloader

A modern Electron application for downloading HLS/DASH video streams, built with Bun as the primary runtime and package manager.

## Features

- HLS/DASH stream detection and downloading
- Smart naming system with customizable templates
- SQLite database with Drizzle ORM
- Secure architecture with proper IPC isolation
- DRM protection detection and blocking
- Batch download management
- Progress tracking with pause/resume support

## Tech Stack

- **Runtime**: Bun (latest)
- **Framework**: Electron 28+
- **Language**: TypeScript 5.3+
- **Database**: SQLite 3.40+ with Drizzle ORM
- **Build**: Bun bundler + Vite + electron-builder
- **Video Processing**: FFmpeg
- **IPC**: Type-safe with Zod validation
- **Config**: bunfig.toml (central configuration)

## Prerequisites

- [mise](https://mise.jdx.dev/) - For tool version management and task running
- FFmpeg (for video processing)

## Installation

```bash
# Install mise (if not already installed)
curl https://mise.run | sh

# Clone the repository
git clone https://github.com/cuzic/video-downloader-app.git
cd video-downloader-app

# Install tools and dependencies
mise install        # Installs node, bun, and other tools
mise run install    # Installs npm dependencies
```

## Development

All commands are managed through `mise`:

```bash
# View all available tasks
mise tasks           # or 'mise ls'

# Core development commands
mise run dev         # Start development server
mise run build       # Build for production
mise run test        # Run tests
mise run check       # Run all checks (type, lint, format)

# Testing
mise run test:watch  # Run tests in watch mode
mise run test:coverage # Run tests with coverage
mise run test:unit   # Run unit tests only
mise run test:e2e    # Run E2E tests

# Code quality
mise run lint        # Run ESLint
mise run lint:fix    # Fix linting issues
mise run format      # Format code with Prettier
mise run typecheck   # TypeScript type checking

# Database
mise run db:generate # Generate migrations
mise run db:push     # Push database changes
mise run db:studio   # Open Drizzle Studio
mise run db:migrate  # Run migrations

# Build & Distribution
mise run dist        # Package application
mise run dist:mac    # Package for macOS
mise run dist:win    # Package for Windows
mise run dist:linux  # Package for Linux

# Utilities
mise run clean       # Clean build artifacts
mise run clean:all   # Clean everything
mise run update      # Update dependencies
mise run audit       # Security audit

# Quick aliases
mise run t           # Alias for test
mise run d           # Alias for dev
mise run b           # Alias for build
mise run c           # Alias for check
```

You can also run scripts directly with Bun:

```bash
# Direct script execution
bun scripts/dev.ts   # Start development server
bun scripts/build.ts # Build for production
bun scripts/test.ts  # Run tests
```

## Configuration

The project uses multiple configuration files for different purposes:

### `bunfig.toml`
Central Bun configuration for:
- Build settings
- Test configuration
- Script definitions
- Environment-specific overrides
- Bundle optimization

### `.mise.toml`
Tool version management and task runner:
- Tool versions (Node, Bun, etc.)
- Task definitions
- Environment variables
- Task dependencies

### `package.json`
Kept minimal, only contains:
- Basic metadata
- Dependency list
- Electron builder configuration

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