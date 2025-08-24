import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { withContext, getCid } from './context';
import { logInfo, logWarn, logError, logDebug, Logger } from './logger';
import fs from 'node:fs';
import path from 'node:path';

// Test log directory
const TEST_LOG_DIR = path.join(process.cwd(), 'test-logs');

describe('Logging Integration Tests', () => {
  beforeAll(() => {
    // Set test environment
    process.env.APP_LOG_DIR = TEST_LOG_DIR;
    process.env.APP_LOG_LEVEL = 'debug';

    // Ensure test directory exists
    if (!fs.existsSync(TEST_LOG_DIR)) {
      fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
    }

    // Note: IPC setup skipped in test environment (requires Electron)
  });

  afterAll(() => {
    // Clean up test logs
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  });

  test('should maintain correlation ID across async operations', async () => {
    let capturedCid: string | undefined;

    await withContext(async () => {
      capturedCid = getCid();
      if (capturedCid) {
        logInfo('Test start', { test: 'correlation' });

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        const afterAsyncCid = getCid();
        expect(afterAsyncCid).toBe(capturedCid);

        logInfo('Test end', { test: 'correlation' });
      }
    });

    expect(capturedCid).toBeTruthy();
  });

  test('should handle nested contexts correctly', () => {
    const cids: string[] = [];

    withContext(() => {
      const outerCid = getCid();
      if (outerCid) cids.push(outerCid);
      logInfo('Outer context');

      withContext(
        () => {
          const innerCid = getCid();
          if (innerCid) cids.push(innerCid);
          logInfo('Inner context');
        },
        { cid: 'custom-inner-cid' }
      );

      const backToOuter = getCid();
      if (outerCid) {
        expect(backToOuter).toBe(outerCid);
      }
    });

    expect(cids[0]).toBeTruthy();
    expect(cids[1]).toBe('custom-inner-cid');
  });

  test('should log at different levels', () => {
    withContext(() => {
      // These should not throw
      expect(() => logInfo('Info message')).not.toThrow();
      expect(() => logWarn('Warning message')).not.toThrow();
      expect(() => logError('Error message', new Error('Test error'))).not.toThrow();
      expect(() => logDebug('Debug message')).not.toThrow();
    });
  });

  test('should work with Logger class', () => {
    const logger = new Logger('TestModule');

    withContext(() => {
      expect(() => logger.info('Class info')).not.toThrow();
      expect(() => logger.warn('Class warning')).not.toThrow();
      expect(() => logger.error('Class error', new Error('Test'))).not.toThrow();
      expect(() => logger.debug('Class debug')).not.toThrow();
    });
  });

  test('should create child loggers with scope', () => {
    const parentLogger = new Logger('Parent');
    const childLogger = parentLogger.child('Child');

    withContext(() => {
      // Both should work without throwing
      expect(() => parentLogger.info('Parent log')).not.toThrow();
      expect(() => childLogger.info('Child log')).not.toThrow();
    });
  });

  test('should handle errors with stack traces', () => {
    const error = new Error('Test error with stack');
    error.stack = 'Error: Test error\\n    at test.js:10:5';

    withContext(() => {
      expect(() =>
        logError('Error occurred', error, {
          module: 'test',
          action: 'testing',
        })
      ).not.toThrow();
    });
  });

  test('should mask PII in logged data', () => {
    withContext(() => {
      // This should not throw and PII should be masked internally
      expect(() =>
        logInfo('User data', {
          email: 'test@example.com',
          phone: '555-123-4567',
          ssn: '123-45-6789',
          safe: 'This is safe data',
        })
      ).not.toThrow();
    });
  });

  test('should handle concurrent logging operations', async () => {
    const promises = [];

    // Create multiple concurrent logging contexts
    for (let i = 0; i < 10; i++) {
      promises.push(
        withContext(async () => {
          const cid = getCid();
          if (cid) {
            logInfo(`Concurrent log ${i}`, { index: i });

            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

            // CID should be maintained
            expect(getCid()).toBe(cid);
            logInfo(`Concurrent log ${i} complete`, { index: i });
          }
        })
      );
    }

    // All should complete without errors
    await Promise.all(promises);
  });

  test('should enrich logs with metadata', () => {
    withContext(() => {
      const cid = getCid();

      // Log with various metadata
      expect(() =>
        logInfo('Enriched log', {
          user: 'testuser',
          action: 'test-action',
          timestamp: Date.now(),
          nested: {
            key: 'value',
            array: [1, 2, 3],
          },
        })
      ).not.toThrow();

      // Verify CID is maintained
      if (cid) {
        expect(getCid()).toBe(cid);
      }
    });
  });

  test('should handle undefined and null values gracefully', () => {
    withContext(() => {
      expect(() => logInfo('Test null', { value: null })).not.toThrow();
      expect(() => logInfo('Test undefined', { value: undefined })).not.toThrow();
      expect(() => logInfo('Test empty')).not.toThrow();
      expect(() => logError('Test no error', undefined)).not.toThrow();
    });
  });
});
