import { describe, it, expect } from 'bun:test';
import {
  downloadSpecSchema,
  taskIdSchema,
  filePathSchema,
  urlSchema,
  sanitizeFilename,
  sanitizePath,
  validateInput,
} from '../validation';

describe('Validation Schemas', () => {
  describe('downloadSpecSchema', () => {
    it('should validate correct download spec', () => {
      const valid = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        saveDir: '/home/user/downloads',
      };

      const result = downloadSpecSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const invalid = {
        url: 'not-a-url',
        type: 'video',
        saveDir: '/home/user/downloads',
      };

      const result = downloadSpecSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid media types', () => {
      const invalid = {
        url: 'https://example.com/video.mp4',
        type: 'invalid-type',
        saveDir: '/home/user/downloads',
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

  // settingKeySchema tests removed - schema no longer exists in validation.ts

  describe('filePathSchema', () => {
    it('should validate non-empty file paths', () => {
      const validPath = '/home/user/downloads/video.mp4';
      const result = filePathSchema.safeParse(validPath);
      expect(result.success).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = filePathSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
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

    it('should reject invalid URLs', () => {
      const invalidUrls = ['not-a-url', ''];

      invalidUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(false);
      });
    });
  });
});

describe('Sanitization Functions', () => {
  // sanitizeString tests removed - function no longer exists in validation.ts

  describe('sanitizeFilename', () => {
    it('should remove invalid filename characters', () => {
      const input = 'file<>:"/\\|?*.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('file_________.txt');
    });

    it('should handle normal filenames', () => {
      const input = 'normal-file.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('normal-file.txt');
    });
  });

  describe('sanitizePath', () => {
    it('should remove directory traversal patterns', () => {
      const input = '../../../etc/passwd';
      const result = sanitizePath(input);
      expect(result).toBe('etc/passwd');
    });

    it('should handle normal paths', () => {
      const input = '/path/to/file.txt';
      const result = sanitizePath(input);
      expect(result).toBe('path/to/file.txt');
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
      expect(result.error).toBeDefined();
    }
  });
});
