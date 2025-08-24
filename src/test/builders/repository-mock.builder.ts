import { vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Builder pattern for creating repository mocks with fluent API
 */
export class RepositoryMockBuilder<T> {
  private mock: Partial<T> = {};

  /**
   * Adds a mocked method to the repository
   * @param method Method name to mock
   * @param implementation Optional implementation or return value
   */
  withMethod<K extends keyof T>(
    method: K,
    implementation?: T[K] | ((...args: any[]) => any)
  ): this {
    if (implementation === undefined) {
      this.mock[method] = vi.fn() as T[K];
    } else if (typeof implementation === 'function') {
      this.mock[method] = implementation as T[K];
    } else {
      this.mock[method] = vi.fn().mockReturnValue(implementation) as T[K];
    }
    return this;
  }

  /**
   * Adds an async method that resolves with a value
   * @param method Method name to mock
   * @param resolvedValue Value to resolve with
   */
  withAsyncMethod<K extends keyof T>(method: K, resolvedValue?: unknown): this {
    this.mock[method] = vi.fn().mockResolvedValue(resolvedValue) as T[K];
    return this;
  }

  /**
   * Adds an async method that rejects with an error
   * @param method Method name to mock
   * @param error Error to reject with
   */
  withRejectedMethod<K extends keyof T>(method: K, error: unknown): this {
    this.mock[method] = vi.fn().mockRejectedValue(error) as T[K];
    return this;
  }

  /**
   * Adds multiple methods at once
   * @param methods Object with method names and implementations
   */
  withMethods(methods: Partial<T>): this {
    Object.entries(methods).forEach(([key, value]) => {
      this.mock[key as keyof T] = value as T[keyof T];
    });
    return this;
  }

  /**
   * Adds a method with custom mock implementation
   * @param method Method name to mock
   * @param mockFn Custom mock function
   */
  withMockFunction<K extends keyof T>(method: K, mockFn: Mock): this {
    this.mock[method] = mockFn as T[K];
    return this;
  }

  /**
   * Adds a property (non-function) to the mock
   * @param property Property name
   * @param value Property value
   */
  withProperty<K extends keyof T>(property: K, value: T[K]): this {
    this.mock[property] = value;
    return this;
  }

  /**
   * Adds multiple properties at once
   * @param properties Object with property names and values
   */
  withProperties(properties: Partial<T>): this {
    Object.assign(this.mock, properties);
    return this;
  }

  /**
   * Builds and returns the final mock object
   */
  build(): T {
    return this.mock as T;
  }

  /**
   * Builds a partial mock (useful for testing specific methods)
   */
  buildPartial(): Partial<T> {
    return this.mock;
  }

  /**
   * Resets the builder to start fresh
   */
  reset(): this {
    this.mock = {};
    return this;
  }

  /**
   * Creates a spy on existing implementation
   * @param realImplementation Real object to spy on
   * @param methods Methods to spy on
   */
  static createSpy<T>(realImplementation: T, methods: (keyof T)[]): T {
    const spy = { ...realImplementation };
    methods.forEach((method) => {
      if (typeof realImplementation[method] === 'function') {
        (spy as any)[method] = vi.fn(realImplementation[method] as (...args: any[]) => any);
      }
    });
    return spy;
  }
}

/**
 * Specialized builder for database repository mocks
 */
export class DatabaseRepositoryMockBuilder<T> extends RepositoryMockBuilder<T> {
  /**
   * Adds standard CRUD methods
   */
  withCrudMethods(idPrefix = 'mock'): this {
    return this.withAsyncMethod('create' as keyof T, `${idPrefix}-id`)
      .withAsyncMethod('findById' as keyof T, { id: `${idPrefix}-id` })
      .withAsyncMethod('findAll' as keyof T, [])
      .withAsyncMethod('update' as keyof T, true)
      .withAsyncMethod('delete' as keyof T, true);
  }

  /**
   * Adds pagination methods
   */
  withPaginationMethods(): this {
    return this.withAsyncMethod('findPaginated' as keyof T, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }).withAsyncMethod('count' as keyof T, 0);
  }

  /**
   * Adds transaction methods
   */
  withTransactionMethods(): this {
    return this.withAsyncMethod('beginTransaction' as keyof T, undefined)
      .withAsyncMethod('commit' as keyof T, undefined)
      .withAsyncMethod('rollback' as keyof T, undefined);
  }
}

/**
 * Factory function for quick repository mock creation
 */
export function createRepositoryMock<T>(config?: {
  methods?: (keyof T)[];
  asyncMethods?: { [K in keyof T]?: unknown };
  properties?: Partial<T>;
}): T {
  const builder = new RepositoryMockBuilder<T>();

  if (config?.methods) {
    config.methods.forEach((method) => builder.withMethod(method));
  }

  if (config?.asyncMethods) {
    Object.entries(config.asyncMethods).forEach(([method, value]) => {
      builder.withAsyncMethod(method as keyof T, value);
    });
  }

  if (config?.properties) {
    builder.withProperties(config.properties);
  }

  return builder.build();
}
