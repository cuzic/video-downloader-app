import { BrowserWindow } from 'electron';

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      const self = this;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled.apply(self, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function debounced(this: any, ...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }

    const self = this;
    timeout = setTimeout(() => {
      func.apply(self, args);
      timeout = null;
    }, wait);
  };
}

/**
 * Event batcher for batching multiple events into one
 */
export class EventBatcher<T> {
  private batch: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly batchDelay: number;
  private readonly onFlush: (items: T[]) => void;

  constructor(options: { batchSize?: number; batchDelay?: number; onFlush: (items: T[]) => void }) {
    this.batchSize = options.batchSize || 50;
    this.batchDelay = options.batchDelay || 100;
    this.onFlush = options.onFlush;
  }

  add(item: T): void {
    this.batch.push(item);

    // Flush if batch size reached
    if (this.batch.length >= this.batchSize) {
      this.flush();
      return;
    }

    // Schedule flush if not already scheduled
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  flush(): void {
    if (this.batch.length === 0) {
      return;
    }

    const items = [...this.batch];
    this.batch = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.onFlush(items);
  }

  clear(): void {
    this.batch = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Progress reporter with throttling
 */
export class ProgressReporter {
  private readonly throttledUpdate: (data: any) => void;
  private lastProgress = 0;
  private readonly minProgressDelta: number;

  constructor(
    private readonly window: BrowserWindow,
    private readonly channel: string,
    options: {
      throttleMs?: number;
      minProgressDelta?: number;
    } = {}
  ) {
    this.minProgressDelta = options.minProgressDelta || 1; // 1% minimum change

    this.throttledUpdate = throttle((data: any) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    }, options.throttleMs || 150);
  }

  report(taskId: string, progress: number, data?: any): void {
    // Only report if progress changed significantly
    if (Math.abs(progress - this.lastProgress) < this.minProgressDelta) {
      return;
    }

    this.lastProgress = progress;
    this.throttledUpdate({ taskId, progress, ...data });
  }

  forceReport(taskId: string, progress: number, data?: any): void {
    this.lastProgress = progress;
    if (!this.window.isDestroyed()) {
      this.window.webContents.send(this.channel, { taskId, progress, ...data });
    }
  }
}

/**
 * Broadcast event to all windows
 */
export function broadcast(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}

/**
 * Broadcast to specific window
 */
export function sendToWindow(window: BrowserWindow | null, channel: string, data: any): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, data);
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  async acquire(tokens = 1): Promise<void> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Calculate wait time
    const tokensNeeded = tokens - this.tokens;
    const waitMs = (tokensNeeded / this.refillRate) * 1000;

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    this.refill();
    this.tokens -= tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}
