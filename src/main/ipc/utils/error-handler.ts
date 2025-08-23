import { app } from 'electron';
import type { IPCError } from '@/shared/types/ipc.types';
import { ErrorCode } from '@/shared/types/ipc.types';
import { auditLogRepo } from '@/main/db/repositories';

/**
 * Convert any error to IPCError format
 */
export function toIPCError(error: unknown): IPCError {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.name === 'ValidationError') {
      return {
        code: ErrorCode.INVALID_ARGUMENT,
        message: error.message,
        details: (error as any).details,
        stack: error.stack,
      };
    }
    
    if (error.message.includes('ENOENT')) {
      return {
        code: ErrorCode.FILE_NOT_FOUND,
        message: 'File or directory not found',
        details: error.message,
        stack: error.stack,
      };
    }
    
    if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
      return {
        code: ErrorCode.FILE_ACCESS_DENIED,
        message: 'Permission denied',
        details: error.message,
        stack: error.stack,
      };
    }
    
    if (error.message.includes('ENOSPC')) {
      return {
        code: ErrorCode.DISK_FULL,
        message: 'Insufficient disk space',
        details: error.message,
        stack: error.stack,
      };
    }
    
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKETTIMEDOUT')) {
      return {
        code: ErrorCode.NETWORK_TIMEOUT,
        message: 'Network request timed out',
        details: error.message,
        stack: error.stack,
      };
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network connection failed',
        details: error.message,
        stack: error.stack,
      };
    }
    
    // Default error
    return {
      code: ErrorCode.OPERATION_FAILED,
      message: error.message || 'An unexpected error occurred',
      details: error.name,
      stack: error.stack,
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: ErrorCode.OPERATION_FAILED,
      message: error,
    };
  }
  
  // Handle unknown errors
  return {
    code: ErrorCode.OPERATION_FAILED,
    message: 'An unknown error occurred',
    details: error,
  };
}

/**
 * Wrap an IPC handler with error handling
 */
export function wrapHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R> | R
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      const ipcError = toIPCError(error);
      
      // Log the error
      await auditLogRepo.error(
        'ipc',
        'handler_error',
        error instanceof Error ? error : new Error(String(error)),
        {
          handler: handler.name,
          args: args.slice(1), // Exclude event parameter
          error: ipcError,
        }
      );
      
      // Re-throw as IPCError
      throw ipcError;
    }
  };
}

/**
 * Validate required parameters
 */
export function validateRequired(params: Record<string, any>, required: string[]): void {
  const missing = required.filter(key => params[key] === undefined || params[key] === null);
  
  if (missing.length > 0) {
    throw {
      code: ErrorCode.INVALID_ARGUMENT,
      message: `Missing required parameters: ${missing.join(', ')}`,
      details: { missing, provided: Object.keys(params) },
    } as IPCError;
  }
}

/**
 * Create a validation error
 */
export function validationError(message: string, details?: any): IPCError {
  return {
    code: ErrorCode.INVALID_ARGUMENT,
    message,
    details,
  };
}

/**
 * Create a not implemented error
 */
export function notImplementedError(feature: string): IPCError {
  return {
    code: ErrorCode.NOT_IMPLEMENTED,
    message: `Feature not implemented: ${feature}`,
  };
}

/**
 * Create an unauthorized error
 */
export function unauthorizedError(action: string): IPCError {
  return {
    code: ErrorCode.UNAUTHORIZED,
    message: `Unauthorized action: ${action}`,
  };
}

/**
 * Log IPC error with context
 */
export async function logIPCError(
  channel: string,
  error: IPCError,
  context?: any
): Promise<void> {
  await auditLogRepo.error(
    'ipc',
    channel,
    new Error(error.message),
    {
      code: error.code,
      details: error.details,
      context,
    }
  );
}

/**
 * Handle uncaught IPC errors
 */
export function setupErrorHandlers(): void {
  // Handle uncaught exceptions in IPC handlers
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception in IPC handler:', error);
    
    const ipcError = toIPCError(error);
    await logIPCError('uncaught_exception', ipcError, {
      stack: error.stack,
    });
    
    // Don't exit the app, but report the error
    if (app.isReady()) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Unexpected Error',
        'An unexpected error occurred. The application may be unstable.'
      );
    }
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
    
    const ipcError = toIPCError(reason);
    await logIPCError('unhandled_rejection', ipcError, {
      promise: String(promise),
    });
  });
}