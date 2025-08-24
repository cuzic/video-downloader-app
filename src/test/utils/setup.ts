import { beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { MockInstance } from 'vitest';

/**
 * Standard mock setup and cleanup for tests
 */
export function setupMocks(): void {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

/**
 * Setup with automatic timer mocking
 */
export function setupWithTimers(): void {
  setupMocks();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
}

/**
 * Setup with environment variable mocking
 */
export function setupWithEnv(envVars: Record<string, string>): void {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, envVars);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  setupMocks();
}

/**
 * Setup for integration tests with database
 */
export function setupIntegrationTest(options?: {
  database?: boolean;
  network?: boolean;
  filesystem?: boolean;
}): void {
  if (options?.database) {
    beforeAll(async () => {
      // Database setup would go here
    });

    afterAll(async () => {
      // Database cleanup would go here
    });
  }

  if (options?.filesystem) {
    const mockFs = new Map<string, string>();

    beforeEach(() => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn((path: string) => {
          if (mockFs.has(path)) {
            return Promise.resolve(mockFs.get(path));
          }
          return Promise.reject(new Error('File not found'));
        }),
        writeFile: vi.fn((path: string, content: string) => {
          mockFs.set(path, content);
          return Promise.resolve();
        }),
        unlink: vi.fn((path: string) => {
          mockFs.delete(path);
          return Promise.resolve();
        }),
        exists: vi.fn((path: string) => Promise.resolve(mockFs.has(path))),
      }));
    });

    afterEach(() => {
      mockFs.clear();
    });
  }

  setupMocks();
}

/**
 * Helper to create a test context with shared state
 */
export function createTestContext<T>(factory: () => T): {
  get: () => T;
  set: (value: T) => void;
  update: (updater: (ctx: T) => T) => void;
} {
  let context: T;

  beforeEach(() => {
    context = factory();
  });

  return {
    get(): T {
      return context;
    },
    set(value: T): void {
      context = value;
    },
    update(updater: (ctx: T) => T): void {
      context = updater(context);
    },
  };
}

/**
 * Helper to wait for async operations
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Helper to capture console output
 */
export function captureConsole(): {
  getLogs: () => string[];
  getErrors: () => string[];
  getWarnings: () => string[];
  clearLogs: () => void;
  clearErrors: () => void;
  clearWarnings: () => void;
  clearAll: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let logSpy: MockInstance;
  let errorSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnings.push(args.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logs.length = 0;
    errors.length = 0;
    warnings.length = 0;
  });

  return {
    getLogs: () => [...logs],
    getErrors: () => [...errors],
    getWarnings: () => [...warnings],
    clearLogs: () => {
      logs.length = 0;
    },
    clearErrors: () => {
      errors.length = 0;
    },
    clearWarnings: () => {
      warnings.length = 0;
    },
    clearAll: () => {
      logs.length = 0;
      errors.length = 0;
      warnings.length = 0;
    },
  };
}

/**
 * Helper for testing error scenarios
 */
export async function expectError<T = Error>(
  fn: () => void | Promise<void>,
  errorClass?: new (...args: unknown[]) => T,
  message?: string | RegExp
): Promise<T> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (errorClass && !(error instanceof errorClass)) {
      throw new Error(`Expected error to be instance of ${errorClass.name}`);
    }
    if (message) {
      const errorMessage = (error as Error).message;
      if (typeof message === 'string' && errorMessage !== message) {
        throw new Error(`Expected error message "${message}", got "${errorMessage}"`);
      }
      if (message instanceof RegExp && !message.test(errorMessage)) {
        throw new Error(`Expected error message to match ${message}, got "${errorMessage}"`);
      }
    }
    return error as T;
  }
}

/**
 * Helper to create a deferred promise for testing
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Helper to test event emitters
 */
export function createEventSpy(): {
  handler: (event: string, ...args: unknown[]) => void;
  getEvents: () => Array<{ event: string; args: unknown[] }>;
  getEventsByName: (name: string) => Array<{ event: string; args: unknown[] }>;
  hasEvent: (name: string) => boolean;
  clear: () => void;
} {
  const events: Array<{ event: string; args: unknown[] }> = [];

  return {
    handler: (event: string, ...args: unknown[]) => {
      events.push({ event, args });
    },
    getEvents: () => [...events],
    getEventsByName: (name: string) => events.filter((e) => e.event === name),
    hasEvent: (name: string) => events.some((e) => e.event === name),
    clear: () => {
      events.length = 0;
    },
  };
}
