/**
 * Centralized logging configuration management
 */
import path from 'node:path';

/**
 * File size constants
 */
export const FILE_SIZE = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  MIN: 1024, // 1KB minimum
  MAX: 1024 * 1024 * 1024, // 1GB maximum
  DEFAULT: 5 * 1024 * 1024, // 5MB default
} as const;

/**
 * Log retention constants
 */
export const LOG_RETENTION = {
  DEFAULT_DAYS: '14d',
  ERROR_DAYS: '30d',
  EXCEPTION_FILES: 5,
  DATE_PATTERN: 'YYYY-MM-DD',
} as const;

/**
 * Log level type
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Logging configuration class
 */
export class LogConfig {
  private static instance: LogConfig;

  readonly logLevel: LogLevel;
  readonly logDir: string;
  readonly maxSize: number;
  readonly maxFiles: string;
  readonly datePattern: string;
  readonly isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
    this.logLevel = this.parseLogLevel();
    this.logDir = this.parseLogDir();
    this.maxSize = this.parseMaxSize();
    this.maxFiles = process.env.LOG_MAX_FILES || LOG_RETENTION.DEFAULT_DAYS;
    this.datePattern = process.env.LOG_DATE_PATTERN || LOG_RETENTION.DATE_PATTERN;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LogConfig {
    if (!LogConfig.instance) {
      LogConfig.instance = new LogConfig();
    }
    return LogConfig.instance;
  }

  /**
   * Parse and validate log level
   */
  private parseLogLevel(): LogLevel {
    const envLevel = process.env.APP_LOG_LEVEL;
    const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];

    if (envLevel && validLevels.includes(envLevel as LogLevel)) {
      return envLevel as LogLevel;
    }

    return this.isDevelopment ? 'debug' : 'info';
  }

  /**
   * Parse and validate max file size
   */
  private parseMaxSize(): number {
    const envValue = process.env.LOG_MAX_SIZE;

    if (!envValue) {
      return FILE_SIZE.DEFAULT;
    }

    const parsed = parseInt(envValue, 10);

    // Validate the parsed value
    if (isNaN(parsed) || parsed <= 0) {
      // Note: We'll handle warning after logger is initialized
      return FILE_SIZE.DEFAULT;
    }

    // Ensure reasonable limits
    if (parsed < FILE_SIZE.MIN) {
      return FILE_SIZE.MIN;
    }

    if (parsed > FILE_SIZE.MAX) {
      return FILE_SIZE.MAX;
    }

    return parsed;
  }

  /**
   * Parse log directory path
   */
  private parseLogDir(): string {
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

  /**
   * Get validation warnings for configuration
   */
  getValidationWarnings(): string[] {
    const warnings: string[] = [];
    const envValue = process.env.LOG_MAX_SIZE;

    if (envValue) {
      const parsed = parseInt(envValue, 10);

      if (isNaN(parsed) || parsed <= 0) {
        warnings.push(
          `Invalid LOG_MAX_SIZE value: ${envValue}. Using default: ${FILE_SIZE.DEFAULT}`
        );
      } else if (parsed < FILE_SIZE.MIN) {
        warnings.push(`LOG_MAX_SIZE too small: ${parsed}. Using minimum: ${FILE_SIZE.MIN}`);
      } else if (parsed > FILE_SIZE.MAX) {
        warnings.push(`LOG_MAX_SIZE too large: ${parsed}. Using maximum: ${FILE_SIZE.MAX}`);
      }
    }

    return warnings;
  }
}

/**
 * Get the singleton config instance
 */
export const config = LogConfig.getInstance();
