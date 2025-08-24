/**
 * Winston transports configuration for file rotation and console output
 */
import { transports } from 'winston';
import type { transport } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import fs from 'node:fs';
import { devFormat, jsonLineFormat } from './formats';

// Configuration from environment variables
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE ? parseInt(process.env.LOG_MAX_SIZE, 10) : 5242880; // 5MB default
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d';
const LOG_DATE_PATTERN = process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD';

/**
 * Ensure log directory exists
 */
function ensureLogDir(logDir: string): void {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Build transports array based on environment
 * @param logDir Directory for log files
 * @param env Environment (development/production)
 * @returns Array of Winston transports
 */
export function buildTransports(logDir: string, env: string): transport[] {
  ensureLogDir(logDir);

  const isDevelopment = env === 'development';
  const logLevel = isDevelopment ? 'debug' : 'info';

  const transportList: transport[] = [];

  // Console transport with color in development
  transportList.push(
    new transports.Console({
      level: logLevel,
      format: isDevelopment ? devFormat : jsonLineFormat,
    })
  );

  // Daily rotating file for all logs
  transportList.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: LOG_DATE_PATTERN,
      maxFiles: LOG_MAX_FILES,
      maxSize: LOG_MAX_SIZE,
      zippedArchive: true, // Compress old files
      level: logLevel,
      format: jsonLineFormat,
    })
  );

  // Separate error log file
  transportList.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: LOG_DATE_PATTERN,
      maxFiles: '30d', // Keep errors for 30 days
      maxSize: LOG_MAX_SIZE,
      zippedArchive: true,
      level: 'error',
      format: jsonLineFormat,
    })
  );

  return transportList;
}

/**
 * Build exception handlers for uncaught exceptions
 */
export function buildExceptionHandlers(logDir: string): transport[] {
  ensureLogDir(logDir);

  return [
    new transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: jsonLineFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: 5,
    }),
  ];
}

/**
 * Build rejection handlers for unhandled promise rejections
 */
export function buildRejectionHandlers(logDir: string): transport[] {
  ensureLogDir(logDir);

  return [
    new transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: jsonLineFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: 5,
    }),
  ];
}

/**
 * Get log directory path based on environment
 */
export function getLogDir(): string {
  // Check for environment variable first
  if (process.env.APP_LOG_DIR) {
    return process.env.APP_LOG_DIR;
  }

  // In Electron main process, use app.getPath('userData')
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as { app: { getPath: (name: string) => string } };
    if (app && app.getPath) {
      return path.join(app.getPath('userData'), 'logs');
    }
  } catch {
    // Not in Electron environment
  }

  // Fallback to local logs directory
  return path.join(process.cwd(), 'logs');
}
