import { describe, it, expect } from 'bun:test';
import {
  downloadSpecSchema,
  taskIdSchema,
  settingKeySchema,
  filePathSchema,
  urlSchema,
  sanitizeString,
  sanitizeFilename,
  sanitizePath,
  validateInput,
} from '../validation';

describe('Validation Schemas', () => {
  describe('downloadSpecSchema', () => {
    it('should validate correct download spec', () => {
      const valid = {
        url: 'https://example.com/video.mp4',
        outputPath: '/home/user/downloads/video.mp4',
        quality: 'high',
        format: 'mp4',
      };

      const result = downloadSpecSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const invalid = {
        url: 'not-a-url',
        outputPath: '/home/user/downloads/video.mp4',
      };

      const result = downloadSpecSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid quality values', () => {
      const invalid = {
        url: 'https://example.com/video.mp4',
        outputPath: '/home/user/downloads/video.mp4',
        quality: 'ultra-high',
      };

      const result = downloadSpecSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('taskIdSchema', () => {
    it('should validate UUID format', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = taskIdSchema.safeParse(validUuid);
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID strings', () => {
      const invalid = 'not-a-uuid';
      const result = taskIdSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('settingKeySchema', () => {
    it('should validate valid setting keys', () => {
      const validKeys = ['download.path', 'quality_default', 'auto-start'];

      validKeys.forEach((key) => {
        const result = settingKeySchema.safeParse(key);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid characters', () => {
      const invalidKeys = ['key with spaces', 'key@special', 'key#hash'];

      invalidKeys.forEach((key) => {
        const result = settingKeySchema.safeParse(key);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('filePathSchema', () => {
    it('should validate clean file paths', () => {
      const validPath = '/home/user/downloads/video.mp4';
      const result = filePathSchema.safeParse(validPath);
      expect(result.success).toBe(true);
    });

    it('should reject paths with null bytes', () => {
      const invalidPath = '/home/user/file\0.txt';
      const result = filePathSchema.safeParse(invalidPath);
      expect(result.success).toBe(false);
    });

    it('should reject paths with directory traversal', () => {
      const invalidPath = '/home/user/../../../etc/passwd';
      const result = filePathSchema.safeParse(invalidPath);
      expect(result.success).toBe(false);
    });

    it('should reject empty paths', () => {
      const result = filePathSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('urlSchema', () => {
    it('should accept HTTP and HTTPS URLs', () => {
      const validUrls = [
        'http://example.com',
        'https://example.com/path',
        'https://subdomain.example.com:8080/path?query=value',
      ];

      validUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(true);
      });
    });

    it('should reject non-HTTP(S) protocols', () => {
      const invalidUrls = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      invalidUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(false);
      });
    });
  });
});

describe('Sanitization Functions', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = 'Hello <script>alert(1)</script> World';
      const result = sanitizeString(input);
      expect(result).toBe('Hello scriptalert(1)/script World');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should limit string length', () => {
      const input = 'a'.repeat(2000);
      const result = sanitizeString(input, 100);
      expect(result.length).toBe(100);
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid filename characters', () => {
      const input = 'file<>:"/\\|?*.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('file_________.txt');
    });

    it('should remove leading/trailing dots', () => {
      const input = '...file.txt...';
      const result = sanitizeFilename(input);
      expect(result).toBe('file.txt');
    });

    it('should limit filename length to 255 characters', () => {
      const input = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(255);
      // Note: Current implementation truncates at 255 chars, doesn't preserve extension
      expect(result).toBe('a'.repeat(255));
    });
  });

  describe('sanitizePath', () => {
    it('should remove null bytes', () => {
      const input = '/path/to/file\0.txt';
      const result = sanitizePath(input);
      expect(result).toBe('/path/to/file.txt');
    });

    it('should normalize slashes', () => {
      const input = 'C:\\Users\\test\\file.txt';
      const result = sanitizePath(input);
      expect(result).toBe('C:/Users/test/file.txt');
    });

    it('should remove duplicate slashes', () => {
      const input = '/path//to///file.txt';
      const result = sanitizePath(input);
      expect(result).toBe('/path/to/file.txt');
    });
  });
});

describe('validateInput', () => {
  it('should return success for valid input', () => {
    const schema = urlSchema;
    const input = 'https://example.com';

    const result = validateInput(schema, input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(input);
    }
  });

  it('should return error for invalid input', () => {
    const schema = urlSchema;
    const input = 'not-a-url';

    const result = validateInput(schema, input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Validation error');
    }
  });
});
