import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  throttle,
  debounce,
  EventBatcher,
  ProgressReporter,
  RateLimiter,
} from '../utils/performance';

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('throttle', () => {
    it('should limit function calls to specified interval', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      // Call multiple times rapidly
      throttled('call1');
      throttled('call2');
      throttled('call3');

      // Only first call should execute immediately
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call1');

      // Advance time to allow next execution
      vi.advanceTimersByTime(100);

      // Last call should now execute
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('call3');
    });

    it('should preserve context', () => {
      const context = { value: 42 };
      const fn = vi.fn(function(this: any) { return this.value; });
      const throttled = throttle(fn, 100);

      throttled.call(context);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.instances[0]).toBe(context);
    });
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('call1');
      debounced('call2');
      debounced('call3');

      // No calls yet
      expect(fn).not.toHaveBeenCalled();

      // Advance time
      vi.advanceTimersByTime(100);

      // Only last call should execute
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call3');
    });

    it('should reset timer on each call', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('call1');
      vi.advanceTimersByTime(50);
      
      debounced('call2');
      vi.advanceTimersByTime(50);
      
      // Still not called because timer was reset
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      // Now it should be called
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call2');
    });
  });

  describe('EventBatcher', () => {
    it('should batch events by size', () => {
      const onFlush = vi.fn();
      const batcher = new EventBatcher({
        batchSize: 3,
        batchDelay: 100,
        onFlush,
      });

      batcher.add('event1');
      batcher.add('event2');
      
      // Not flushed yet
      expect(onFlush).not.toHaveBeenCalled();

      batcher.add('event3');

      // Should flush immediately when batch size reached
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(['event1', 'event2', 'event3']);
    });

    it('should batch events by time', () => {
      const onFlush = vi.fn();
      const batcher = new EventBatcher({
        batchSize: 10,
        batchDelay: 100,
        onFlush,
      });

      batcher.add('event1');
      batcher.add('event2');

      expect(onFlush).not.toHaveBeenCalled();

      // Advance time to trigger delay flush
      vi.advanceTimersByTime(100);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(['event1', 'event2']);
    });

    it('should handle manual flush', () => {
      const onFlush = vi.fn();
      const batcher = new EventBatcher({
        batchSize: 10,
        batchDelay: 100,
        onFlush,
      });

      batcher.add('event1');
      batcher.add('event2');
      batcher.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(['event1', 'event2']);
    });

    it('should clear batch', () => {
      const onFlush = vi.fn();
      const batcher = new EventBatcher({
        batchSize: 10,
        batchDelay: 100,
        onFlush,
      });

      batcher.add('event1');
      batcher.clear();
      batcher.flush();

      // Should not flush anything
      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe('ProgressReporter', () => {
    it('should throttle progress updates', () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      } as any;

      const reporter = new ProgressReporter(mockWindow, 'progress', {
        throttleMs: 100,
        minProgressDelta: 1,
      });

      reporter.report('task1', 10);
      reporter.report('task1', 11);
      reporter.report('task1', 12);

      // Only first update should be sent immediately
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('progress', {
        taskId: 'task1',
        progress: 10,
      });

      // Advance time to allow next update
      vi.advanceTimersByTime(100);

      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2);
      expect(mockWindow.webContents.send).toHaveBeenLastCalledWith('progress', {
        taskId: 'task1',
        progress: 12,
      });
    });

    it('should respect minimum progress delta', () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      } as any;

      const reporter = new ProgressReporter(mockWindow, 'progress', {
        throttleMs: 0,
        minProgressDelta: 5,
      });

      reporter.report('task1', 10);
      reporter.report('task1', 11); // Delta < 5, should not report
      reporter.report('task1', 12); // Delta < 5, should not report
      reporter.report('task1', 15); // Delta >= 5, should report

      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2);
    });

    it('should force report regardless of throttling', () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      } as any;

      const reporter = new ProgressReporter(mockWindow, 'progress', {
        throttleMs: 100,
        minProgressDelta: 5,
      });

      reporter.report('task1', 10);
      reporter.forceReport('task1', 11, { status: 'completed' });

      // Both should be sent immediately
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2);
      expect(mockWindow.webContents.send).toHaveBeenLastCalledWith('progress', {
        taskId: 'task1',
        progress: 11,
        status: 'completed',
      });
    });

    it('should not send to destroyed windows', () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => true),
        webContents: {
          send: vi.fn(),
        },
      } as any;

      const reporter = new ProgressReporter(mockWindow, 'progress');

      reporter.forceReport('task1', 50);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('RateLimiter', () => {
    it('should limit rate of operations', async () => {
      const limiter = new RateLimiter(5, 10); // 5 tokens, 10 tokens/sec

      // Use up all tokens
      await limiter.acquire(5);
      
      // This should wait for refill
      const promise = limiter.acquire(1);
      
      // Advance time to refill 1 token
      vi.advanceTimersByTime(100);
      
      await promise;
      
      // Should have waited approximately 100ms
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should refill tokens over time', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const limiter = new RateLimiter(10, 100); // 10 tokens, 100 tokens/sec

      // Use some tokens
      await limiter.acquire(5);
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Should be able to acquire more tokens now
      await expect(limiter.acquire(5)).resolves.toBeUndefined();
    });

    it('should not exceed max tokens', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const limiter = new RateLimiter(5, 10); // 5 tokens max

      // Wait for potential over-refill
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should still only have max tokens
      await expect(limiter.acquire(5)).resolves.toBeUndefined();
      
      // This should require waiting
      const startTime = Date.now();
      await limiter.acquire(1);
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThanOrEqual(90); // Should wait ~100ms
    });

    it('should reset to max tokens', () => {
      const limiter = new RateLimiter(10, 1);

      // Use some tokens
      limiter.acquire(5);
      
      // Reset
      limiter.reset();
      
      // Should have max tokens again
      expect(limiter.acquire(10)).resolves.toBeUndefined();
    });
  });
});