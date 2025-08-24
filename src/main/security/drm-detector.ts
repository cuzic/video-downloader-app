import type { BrowserWindow } from 'electron';
import { dialog, shell } from 'electron';

/**
 * DRM Detection System
 */
export class DRMDetector {
  private static blacklistedDomains = new Set([
    'netflix.com',
    'hulu.com',
    'disneyplus.com',
    'amazon.com',
    'primevideo.com',
    'hbomax.com',
    'peacocktv.com',
    'paramountplus.com',
    'appletv.com',
    'spotify.com',
    'tidal.com',
    'deezer.com',
  ]);

  private static drmIndicators = [
    'widevine',
    'playready',
    'fairplay',
    'clearkey',
    'encrypted-media',
    'eme',
    'MediaKeySession',
    'MediaKeys',
    'requestMediaKeySystemAccess',
    'license.vdocipher',
    'license.irdeto',
    'drm.technology',
  ];

  private static detectionLog: Array<{
    timestamp: Date;
    url: string;
    type: string;
    blocked: boolean;
  }> = [];

  /**
   * Check if URL is from a known DRM-protected service
   */
  static isDRMProtectedDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check against blacklisted domains
      for (const domain of this.blacklistedDomains) {
        if (hostname.includes(domain)) {
          this.logDetection(url, 'blacklisted-domain', true);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('DRM domain check error:', error);
      return false;
    }
  }

  /**
   * Inject DRM detection script into web contents
   */
  static injectDRMDetectionScript(window: BrowserWindow): void {
    const detectionScript = `
      (function() {
        // Override EME APIs to detect DRM usage
        const originalRequestMediaKeySystemAccess = navigator.requestMediaKeySystemAccess;
        if (originalRequestMediaKeySystemAccess) {
          navigator.requestMediaKeySystemAccess = function(...args) {
            console.warn('DRM detected: requestMediaKeySystemAccess called', args);
            window.electronAPI?.drmDetected?.({
              type: 'eme-api',
              keySystem: args[0],
              url: window.location.href
            });
            // Block the request
            return Promise.reject(new Error('DRM content is not supported'));
          };
        }
        
        // Detect Widevine
        if (navigator.plugins) {
          for (let i = 0; i < navigator.plugins.length; i++) {
            const plugin = navigator.plugins[i];
            if (plugin.name && plugin.name.toLowerCase().includes('widevine')) {
              window.electronAPI?.drmDetected?.({
                type: 'widevine-plugin',
                url: window.location.href
              });
            }
          }
        }
        
        // Monitor for DRM-related elements
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                  const element = node;
                  const tagName = element.tagName?.toLowerCase();
                  
                  // Check for video/audio elements with encryption
                  if ((tagName === 'video' || tagName === 'audio') && element.encrypted) {
                    window.electronAPI?.drmDetected?.({
                      type: 'encrypted-media-element',
                      url: window.location.href
                    });
                  }
                  
                  // Check for DRM-related attributes
                  const html = element.outerHTML?.toLowerCase() || '';
                  const drmKeywords = ['drm', 'widevine', 'playready', 'fairplay', 'encrypted'];
                  if (drmKeywords.some(keyword => html.includes(keyword))) {
                    window.electronAPI?.drmDetected?.({
                      type: 'drm-keyword-detected',
                      url: window.location.href
                    });
                  }
                }
              });
            }
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Check for DRM in manifest files
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = args[0]?.toString() || '';
          if (url.includes('.mpd') || url.includes('.m3u8')) {
            return originalFetch.apply(this, args).then(response => {
              const clonedResponse = response.clone();
              clonedResponse.text().then(text => {
                const lowerText = text.toLowerCase();
                if (lowerText.includes('contentprotection') || 
                    lowerText.includes('drm') || 
                    lowerText.includes('widevine') ||
                    lowerText.includes('playready') ||
                    lowerText.includes('urn:uuid')) {
                  window.electronAPI?.drmDetected?.({
                    type: 'drm-in-manifest',
                    url: window.location.href,
                    manifestUrl: url
                  });
                }
              });
              return response;
            });
          }
          return originalFetch.apply(this, args);
        };
      })();
    `;

    window.webContents.on('dom-ready', () => {
      window.webContents.executeJavaScript(detectionScript).catch((error: Error) => {
        console.error('Failed to inject DRM detection script:', error);
      });
    });
  }

  /**
   * Handle DRM detection event
   */
  static async handleDRMDetection(data: {
    type: string;
    url: string;
    keySystem?: string;
    manifestUrl?: string;
  }): Promise<void> {
    this.logDetection(data.url, data.type, true);

    // Show user notification
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'DRM Protected Content Detected',
      message: 'DRM protected content cannot be downloaded',
      detail: `This content appears to be protected by Digital Rights Management (DRM) and cannot be downloaded.\n\nURL: ${data.url}\nType: ${data.type}`,
      buttons: ['OK', 'Learn More'],
      defaultId: 0,
    });

    if (result.response === 1) {
      // Open information about DRM
      void shell.openExternal('https://en.wikipedia.org/wiki/Digital_rights_management');
    }
  }

  /**
   * Check if content has DRM indicators
   */
  static hasDRMIndicators(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return this.drmIndicators.some((indicator) => lowerContent.includes(indicator));
  }

  /**
   * Log DRM detection event
   */
  private static logDetection(url: string, type: string, blocked: boolean): void {
    const entry = {
      timestamp: new Date(),
      url,
      type,
      blocked,
    };

    this.detectionLog.push(entry);

    // Keep only last 100 entries
    if (this.detectionLog.length > 100) {
      this.detectionLog.shift();
    }

    console.log('DRM Detection:', entry);
  }

  /**
   * Get detection log
   */
  static getDetectionLog(): typeof DRMDetector.detectionLog {
    return [...this.detectionLog];
  }

  /**
   * Clear detection log
   */
  static clearDetectionLog(): void {
    this.detectionLog = [];
  }

  /**
   * Add domain to blacklist
   */
  static addBlacklistedDomain(domain: string): void {
    this.blacklistedDomains.add(domain.toLowerCase());
  }

  /**
   * Remove domain from blacklist
   */
  static removeBlacklistedDomain(domain: string): void {
    this.blacklistedDomains.delete(domain.toLowerCase());
  }

  /**
   * Get blacklisted domains
   */
  static getBlacklistedDomains(): string[] {
    return Array.from(this.blacklistedDomains);
  }
}
