/**
 * Winston transports configuration for file rotation and console output
 */
import { transports } from 'winston';
import type { transport } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import fs from 'node:fs';
import { devFormat, jsonLineFormat } from './formats';

// Configuration from environment variables with validation
function parseLogMaxSize(): number {
  const defaultSize = 5242880; // 5MB default
  const envValue = process.env.LOG_MAX_SIZE;

  if (!envValue) {
    return defaultSize;
  }

  const parsed = parseInt(envValue, 10);

  // Validate the parsed value
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(`Invalid LOG_MAX_SIZE value: ${envValue}. Using default: ${defaultSize}`);
    return defaultSize;
  }

  // Ensure reasonable limits (min 1KB, max 1GB)
  const MIN_SIZE = 1024; // 1KB
  const MAX_SIZE = 1073741824; // 1GB

  if (parsed < MIN_SIZE) {
    console.warn(`LOG_MAX_SIZE too small: ${parsed}. Using minimum: ${MIN_SIZE}`);
    return MIN_SIZE;
  }

  if (parsed > MAX_SIZE) {
    console.warn(`LOG_MAX_SIZE too large: ${parsed}. Using maximum: ${MAX_SIZE}`);
    return MAX_SIZE;
  }

  return parsed;
}

const LOG_MAX_SIZE = parseLogMaxSize();
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
 * Create a DailyRotateFile transport with common configuration
 */
function createRotatingFileTransport(
  logDir: string,
  filename: string,
  level: string,
  maxFiles: string = LOG_MAX_FILES
): DailyRotateFile {
  return new DailyRotateFile({
    dirname: logDir,
    filename,
    datePattern: LOG_DATE_PATTERN,
    maxFiles,
    maxSize: LOG_MAX_SIZE,
    zippedArchive: true,
    level,
    format: jsonLineFormat,
  });
}

/**
 * Create a File transport with common configuration
 */
function createFileTransport(logDir: string, filename: string): transports.FileTransportInstance {
  return new transports.File({
    filename: path.join(logDir, filename),
    format: jsonLineFormat,
    maxsize: LOG_MAX_SIZE,
    maxFiles: 5,
  });
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

  return [
    // Console transport with color in development
    new transports.Console({
      level: logLevel,
      format: isDevelopment ? devFormat : jsonLineFormat,
    }),
    // Daily rotating file for all logs
    createRotatingFileTransport(logDir, 'app-%DATE%.log', logLevel),
    // Separate error log file (keep for 30 days)
    createRotatingFileTransport(logDir, 'error-%DATE%.log', 'error', '30d'),
  ];
}

/**
 * Build exception handlers for uncaught exceptions
 */
export function buildExceptionHandlers(logDir: string): transport[] {
  ensureLogDir(logDir);
  return [createFileTransport(logDir, 'exceptions.log')];
}

/**
 * Build rejection handlers for unhandled promise rejections
 */
export function buildRejectionHandlers(logDir: string): transport[] {
  ensureLogDir(logDir);
  return [createFileTransport(logDir, 'rejections.log')];
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
