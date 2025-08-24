import { describe, it, expect, beforeAll, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((key: string) => {
      const paths: Record<string, string> = {
        downloads: path.join(os.homedir(), 'Downloads'),
        videos: path.join(os.homedir(), 'Videos'),
        userData: path.join(os.homedir(), '.config', 'video-downloader'),
        temp: os.tmpdir(),
      };
      return paths[key] || path.join(os.homedir(), key);
    }),
  },
}));

import { PathValidator } from '../path-validator';

describe('PathValidator', () => {
  beforeAll(() => {
    PathValidator.initialize();
  });

  describe('isPathSafe', () => {
    it('should reject relative paths', () => {
      expect(PathValidator.isPathSafe('./test.txt')).toBe(false);
      expect(PathValidator.isPathSafe('../test.txt')).toBe(false);
      expect(PathValidator.isPathSafe('test.txt')).toBe(false);
    });

    it('should reject paths with directory traversal', () => {
      const downloadPath = path.join(os.homedir(), 'Downloads');
      expect(PathValidator.isPathSafe(path.join(downloadPath, '../../../etc/passwd'))).toBe(false);
      expect(PathValidator.isPathSafe(path.join(downloadPath, '..', '..', 'etc'))).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      const downloadPath = path.join(os.homedir(), 'Downloads');
      expect(PathValidator.isPathSafe(downloadPath + '\0.txt')).toBe(false);
    });

    it('should accept valid absolute paths in allowed directories', () => {
      const downloadPath = path.join(os.homedir(), 'Downloads', 'test.mp4');
      expect(PathValidator.isPathSafe(downloadPath)).toBe(true);
    });
  });

  describe('hasValidExtension', () => {
    it('should accept allowed extensions', () => {
      expect(PathValidator.hasValidExtension('video.mp4')).toBe(true);
      expect(PathValidator.hasValidExtension('audio.mp3')).toBe(true);
      expect(PathValidator.hasValidExtension('manifest.m3u8')).toBe(true);
    });

    it('should reject disallowed extensions', () => {
      expect(PathValidator.hasValidExtension('script.exe')).toBe(false);
      expect(PathValidator.hasValidExtension('virus.bat')).toBe(false);
      expect(PathValidator.hasValidExtension('shell.sh')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(PathValidator.hasValidExtension('VIDEO.MP4')).toBe(true);
      expect(PathValidator.hasValidExtension('Audio.MP3')).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(PathValidator.sanitizeFilename('test<>:"/\\|?*.mp4')).toBe('test________.mp4');
    });

    it('should remove leading/trailing dots and spaces', () => {
      expect(PathValidator.sanitizeFilename('  .test.mp4.  ')).toBe('test.mp4');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.mp4';
      const sanitized = PathValidator.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.mp4')).toBe(true);
    });

    it('should provide default name for empty input', () => {
      const sanitized = PathValidator.sanitizeFilename('');
      expect(sanitized).toMatch(/^download_\d+$/);
    });
  });

  describe('generateSafeFilePath', () => {
    it('should generate safe path for valid inputs', () => {
      const downloadDir = path.join(os.homedir(), 'Downloads');
      const result = PathValidator.generateSafeFilePath(downloadDir, 'test.mp4');
      expect(result).toBeTruthy();
      expect(result).toContain('test.mp4');
    });

    it('should return null for invalid directory', () => {
      const result = PathValidator.generateSafeFilePath('/etc', 'test.mp4');
      expect(result).toBeNull();
    });

    it('should return null for invalid extension', () => {
      const downloadDir = path.join(os.homedir(), 'Downloads');
      const result = PathValidator.generateSafeFilePath(downloadDir, 'test.exe');
      expect(result).toBeNull();
    });
  });
});
