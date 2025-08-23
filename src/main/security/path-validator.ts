import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Path validation utility for security
 */
export class PathValidator {
  private static allowedBasePaths: string[] = [];
  private static maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB max file size
  private static allowedExtensions = new Set([
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv',
    '.m3u8', '.mpd', '.ts', '.m4s', '.mp3', '.aac', '.ogg',
    '.wav', '.flac', '.srt', '.vtt', '.json', '.xml'
  ]);
  
  /**
   * Initialize allowed base paths
   */
  static initialize(): void {
    this.allowedBasePaths = [
      app.getPath('downloads'),
      app.getPath('videos'),
      app.getPath('userData'),
      app.getPath('temp'),
    ];
    
    // Add custom download directory if configured
    const customPath = process.env.DOWNLOAD_PATH;
    if (customPath && fs.existsSync(customPath)) {
      this.allowedBasePaths.push(path.resolve(customPath));
    }
  }
  
  /**
   * Validate if a path is safe to access
   */
  static isPathSafe(targetPath: string): boolean {
    try {
      // Reject if path is not absolute
      if (!path.isAbsolute(targetPath)) {
        console.warn('Path validation failed: Path is not absolute', targetPath);
        return false;
      }
      
      // Resolve the path to handle symbolic links and normalize it
      const resolvedPath = path.resolve(targetPath);
      
      // Check if path is within allowed directories
      const isWithinAllowed = this.allowedBasePaths.some(basePath => {
        const normalizedBase = path.normalize(basePath);
        const normalizedTarget = path.normalize(resolvedPath);
        return normalizedTarget.startsWith(normalizedBase);
      });
      
      if (!isWithinAllowed) {
        console.warn('Path validation failed: Path is outside allowed directories', targetPath);
        return false;
      }
      
      // Check for directory traversal attempts
      if (resolvedPath.includes('..') || resolvedPath.includes('~')) {
        console.warn('Path validation failed: Directory traversal attempt detected', targetPath);
        return false;
      }
      
      // Check for null bytes (poison null byte attack)
      if (targetPath.includes('\0')) {
        console.warn('Path validation failed: Null byte detected', targetPath);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Path validation error:', error);
      return false;
    }
  }
  
  /**
   * Validate file extension
   */
  static hasValidExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedExtensions.has(ext);
  }
  
  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename: string): string {
    // Remove path components
    const basename = path.basename(filename);
    
    // Remove dangerous characters
    let sanitized = basename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
    
    // Limit length
    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);
      sanitized = nameWithoutExt.slice(0, maxLength - ext.length) + ext;
    }
    
    // Ensure non-empty
    if (!sanitized) {
      sanitized = 'download_' + Date.now();
    }
    
    return sanitized;
  }
  
  /**
   * Generate safe file path
   */
  static generateSafeFilePath(directory: string, filename: string): string | null {
    // Validate directory
    if (!this.isPathSafe(directory)) {
      return null;
    }
    
    // Sanitize filename
    const safeFilename = this.sanitizeFilename(filename);
    
    // Check extension
    if (!this.hasValidExtension(safeFilename)) {
      console.warn('Invalid file extension:', safeFilename);
      return null;
    }
    
    // Construct full path
    const fullPath = path.join(directory, safeFilename);
    
    // Final validation
    if (!this.isPathSafe(fullPath)) {
      return null;
    }
    
    return fullPath;
  }
  
  /**
   * Check if file size is within limits
   */
  static async isFileSizeValid(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size <= this.maxFileSize;
    } catch (error) {
      console.error('File size check error:', error);
      return false;
    }
  }
  
  /**
   * Create directory safely
   */
  static async createDirectorySafely(dirPath: string): Promise<boolean> {
    try {
      if (!this.isPathSafe(dirPath)) {
        return false;
      }
      
      await fs.promises.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Directory creation error:', error);
      return false;
    }
  }
  
  /**
   * Add custom allowed path
   */
  static addAllowedPath(customPath: string): void {
    const resolvedPath = path.resolve(customPath);
    if (fs.existsSync(resolvedPath) && !this.allowedBasePaths.includes(resolvedPath)) {
      this.allowedBasePaths.push(resolvedPath);
    }
  }
  
  /**
   * Get allowed base paths
   */
  static getAllowedPaths(): string[] {
    return [...this.allowedBasePaths];
  }
}