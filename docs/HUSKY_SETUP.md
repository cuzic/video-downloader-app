# Husky Git Hooks Setup

## Overview

This project uses Husky v9 for Git hooks to ensure code quality and consistency.

## Configured Hooks

### Pre-commit
- **Location**: `.husky/pre-commit`
- **Actions**:
  1. Checks for empty directories (runs `scripts/check-empty-dirs.js`)
  2. Runs lint-staged to format and lint changed files

### Commit-msg
- **Location**: `.husky/commit-msg`
- **Actions**:
  - Validates commit messages follow Conventional Commits format
  - Accepted types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
  - Format: `<type>(<scope>): <subject>`

### Pre-push
- **Location**: `.husky/pre-push`
- **Actions**:
  1. Runs TypeScript type checking (`bun run typecheck`)
  2. Runs all tests (`bun test`)

## Hook Configuration (v9+)

As of Husky v9, hooks no longer require the shebang and sourcing of `husky.sh`. The hooks are now simple shell scripts that are executed directly.

### Previous format (deprecated):
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Your commands here
```

### Current format (v9+):
```sh
# Your commands here
```

## Installation

Husky is automatically set up when you run:
```bash
bun install
```

This triggers the `prepare` script in package.json which initializes Husky.

## Troubleshooting

### Hooks not running
If hooks are not executing:
1. Ensure Husky is installed: `bun install`
2. Check that `.husky` directory exists
3. Verify hooks are executable: `ls -la .husky/`

### Bypassing hooks (use with caution)
- Skip pre-commit: `git commit --no-verify`
- Skip pre-push: `git push --no-verify`

## Related Files
- `.husky/` - Git hooks directory
- `.lintstagedrc.json` - Configuration for lint-staged
- `scripts/check-empty-dirs.js` - Empty directory checker