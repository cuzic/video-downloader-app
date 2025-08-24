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
import { config } from './config';
import type { LogLevel } from './config';

// Get log directory from config
const logDir = getLogDir();

// Create Winston logger instance
const winstonLogger: WinstonLogger = createLogger({
  level: config.logLevel,
  transports: buildTransports(logDir),
  exceptionHandlers: buildExceptionHandlers(logDir),
  rejectionHandlers: buildRejectionHandlers(logDir),
  exitOnError: false, // Don't exit on handled exceptions
});

// Export LogLevel type from config
export type { LogLevel } from './config';

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

  private log(level: LogLevel, message: string, errorOrMeta?: Error | object, meta?: object): void {
    const enrichedMeta = this.enrichWithScope(
      level === 'error' && errorOrMeta instanceof Error ? meta : (errorOrMeta as object)
    );

    switch (level) {
      case 'error':
        logError(message, errorOrMeta instanceof Error ? errorOrMeta : undefined, enrichedMeta);
        break;
      case 'warn':
        logWarn(message, enrichedMeta);
        break;
      case 'info':
        logInfo(message, enrichedMeta);
        break;
      case 'debug':
        logDebug(message, enrichedMeta);
        break;
      case 'verbose':
        logVerbose(message, enrichedMeta);
        break;
    }
  }

  info = (message: string, meta?: object): void => this.log('info', message, meta);
  warn = (message: string, meta?: object): void => this.log('warn', message, meta);
  error = (message: string, error?: Error, meta?: object): void =>
    this.log('error', message, error, meta);
  debug = (message: string, meta?: object): void => this.log('debug', message, meta);
  verbose = (message: string, meta?: object): void => this.log('verbose', message, meta);

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
  // Log any configuration warnings first
  const warnings = config.getValidationWarnings();
  warnings.forEach((warning) => logWarn(warning));

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
