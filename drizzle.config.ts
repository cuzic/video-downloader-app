import type { Config } from 'drizzle-kit';

export default {
  schema: '/home/cuzic/video-downloader-app/src/main/db/schema/*.ts',
  out: '/home/cuzic/video-downloader-app/drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: '/home/cuzic/video-downloader-app/video-downloader.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;