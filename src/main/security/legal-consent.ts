import type { BrowserWindow } from 'electron';
import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Legal Consent Manager
 */
export class LegalConsentManager {
  private static consentFilePath = path.join(app.getPath('userData'), 'consent.json');
  
  private static readonly consentText = {
    ja: `本アプリケーションは、技術的な検証および教育、そして私的利用を目的としています。

重要な注意事項：
• コンテンツのダウンロードは、各サービスの利用規約と著作権法を遵守してください
• DRM保護されたコンテンツのダウンロードはサポートされていません
• 商用利用や再配布は禁止されています
• 本アプリを利用したことによるいかなる問題についても、開発者は責任を負いません

この条件に同意することで、あなたは：
1. 適用される全ての法律と規制を遵守することに同意します
2. ダウンロードする権利を持つコンテンツのみをダウンロードすることに同意します
3. 本アプリケーションを教育目的または私的利用のみに使用することに同意します`,
    
    en: `This application is intended for technical verification, educational purposes, and private use only.

IMPORTANT NOTICES:
• Content downloads must comply with each service's terms of use and copyright laws
• DRM-protected content downloading is not supported
• Commercial use and redistribution are prohibited
• The developers assume no responsibility for any issues arising from the use of this application

By agreeing to these terms, you acknowledge that:
1. You will comply with all applicable laws and regulations
2. You will only download content you have the right to download
3. You will use this application for educational or private purposes only`,
  };
  
  /**
   * Check if user has consented
   */
  static async hasUserConsented(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.consentFilePath)) {
        return false;
      }
      
      const consentData = JSON.parse(
        await fs.promises.readFile(this.consentFilePath, 'utf-8')
      );
      
      return consentData.consented === true && consentData.version === this.getCurrentVersion();
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }
  
  /**
   * Show consent dialog
   */
  static async showConsentDialog(parentWindow?: BrowserWindow): Promise<boolean> {
    const locale = app.getLocale();
    const isJapanese = locale.startsWith('ja');
    const consentText = isJapanese ? this.consentText.ja : this.consentText.en;
    
    const options = {
      type: 'warning' as const,
      title: isJapanese ? '利用規約への同意' : 'Terms of Use Agreement',
      message: isJapanese ? '利用規約' : 'Terms of Use',
      detail: consentText,
      buttons: [
        isJapanese ? '同意しない' : 'Decline',
        isJapanese ? '同意する' : 'Accept',
      ],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    
    const result = parentWindow 
      ? await dialog.showMessageBox(parentWindow, options)
      : await dialog.showMessageBox(options);
    
    const accepted = result.response === 1;
    
    if (accepted) {
      await this.saveConsent();
    }
    
    return accepted;
  }
  
  /**
   * Save user consent
   */
  private static async saveConsent(): Promise<void> {
    const consentData = {
      consented: true,
      timestamp: new Date().toISOString(),
      version: this.getCurrentVersion(),
      appVersion: app.getVersion(),
    };
    
    try {
      await fs.promises.writeFile(
        this.consentFilePath,
        JSON.stringify(consentData, null, 2)
      );
    } catch (error) {
      console.error('Error saving consent:', error);
    }
  }
  
  /**
   * Revoke consent
   */
  static async revokeConsent(): Promise<void> {
    try {
      if (fs.existsSync(this.consentFilePath)) {
        await fs.promises.unlink(this.consentFilePath);
      }
    } catch (error) {
      console.error('Error revoking consent:', error);
    }
  }
  
  /**
   * Get current consent version
   */
  private static getCurrentVersion(): string {
    return '1.0.0'; // Update this when terms change
  }
  
  /**
   * Get consent information
   */
  static async getConsentInfo(): Promise<any | null> {
    try {
      if (!fs.existsSync(this.consentFilePath)) {
        return null;
      }
      
      return JSON.parse(
        await fs.promises.readFile(this.consentFilePath, 'utf-8')
      );
    } catch (error) {
      console.error('Error reading consent info:', error);
      return null;
    }
  }
  
  /**
   * Show disclaimer in About dialog
   */
  static getDisclaimerText(): string {
    const locale = app.getLocale();
    const isJapanese = locale.startsWith('ja');
    
    if (isJapanese) {
      return `このアプリケーションは教育目的および私的利用のみを目的としています。
著作権法および各サービスの利用規約を遵守してください。`;
    } else {
      return `This application is for educational and private use only.
Please comply with copyright laws and each service's terms of use.`;
    }
  }
  
  /**
   * Check and prompt for consent on first launch
   */
  static async checkAndPromptConsent(parentWindow?: BrowserWindow): Promise<boolean> {
    const hasConsented = await this.hasUserConsented();
    
    if (!hasConsented) {
      const accepted = await this.showConsentDialog(parentWindow);
      
      if (!accepted) {
        // User declined, quit the app
        const locale = app.getLocale();
        const isJapanese = locale.startsWith('ja');
        
        const exitOptions = {
          type: 'info' as const,
          title: isJapanese ? 'アプリケーション終了' : 'Application Exit',
          message: isJapanese 
            ? '利用規約に同意いただけない場合、アプリケーションを使用することはできません。'
            : 'You cannot use this application without accepting the terms of use.',
          buttons: ['OK'],
        };
        
        if (parentWindow) {
          await dialog.showMessageBox(parentWindow, exitOptions);
        } else {
          await dialog.showMessageBox(exitOptions);
        }
        
        return false;
      }
    }
    
    return true;
  }
}