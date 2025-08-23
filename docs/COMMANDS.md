# Command Usage Guide

## Command Organization

This project follows the best practice separation:
- **`bun run`** = Node/TS "inside" tasks (npm package dependencies)
- **`mise run`** = Project-wide "outside" tasks (toolchain management & orchestration)

### 🎯 Use `mise run` as the main entry point:
**All development workflows go through mise for consistency**

```bash
# Development - mise delegates to bun run internally
mise run dev          # Start development server → bun run dev
mise run build        # Build for production → bun run build
mise run test         # Run tests → bun test
mise run lint         # Run linting → bun run lint
mise run typecheck    # Type checking → bun run typecheck
mise run format       # Format code → bun run format

# Database - mise delegates to bun run
mise run db:migrate   # Run database migrations → bun run db:migrate
mise run db:studio    # Open Drizzle Studio → bun run db:studio

# Distribution - mise orchestrates multiple steps
mise run dist         # Package application (builds then packages)
mise run dist:mac     # Package for macOS
mise run dist:win     # Package for Windows
mise run dist:linux   # Package for Linux

# Maintenance - mise handles OS-level operations
mise run clean        # Clean build artifacts
mise run update       # Update dependencies
mise run setup        # Setup development environment
mise run ci           # Run CI checks (test + build + lint)
```

### 🔧 Use `bun run` directly when:
**You need to debug or run specific Node/TS tasks**

```bash
# Debugging individual processes
bun run dev:main      # Watch main process only
bun run dev:renderer  # Watch renderer process only
bun run dev:preload   # Watch preload script only

# Quick fixes
bun run lint:fix      # Auto-fix linting issues
bun run format        # Format specific files

# Direct testing
bun test src/specific.test.ts  # Run specific test file
bun test --watch              # Run tests in watch mode
```

## Key Differences

| Aspect | `mise run` | `bun run` |
|--------|------------|-----------|
| **Purpose** | Task orchestration | Script execution |
| **Dependencies** | Handles task dependencies | No dependency management |
| **Environment** | Sets up environment variables | Uses current environment |
| **Best for** | Development workflows | Direct commands |
| **Config location** | `.mise.toml` | `bunfig.toml` |

## Recommended Usage

### For daily development:
```bash
# Start developing
mise run dev

# Run tests
mise run test

# Build and check
mise run check
mise run build
```

### For specific tasks:
```bash
# Fix a specific file
bun run lint:fix src/main/index.ts

# Run a specific test
bun test src/main/utils.test.ts

# Quick type check
bun run typecheck
```

## Quick Reference

### Most Used Commands
```bash
mise run dev        # Start development
mise run test       # Run tests
mise run build      # Build project
mise run check      # Validate code
mise run clean      # Clean artifacts
```

### Aliases
```bash
mise run d          # dev
mise run t          # test
mise run b          # build
mise run c          # check
```

## Environment Variables

`mise` automatically loads environment variables from:
- `.mise.toml` - Default environment
- `.mise.env` - Additional environment variables
- `.mise.local.toml` - Local overrides (git-ignored)

## Tips

1. **Use `mise tasks` to see all available tasks**
   ```bash
   mise tasks
   ```

2. **Use `mise run` for workflows that need:**
   - Multiple steps
   - Environment setup
   - Task dependencies
   - Consistent execution

3. **Use `bun run` for:**
   - Quick one-off commands
   - Debugging specific processes
   - Direct script control
   - Performance-critical operations

4. **Create custom workflows in `.mise.local.toml`:**
   ```toml
   [tasks.my-workflow]
   description = "My custom workflow"
   depends = ["test", "build"]
   run = "echo 'Custom workflow complete'"
   ```