import { z } from 'zod';

/**
 * Validation schemas for IPC communication
 */

// Download operations
export const downloadSpecSchema = z.object({
  url: z.string().url().max(2048),
  outputPath: z.string().max(500),
  quality: z.enum(['best', 'high', 'medium', 'low']).optional(),
  format: z.enum(['mp4', 'webm', 'mkv', 'mp3', 'aac']).optional(),
  headers: z.record(z.string()).optional(),
});

export const taskIdSchema = z.string().uuid();

// Settings operations
export const settingKeySchema = z.string().max(100).regex(/^[a-zA-Z0-9._-]+$/);

export const settingValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.array(z.string()).max(100),
  z.record(z.string()),
]);

// System operations
export const systemPathNameSchema = z.enum(['home', 'downloads', 'documents', 'videos']);

export const filePathSchema = z.string().max(500).refine((path) => {
  // Basic path validation - more comprehensive validation in main process
  return !path.includes('\0') && !path.includes('..') && path.length > 0;
}, {
  message: 'Invalid file path',
});

export const urlSchema = z.string().url().max(2048).refine((url) => {
  // Only allow http and https protocols
  return url.startsWith('http://') || url.startsWith('https://');
}, {
  message: 'Only HTTP and HTTPS URLs are allowed',
});

// DRM detection
export const drmDetectionSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  keySystem: z.string().optional(),
  manifestUrl: z.string().url().optional(),
});

// Rate limiting
export const rateLimitSchema = z.object({
  maxRequests: z.number().min(1).max(1000),
  windowMs: z.number().min(1000).max(3600000), // 1 second to 1 hour
});

// Sanitization helpers
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

export function sanitizeFilename(filename: string, maxLength: number = 255): string {
  // First, sanitize the filename
  let sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  
  // If the filename is too long, truncate while preserving extension
  if (sanitized.length > maxLength) {
    const lastDotIndex = sanitized.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex < sanitized.length - 1) {
      // Has extension
      const extension = sanitized.substring(lastDotIndex);
      const nameWithoutExt = sanitized.substring(0, lastDotIndex);
      const maxNameLength = maxLength - extension.length;
      
      if (maxNameLength > 0) {
        sanitized = nameWithoutExt.substring(0, maxNameLength) + extension;
      } else {
        // Extension itself is too long, just truncate
        sanitized = sanitized.substring(0, maxLength);
      }
    } else {
      // No extension, just truncate
      sanitized = sanitized.substring(0, maxLength);
    }
  }
  
  return sanitized;
}

export function sanitizePath(path: string): string {
  // Remove null bytes and normalize slashes
  return path
    .replace(/\0/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

// Validation wrapper for IPC handlers
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` 
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}