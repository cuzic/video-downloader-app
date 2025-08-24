# Empty Directory Prevention

## Overview

This project includes a pre-commit hook that prevents committing empty directories to maintain a clean project structure.

## How It Works

When you attempt to commit, the pre-commit hook runs `scripts/check-empty-dirs.js` which:

1. Recursively scans the `src/` directory for empty folders
2. Reports any empty directories found
3. Blocks the commit if empty directories exist

## Handling Empty Directories

### If the commit is blocked:

1. **Remove the empty directories:**
   ```bash
   # Example: Remove specific empty directory
   rm -rf src/empty-folder
   
   # Or find and remove all empty directories (Unix/Linux/Mac)
   find src -type d -empty -delete
   ```

2. **Or, if the directory should remain empty** (rare cases):
   - Edit `scripts/check-empty-dirs.js`
   - Add the directory path to the `ALLOWED_EMPTY_DIRS` array
   - Example:
     ```javascript
     const ALLOWED_EMPTY_DIRS = [
       'src/assets/placeholder',  // Intentionally empty
     ];
     ```

## Cross-Platform Compatibility

The check script is written in Node.js and works on:
- ✅ Windows
- ✅ macOS  
- ✅ Linux

## Temporarily Bypassing the Check

If you need to commit urgently and will fix empty directories later:

```bash
# Skip all hooks (use with caution)
git commit --no-verify -m "Your message"
```

## Why This Matters

Empty directories:
- Add unnecessary clutter to the project structure
- Can cause confusion about project organization
- May indicate incomplete refactoring or cleanup
- Are not tracked by Git (only files are tracked)

## Configuration

The check is configured in:
- **Script:** `scripts/check-empty-dirs.js`
- **Hook:** `.husky/pre-commit`
- **Directories checked:** `src/` (configurable in the script)

## Troubleshooting

### The hook is not running
- Ensure Husky is installed: `npm run prepare`
- Check that `.husky/pre-commit` is executable: `chmod +x .husky/pre-commit`

### False positives
- Check if the directory truly is empty
- Verify it's not in the `ALLOWED_EMPTY_DIRS` list
- Hidden files (like `.gitkeep`) will prevent a directory from being considered empty