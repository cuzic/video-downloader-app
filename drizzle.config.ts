import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './src/main/db/schema/index.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : path.join(process.cwd(), 'database', 'app.db')
  },
  strict: true,
  verbose: true,
} satisfies Config;