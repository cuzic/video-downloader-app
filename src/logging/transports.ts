/**
 * Winston transports configuration for file rotation and console output
 */
import { transports } from 'winston';
import type { transport } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import fs from 'node:fs';
import { devFormat, jsonLineFormat } from './formats';
import { config, LOG_RETENTION } from './config';

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
  maxFiles: string = config.maxFiles
): DailyRotateFile {
  return new DailyRotateFile({
    dirname: logDir,
    filename,
    datePattern: config.datePattern,
    maxFiles,
    maxSize: config.maxSize,
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
    maxsize: config.maxSize,
    maxFiles: LOG_RETENTION.EXCEPTION_FILES,
  });
}

/**
 * Build transports array based on environment
 * @param logDir Directory for log files
 * @returns Array of Winston transports
 */
export function buildTransports(logDir: string): transport[] {
  ensureLogDir(logDir);

  return [
    // Console transport with color in development
    new transports.Console({
      level: config.logLevel,
      format: config.isDevelopment ? devFormat : jsonLineFormat,
    }),
    // Daily rotating file for all logs
    createRotatingFileTransport(logDir, 'app-%DATE%.log', config.logLevel),
    // Separate error log file (keep for 30 days)
    createRotatingFileTransport(logDir, 'error-%DATE%.log', 'error', LOG_RETENTION.ERROR_DAYS),
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
 * Get log directory path from configuration
 */
export function getLogDir(): string {
  return config.logDir;
}
