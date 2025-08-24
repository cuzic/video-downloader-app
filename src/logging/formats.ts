/**
 * Log formatting and PII masking utilities
 */
import { format } from 'winston';

// PII keys that should be redacted in logs
const PII_KEYS = [
  'password',
  'token',
  'authorization',
  'auth',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'email',
  'ssn',
  'creditcard',
  'credit_card',
  'cookie',
  'session',
];

// Patterns for detecting PII in strings
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
  /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, // IP addresses
];

/**
 * Mask PII in a string for testing
 */
export function maskPIIString(value: string): string {
  let masked = value;

  // Email addresses
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***');

  // SSN
  masked = masked.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '***-**-****');

  // Credit cards
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '**** **** **** ****');

  // Phone numbers
  masked = masked.replace(
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '***-***-****'
  );

  // IP addresses
  masked = masked.replace(
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    '***.***.***'
  );

  return masked;
}

/**
 * Recursively scrub PII from objects
 */
function scrubPII(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Check for PII patterns in strings
    let scrubbed = value;
    for (const pattern of PII_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }
    return scrubbed;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubPII(item));
  }

  if (typeof value === 'object') {
    const scrubbed: any = {};
    for (const [key, val] of Object.entries(value)) {
      // Check if key contains PII
      const keyLower = key.toLowerCase();
      const isPIIKey = PII_KEYS.some((piiKey) => keyLower.includes(piiKey));

      if (isPIIKey) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = scrubPII(val);
      }
    }
    return scrubbed;
  }

  return value;
}

/**
 * Winston format for masking PII
 */
export const maskPII = format((info) => {
  // Scrub message if it's an object
  if (typeof info.message === 'object') {
    info.message = JSON.stringify(scrubPII(info.message));
  }

  // Scrub metadata
  if (info.meta) {
    info.meta = scrubPII(info.meta);
  }

  // Scrub any additional properties
  const cleanInfo: any = {};
  for (const [key, value] of Object.entries(info)) {
    if (key === 'level' || key === 'timestamp' || key === 'label') {
      cleanInfo[key] = value;
    } else {
      cleanInfo[key] = scrubPII(value);
    }
  }

  return cleanInfo;
})();

/**
 * Format for development environment (human-readable)
 */
export const devFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  maskPII,
  format.colorize(),
  format.printf(({ timestamp, level, message, cid, scope, ...meta }) => {
    let log = `${String(timestamp)} ${String(level)}`;
    if (cid) log += ` [${String(cid).slice(0, 8)}]`;
    if (scope) log += ` (${String(scope)})`;
    log += `: ${String(message)}`;

    // Add metadata if present
    const metaKeys = Object.keys(meta).filter((k) => k !== 'meta');
    if (metaKeys.length > 0 || meta.meta) {
      const metaStr = JSON.stringify(meta.meta || meta, null, 2);
      log += `\n${metaStr}`;
    }

    return log;
  })
);

/**
 * Format for production environment (JSON lines)
 */
export const jsonFormat = format.combine(format.timestamp(), maskPII, format.json());

/**
 * Compact JSON lines format for file logging
 */
export const jsonLineFormat = format.combine(
  format.timestamp(),
  maskPII,
  format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    return JSON.stringify({
      ts: timestamp,
      level,
      msg: message,
      ...meta,
    });
  })
);
