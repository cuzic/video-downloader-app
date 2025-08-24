/**
 * Logging module exports
 *
 * Usage guidelines:
 * - Use `logger` instance or `Logger` class for object-oriented logging with scope
 * - Use standalone functions (logInfo, logWarn, etc.) for simple logging
 * - Use `withContext` to maintain correlation IDs across async operations
 */

// Primary exports - recommended for most use cases
export {
  logger, // Default logger instance for general use
  Logger, // Logger class for creating scoped loggers
} from './logger';

// Standalone logging functions - for simple, direct logging
export {
  logInfo, // Log informational messages
  logWarn, // Log warning messages
  logError, // Log error messages with optional Error object
  logDebug, // Log debug messages (development)
  logVerbose, // Log verbose messages (detailed debugging)
} from './logger';

// Application lifecycle logging
export {
  logStartup, // Log application startup with version
  logShutdown, // Log application shutdown with reason
} from './logger';

// Context management - for correlation ID tracking
export {
  withContext, // Wrap async operations with correlation context
  getCid, // Get current correlation ID
  getContext, // Get full context object
  enrich, // Enrich metadata with context
} from './context';

// IPC setup - for Electron renderer/main communication
export {
  setupLoggingIPC, // Setup IPC handlers in main process
  cleanupLoggingIPC, // Cleanup IPC handlers
} from './ipc';

// Exception handlers - for global error handling
export {
  setupExceptionHandlers, // Setup global exception handlers
} from './exceptions';

// Type exports
export type { LogLevel } from './config';
export type { Context } from './context';
