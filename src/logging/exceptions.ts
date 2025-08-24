/**
 * Global exception and rejection handlers
 */
import { logError } from './logger';
import { withContext } from './context';

/**
 * Setup global exception handlers
 */
export function setupExceptionHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    withContext(() => {
      logError('Uncaught Exception', error, {
        type: 'uncaughtException',
        fatal: true,
      });
    });

    // Give logger time to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
    withContext(() => {
      const error = reason instanceof Error ? reason : undefined;
      logError('Unhandled Promise Rejection', error, {
        type: 'unhandledRejection',
        reason: reason instanceof Error ? undefined : String(reason),
      });
    });
  });

  // Handle warnings
  process.on('warning', (warning: Error) => {
    withContext(() => {
      logError('Process Warning', warning, {
        type: 'warning',
      });
    });
  });

  // Log when handlers are set up
  logError('Exception handlers initialized', undefined, {
    handlers: ['uncaughtException', 'unhandledRejection', 'warning'],
  });
}
