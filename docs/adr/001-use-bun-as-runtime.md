# ADR-001: Use Bun as Primary Runtime and Package Manager

## Status
Accepted

## Context
The project needs a JavaScript runtime and package manager for development and build processes. Options include Node.js with npm/yarn/pnpm, or Bun which is a newer, faster alternative.

## Decision
We will use Bun as the primary runtime and package manager for this project.

## Consequences

### Positive
- **Performance**: Bun is significantly faster than Node.js for package installation and script execution
- **Built-in TypeScript**: Native TypeScript support without additional transpilation
- **Integrated tooling**: Built-in bundler, test runner, and package manager
- **Modern APIs**: Includes modern Web APIs and improved file system operations
- **Simplified setup**: Single tool instead of Node.js + npm + additional build tools

### Negative
- **Maturity**: Bun is newer and less battle-tested than Node.js
- **Ecosystem compatibility**: Some npm packages may have compatibility issues
- **Team familiarity**: Developers may need to learn Bun-specific features
- **Electron integration**: Requires careful configuration to work with Electron

### Neutral
- Configuration files use `bunfig.toml` instead of traditional npm config
- Test runner syntax is similar to Jest but with some differences
- Some Node.js APIs need to be replaced with Bun equivalents

## Implementation Notes
- Use `bun install` instead of `npm install`
- Scripts are run with `bun run` or direct execution with `bun`
- Test files use `.bun.test.ts` extension for Bun test runner
- Vitest is kept for tests requiring complex mocking (Electron APIs)