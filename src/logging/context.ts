/**
 * Correlation ID context management using AsyncLocalStorage
 * Provides request/job tracking across async operations
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type Context = {
  cid: string; // Correlation ID
  scope?: string; // Optional scope identifier
  userId?: string; // Optional user identifier
};

// AsyncLocalStorage instance for maintaining context across async calls
export const contextStore = new AsyncLocalStorage<Context>();

/**
 * Execute a function within a correlation context
 * @param fn Function to execute
 * @param seed Optional partial context to merge
 * @returns Result of the function
 */
export function withContext<T>(fn: () => T, seed?: Partial<Context>): T {
  const cid = seed?.cid ?? randomUUID();
  return contextStore.run({ cid, ...seed }, fn);
}

/**
 * Get current correlation ID
 * @returns Current correlation ID or undefined
 */
export function getCid(): string | undefined {
  return contextStore.getStore()?.cid;
}

/**
 * Get current context
 * @returns Current context or undefined
 */
export function getContext(): Context | undefined {
  return contextStore.getStore();
}

/**
 * Enrich metadata with correlation ID
 * @param meta Metadata object to enrich
 * @returns Enriched metadata
 */
export function enrich(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const context = getContext();
  if (!context) return meta;

  return {
    cid: context.cid,
    ...(context.scope && { scope: context.scope }),
    ...(context.userId && { userId: context.userId }),
    ...meta,
  };
}
