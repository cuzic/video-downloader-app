---

# Video Downloader Electron App Development Guidelines

This is an Electron application that uses pnpm as the package manager and Node.js/TypeScript for development.

## Package Management

- Use `pnpm install` to install dependencies
- Use `pnpm add <package>` to add new dependencies
- Use `pnpm run <script>` to run scripts
- Project uses pnpm version 9.7.0 (managed via Corepack)

## Development Setup

```bash
# Enable Corepack and set up pnpm
corepack enable
corepack prepare pnpm@9.7.0 --activate

# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build the application
pnpm run build
```

## Key Technologies

- **Runtime**: Node.js with TypeScript (tsx for execution)
- **Framework**: Electron for desktop application
- **Build Tool**: Vite with vite-plugin-electron
- **Database**: better-sqlite3 (requires native rebuild for Electron)
- **Testing**: Vitest for unit tests, Playwright for E2E tests
- **Package Manager**: pnpm

## Important Notes

### Environment Variables
- Use `dotenv` package for loading `.env` files
- Import and configure at application entry point:
  ```ts
  import dotenv from 'dotenv';
  dotenv.config();
  ```

### Native Modules
- better-sqlite3 requires rebuilding for Electron
- Run `pnpm run rebuild` after Electron version updates
- Postinstall script automatically handles this during `pnpm install`

### Scripts Available

- `pnpm run dev` - Start development server
- `pnpm run build` - Build the application
- `pnpm run test` - Run tests with Vitest
- `pnpm run lint` - Run ESLint
- `pnpm run typecheck` - Type checking with TypeScript
- `pnpm run electron` - Run Electron application
- `pnpm run rebuild` - Rebuild native modules for Electron

### Database

- Uses better-sqlite3 for SQLite database
- Drizzle ORM for database management
- Database scripts:
  - `pnpm run db:generate` - Generate database migrations
  - `pnpm run db:push` - Push schema changes
  - `pnpm run db:migrate` - Run migrations
  - `pnpm run db:studio` - Open Drizzle Studio

## Project Structure

- `/src/main` - Electron main process code
- `/src/renderer` - Electron renderer process code
- `/src/preload` - Preload scripts
- `/dist` - Build output directory

## Coding Standards

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Ensure proper error handling
- Write tests for new features
- Run `pnpm run typecheck` and `pnpm run lint` before committing

- もっと実装を工夫して、コンパクトな修正にリファクタできませんか？