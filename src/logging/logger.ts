/**
 * Main logger module
 * Provides unified logging API with correlation ID support
 */
import { createLogger } from 'winston';
import type { Logger as WinstonLogger } from 'winston';
import {
  buildTransports,
  buildExceptionHandlers,
  buildRejectionHandlers,
  getLogDir,
} from './transports';
import { enrich } from './context';

// Environment configuration
const env = process.env.NODE_ENV || 'development';
const logDir = getLogDir();

// Create Winston logger instance
const winstonLogger: WinstonLogger = createLogger({
  level: process.env.APP_LOG_LEVEL || (env === 'development' ? 'debug' : 'info'),
  transports: buildTransports(logDir, env),
  exceptionHandlers: buildExceptionHandlers(logDir),
  rejectionHandlers: buildRejectionHandlers(logDir),
  exitOnError: false, // Don't exit on handled exceptions
});

/**
 * Log levels type
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Unified log function with correlation ID enrichment
 */
function log(level: LogLevel, message: string, meta?: object): void {
  const enrichedMeta = enrich((meta as Record<string, unknown>) || {});
  winstonLogger.log(level, message, enrichedMeta);
}

/**
 * Log info level message
 */
export function logInfo(message: string, meta?: object): void {
  log('info', message, meta);
}

/**
 * Log warning level message
 */
export function logWarn(message: string, meta?: object): void {
  log('warn', message, meta);
}

/**
 * Log error level message
 */
export function logError(message: string, error?: Error, meta?: object): void {
  const errorMeta =
    error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          ...meta,
        }
      : {
          error: error ? String(error) : undefined,
          ...meta,
        };

  log('error', message, errorMeta);
}

/**
 * Log debug level message
 */
export function logDebug(message: string, meta?: object): void {
  log('debug', message, meta);
}

/**
 * Log verbose level message
 */
export function logVerbose(message: string, meta?: object): void {
  log('verbose', message, meta);
}

/**
 * Logger class for object-oriented usage
 */
export class Logger {
  constructor(private scope?: string) {}

  private enrichWithScope(meta?: object): object {
    return this.scope ? { scope: this.scope, ...meta } : meta || {};
  }

  info(message: string, meta?: object): void {
    logInfo(message, this.enrichWithScope(meta));
  }

  warn(message: string, meta?: object): void {
    logWarn(message, this.enrichWithScope(meta));
  }

  error(message: string, error?: Error, meta?: object): void {
    logError(message, error, this.enrichWithScope(meta));
  }

  debug(message: string, meta?: object): void {
    logDebug(message, this.enrichWithScope(meta));
  }

  verbose(message: string, meta?: object): void {
    logVerbose(message, this.enrichWithScope(meta));
  }

  /**
   * Create a child logger with additional scope
   */
  child(scope: string): Logger {
    const fullScope = this.scope ? `${this.scope}.${scope}` : scope;
    return new Logger(fullScope);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Log application startup
 */
export function logStartup(version: string, meta?: object): void {
  logInfo('Application started', { version, ...meta });
}

/**
 * Log application shutdown
 */
export function logShutdown(reason?: string, meta?: object): void {
  logInfo('Application shutting down', { reason, ...meta });
}

// Export winston logger for advanced usage
export { winstonLogger };
