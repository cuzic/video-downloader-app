import { describe, it, expect, vi } from 'vitest';
import {
  toIPCError,
  wrapHandler,
  validateRequired,
  validationError,
  notImplementedError,
  unauthorizedError,
} from '../utils/error-handler';
import { ErrorCode } from '@/shared/types/ipc.types';

// Mock audit log repository
vi.mock('../../db/repositories/index.js', () => ({
  auditLogRepo: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('Error Handler Utilities', () => {
  describe('toIPCError', () => {
    it('should convert Error to IPCError', () => {
      const error = new Error('Test error');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.OPERATION_FAILED,
        message: 'Test error',
        details: 'Error',
      });
      expect(result.stack).toBeDefined();
    });

    it('should detect validation errors', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      (error as any).details = { field: 'email' };

      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.INVALID_ARGUMENT,
        message: 'Invalid input',
        details: { field: 'email' },
      });
    });

    it('should detect file not found errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.FILE_NOT_FOUND,
        message: 'File or directory not found',
        details: 'ENOENT: no such file or directory',
      });
    });

    it('should detect permission errors', () => {
      const error = new Error('EACCES: permission denied');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.FILE_ACCESS_DENIED,
        message: 'Permission denied',
        details: 'EACCES: permission denied',
      });
    });

    it('should detect disk full errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.DISK_FULL,
        message: 'Insufficient disk space',
        details: 'ENOSPC: no space left on device',
      });
    });

    it('should detect network timeout errors', () => {
      const error = new Error('ETIMEDOUT: connection timed out');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.NETWORK_TIMEOUT,
        message: 'Network request timed out',
        details: 'ETIMEDOUT: connection timed out',
      });
    });

    it('should detect network connection errors', () => {
      const error = new Error('ECONNREFUSED: connection refused');
      const result = toIPCError(error);

      expect(result).toMatchObject({
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network connection failed',
        details: 'ECONNREFUSED: connection refused',
      });
    });

    it('should handle string errors', () => {
      const result = toIPCError('Simple error message');

      expect(result).toEqual({
        code: ErrorCode.OPERATION_FAILED,
        message: 'Simple error message',
      });
    });

    it('should handle unknown error types', () => {
      const result = toIPCError({ some: 'object' });

      expect(result).toEqual({
        code: ErrorCode.OPERATION_FAILED,
        message: 'An unknown error occurred',
        details: { some: 'object' },
      });
    });
  });

  describe('wrapHandler', () => {
    it('should execute handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success');
      const wrapped = wrapHandler(handler);

      const result = await wrapped('arg1', 'arg2');

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('success');
    });

    it('should catch and convert errors', async () => {
      const error = new Error('Handler failed');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = wrapHandler(handler);

      await expect(wrapped('arg1')).rejects.toMatchObject({
        code: ErrorCode.OPERATION_FAILED,
        message: 'Handler failed',
      });
    });

    it('should log errors to audit log', async () => {
      const { auditLogRepo } = await import('../../db/repositories/index.js');
      const error = new Error('Handler failed');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = wrapHandler(handler);

      try {
        await wrapped('arg1', 'arg2');
      } catch {
        // Expected to throw
      }

      expect(auditLogRepo.error).toHaveBeenCalledWith(
        'ipc',
        'handler_error',
        error,
        expect.objectContaining({
          args: ['arg2'], // First arg (event) is excluded
        })
      );
    });
  });

  describe('validateRequired', () => {
    it('should pass when all required fields are present', () => {
      expect(() => {
        validateRequired({ name: 'John', age: 30 }, ['name', 'age']);
      }).not.toThrow();
    });

    it('should throw when required field is missing', () => {
      expect(() => {
        validateRequired({ name: 'John' }, ['name', 'age']);
      }).toThrow();
    });

    it('should throw IPCError with missing fields', () => {
      try {
        validateRequired({ name: 'John' }, ['name', 'age', 'email']);
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.INVALID_ARGUMENT);
        expect(error.message).toContain('age, email');
        expect(error.details.missing).toEqual(['age', 'email']);
      }
    });

    it('should treat null as missing', () => {
      expect(() => {
        validateRequired({ name: 'John', age: null }, ['name', 'age']);
      }).toThrow();
    });

    it('should treat undefined as missing', () => {
      expect(() => {
        validateRequired({ name: 'John', age: undefined }, ['name', 'age']);
      }).toThrow();
    });
  });

  describe('Error creators', () => {
    it('should create validation error', () => {
      const error = validationError('Invalid email format', { field: 'email' });

      expect(error).toEqual({
        code: ErrorCode.INVALID_ARGUMENT,
        message: 'Invalid email format',
        details: { field: 'email' },
      });
    });

    it('should create not implemented error', () => {
      const error = notImplementedError('WebRTC streaming');

      expect(error).toEqual({
        code: ErrorCode.NOT_IMPLEMENTED,
        message: 'Feature not implemented: WebRTC streaming',
      });
    });

    it('should create unauthorized error', () => {
      const error = unauthorizedError('delete system files');

      expect(error).toEqual({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Unauthorized action: delete system files',
      });
    });
  });
});
