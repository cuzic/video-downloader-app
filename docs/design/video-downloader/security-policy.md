# Video Downloader セキュリティポリシー

## 1. 基本方針

### 1.1 法的コンプライアンス

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 重要な法的通知

本アプリケーションは、技術的な検証および教育、そして私的利用を
目的としています。

コンテンツのダウンロードは、各サービスの利用規約と著作権法を
遵守してください。

本アプリを利用したことによるいかなる問題についても、
開発者は責任を負いません。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.2 DRM保護コンテンツの取り扱い

**本アプリケーションはDRM保護されたコンテンツのダウンロードを一切サポートしません。**

#### DRM検出基準
- EME (Encrypted Media Extensions) の使用
- Widevine, PlayReady, FairPlay等のDRMシステム
- HLSマニフェストの `#EXT-X-KEY:METHOD=SAMPLE-AES`
- DASHマニフェストの `<ContentProtection>` 要素
- License Server URLの存在

#### DRM検出時の動作
1. 即座にダウンロード不可としてマーク
2. UIで明確にブロック理由を表示
3. ダウンロード試行を拒否

## 2. 初回起動時の同意フロー

```typescript
interface LegalAgreement {
  version: string;
  agreedAt?: Date;
  userId: string;
}

// 初回起動時の同意画面
class LegalAgreementDialog {
  async show(): Promise<boolean> {
    // 利用規約と免責事項を表示
    // ユーザーが同意しない限りアプリケーションは起動しない
    const agreed = await showModal({
      title: '利用規約への同意',
      content: LEGAL_AGREEMENT_TEXT,
      buttons: ['同意する', '同意しない']
    });
    
    if (!agreed) {
      app.quit();
      return false;
    }
    
    // 同意記録を保存
    await saveAgreement({
      version: AGREEMENT_VERSION,
      agreedAt: new Date(),
      userId: generateUserId()
    });
    
    return true;
  }
}
```

## 3. Electronセキュリティ設定

### 3.1 BrowserWindow設定

```typescript
const secureWindowConfig: BrowserWindowConstructorOptions = {
  webPreferences: {
    // 必須のセキュリティ設定
    sandbox: true,                    // サンドボックス有効化
    contextIsolation: true,           // コンテキスト分離
    nodeIntegration: false,           // Node.js統合無効化
    nodeIntegrationInWorker: false,   // Worker内でもNode.js無効化
    nodeIntegrationInSubFrames: false,// サブフレームでもNode.js無効化
    enableRemoteModule: false,        // remoteモジュール無効化
    webSecurity: true,                // Webセキュリティ有効化
    allowRunningInsecureContent: false, // HTTPSページでのHTTPコンテンツ禁止
    experimentalFeatures: false,      // 実験的機能無効化
    enableBlinkFeatures: '',          // Blink機能の無効化
    
    // セッション分離
    partition: 'persist:main',        // セッション分離
    
    // プリロードスクリプト（必須）
    preload: path.join(__dirname, 'preload.js')
  }
};
```

### 3.2 Content Security Policy (CSP)

```typescript
const CSP_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https:;
  media-src 'none';
  object-src 'none';
  frame-src 'none';
  worker-src 'self';
  form-action 'self';
  base-uri 'self';
  frame-ancestors 'none';
`.replace(/\s+/g, ' ').trim();

// CSPヘッダーの設定
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [CSP_POLICY]
    }
  });
});
```

### 3.3 ナビゲーション制御

```typescript
// 許可されたドメインリスト
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  // アプリケーション内部のみ
];

// ナビゲーション制御
app.on('web-contents-created', (event, contents) => {
  // ナビゲーション前の検証
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      event.preventDefault();
      console.warn(`Navigation blocked: ${url}`);
    }
  });
  
  // 新規ウィンドウのブロック
  contents.setWindowOpenHandler(({ url }) => {
    // 外部リンクはデフォルトブラウザで開く
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  
  // Webview の無効化
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});
```

## 4. データセキュリティ

### 4.1 Cookie/認証情報の取り扱い

```typescript
import keytar from 'keytar';

class SecureCredentialManager {
  private readonly SERVICE_NAME = 'VideoDownloader';
  private memoryCache = new Map<string, string>();
  
  // メモリ内揮発保存（セッション限定）
  setSessionCredential(key: string, value: string): void {
    this.memoryCache.set(key, value);
  }
  
  // OSセキュアストア保存（永続化が必要な場合）
  async setSecureCredential(key: string, value: string): Promise<void> {
    await keytar.setPassword(this.SERVICE_NAME, key, value);
  }
  
  // 取得
  async getCredential(key: string): Promise<string | null> {
    // まずメモリから
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }
    // 次にセキュアストアから
    return await keytar.getPassword(this.SERVICE_NAME, key);
  }
  
  // クリーンアップ
  clearAll(): void {
    this.memoryCache.clear();
    // セキュアストアからも削除
    keytar.findCredentials(this.SERVICE_NAME).then(creds => {
      creds.forEach(cred => {
        keytar.deletePassword(this.SERVICE_NAME, cred.account);
      });
    });
  }
}
```

### 4.2 セッション分離

```typescript
// サイトごとにセッションを分離
class PartitionedSessionManager {
  private sessions = new Map<string, Session>();
  
  getSession(domain: string): Session {
    const partitionKey = `persist:${domain}`;
    
    if (!this.sessions.has(partitionKey)) {
      const ses = session.fromPartition(partitionKey);
      
      // セッション固有の設定
      ses.setUserAgent(this.getUserAgent());
      ses.setProxy(this.getProxyConfig());
      
      // Cookie分離
      ses.cookies.on('changed', (event, cookie) => {
        // Cookieの変更を監視（必要に応じてフィルタリング）
        if (this.shouldBlockCookie(cookie)) {
          ses.cookies.remove(cookie.domain, cookie.name);
        }
      });
      
      this.sessions.set(partitionKey, ses);
    }
    
    return this.sessions.get(partitionKey)!;
  }
  
  private shouldBlockCookie(cookie: Electron.Cookie): boolean {
    // トラッキングCookieなどをブロック
    const blockedNames = ['_ga', '_gid', 'fbp', '__utm'];
    return blockedNames.some(name => cookie.name.startsWith(name));
  }
}
```

## 5. ファイルシステムセキュリティ

### 5.1 パス検証

```typescript
import path from 'path';
import fs from 'fs-extra';

class SecurePathValidator {
  private downloadRoot: string;
  
  constructor() {
    this.downloadRoot = app.getPath('downloads');
  }
  
  async validateAndNormalize(userPath: string): Promise<string | null> {
    try {
      // 絶対パスに変換
      const absolutePath = path.isAbsolute(userPath) 
        ? userPath 
        : path.join(this.downloadRoot, userPath);
      
      // 正規化（../ などを解決）
      const normalizedPath = path.normalize(absolutePath);
      
      // シンボリックリンクを解決
      const realPath = await fs.realpath(normalizedPath).catch(() => normalizedPath);
      
      // ダウンロードディレクトリ内かチェック
      if (!realPath.startsWith(this.downloadRoot)) {
        console.error(`Path escape attempt: ${userPath} -> ${realPath}`);
        return null;
      }
      
      // UNCパスの拒否
      if (realPath.startsWith('\\\\')) {
        console.error(`UNC path rejected: ${realPath}`);
        return null;
      }
      
      // 予約文字のサニタイズ
      const basename = path.basename(realPath);
      const sanitized = this.sanitizeFileName(basename);
      
      return path.join(path.dirname(realPath), sanitized);
    } catch (error) {
      console.error('Path validation error:', error);
      return null;
    }
  }
  
  private sanitizeFileName(fileName: string): string {
    // Windows/Unix予約文字を置換
    const reserved = /[<>:"/\\|?*\x00-\x1F]/g;
    let sanitized = fileName.replace(reserved, '_');
    
    // 長さ制限（255文字）
    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, maxLength - ext.length - 1) + ext;
    }
    
    return sanitized;
  }
}
```

### 5.2 ディスク容量チェック

```typescript
import checkDiskSpace from 'check-disk-space';

class DiskSpaceManager {
  private readonly MIN_FREE_SPACE = 500 * 1024 * 1024; // 500MB
  
  async hasEnoughSpace(downloadPath: string, expectedSize?: number): Promise<boolean> {
    const { free } = await checkDiskSpace(downloadPath);
    
    const required = expectedSize || this.MIN_FREE_SPACE;
    
    if (free < required) {
      throw new Error(`Insufficient disk space. Required: ${required}, Available: ${free}`);
    }
    
    return true;
  }
  
  async getAvailableSpace(downloadPath: string): Promise<number> {
    const { free } = await checkDiskSpace(downloadPath);
    return free;
  }
}
```

## 6. ネットワークセキュリティ

### 6.1 URL検証

```typescript
class SecureUrlValidator {
  private readonly BLOCKED_DOMAINS = [
    // 既知の悪意のあるドメイン
  ];
  
  private readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];
  
  validate(urlString: string): { valid: boolean; reason?: string } {
    try {
      const url = new URL(urlString);
      
      // プロトコルチェック
      if (!this.ALLOWED_PROTOCOLS.includes(url.protocol)) {
        return { valid: false, reason: `Invalid protocol: ${url.protocol}` };
      }
      
      // ローカルアドレスのブロック（SSRF対策）
      if (this.isLocalAddress(url.hostname)) {
        return { valid: false, reason: 'Local addresses are not allowed' };
      }
      
      // ブラックリストチェック
      if (this.BLOCKED_DOMAINS.some(domain => url.hostname.includes(domain))) {
        return { valid: false, reason: 'Domain is blocked' };
      }
      
      // 危険なパスのチェック
      if (this.hasDangerousPath(url.pathname)) {
        return { valid: false, reason: 'Dangerous path detected' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }
  
  private isLocalAddress(hostname: string): boolean {
    const localPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fe80:/i
    ];
    
    return localPatterns.some(pattern => pattern.test(hostname));
  }
  
  private hasDangerousPath(pathname: string): boolean {
    const dangerousPatterns = [
      /\.\.\//,  // Directory traversal
      /%2e%2e/i, // Encoded directory traversal
      /[<>]/     // HTML injection attempt
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(pathname));
  }
}
```

### 6.2 証明書検証

```typescript
// 証明書検証の強化
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // デフォルトの証明書エラー処理を防ぐ
  event.preventDefault();
  
  // 開発環境でのみlocalhostを許可
  if (process.env.NODE_ENV === 'development' && url.startsWith('https://localhost')) {
    callback(true);
    return;
  }
  
  // プロダクション環境では全ての証明書エラーを拒否
  console.error(`Certificate error for ${url}:`, error);
  callback(false);
});
```

## 7. プロセス分離

### 7.1 FFmpeg実行の分離

```typescript
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

class SecureFFmpegExecutor {
  private processes = new Map<string, ChildProcess>();
  
  async execute(args: string[]): Promise<{ id: string; process: ChildProcess }> {
    const id = uuidv4();
    
    // 引数のサニタイズ
    const sanitizedArgs = this.sanitizeArgs(args);
    
    // 環境変数のクリーンアップ
    const env = {
      PATH: process.env.PATH,
      // 最小限の環境変数のみ
    };
    
    // プロセス起動
    const ffmpegProcess = spawn('ffmpeg', sanitizedArgs, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: false, // シェル経由の実行を禁止
    });
    
    // タイムアウト設定
    const timeout = setTimeout(() => {
      this.killProcess(id);
    }, 30 * 60 * 1000); // 30分
    
    ffmpegProcess.on('exit', () => {
      clearTimeout(timeout);
      this.processes.delete(id);
    });
    
    this.processes.set(id, ffmpegProcess);
    
    return { id, process: ffmpegProcess };
  }
  
  private sanitizeArgs(args: string[]): string[] {
    // 危険な引数をフィルタリング
    const dangerous = [
      '-filter_complex',
      'concat:',
      'pipe:',
      '/dev/',
      '\\.\\'
    ];
    
    return args.filter(arg => {
      return !dangerous.some(d => arg.includes(d));
    });
  }
  
  killProcess(id: string): void {
    const process = this.processes.get(id);
    if (process) {
      // Windowsの場合
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', process.pid.toString(), '/f', '/t']);
      } else {
        // Unix系の場合
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      }
      this.processes.delete(id);
    }
  }
  
  killAll(): void {
    for (const id of this.processes.keys()) {
      this.killProcess(id);
    }
  }
}
```

## 8. ロギングとプライバシー

### 8.1 セキュアロギング

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

class SecureLogger {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(info => {
          // PII/認証情報の除去
          return this.sanitizeLog(info);
        })
      ),
      transports: [
        new DailyRotateFile({
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          dirname: app.getPath('logs')
        })
      ]
    });
  }
  
  private sanitizeLog(info: any): string {
    const sanitized = { ...info };
    
    // 機密情報のパターン
    const sensitivePatterns = [
      /password["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /token["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /api[_-]?key["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /cookie["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /authorization["\s]*[:=]["\s]*["'][^"']+["']/gi,
    ];
    
    let message = JSON.stringify(sanitized);
    
    sensitivePatterns.forEach(pattern => {
      message = message.replace(pattern, '[REDACTED]');
    });
    
    return message;
  }
  
  info(message: string, meta?: any): void {
    this.logger.info(message, this.sanitizeMeta(meta));
  }
  
  error(message: string, error?: Error, meta?: any): void {
    this.logger.error(message, {
      error: error?.message,
      stack: error?.stack,
      ...this.sanitizeMeta(meta)
    });
  }
  
  private sanitizeMeta(meta: any): any {
    if (!meta) return {};
    
    const sanitized = { ...meta };
    
    // URLからクエリパラメータを除去
    if (sanitized.url) {
      try {
        const url = new URL(sanitized.url);
        url.search = '';
        sanitized.url = url.toString();
      } catch {}
    }
    
    // ヘッダーから認証情報を除去
    if (sanitized.headers) {
      const safeHeaders = { ...sanitized.headers };
      delete safeHeaders.authorization;
      delete safeHeaders.cookie;
      delete safeHeaders['x-api-key'];
      sanitized.headers = safeHeaders;
    }
    
    return sanitized;
  }
}
```

## 9. 自動更新セキュリティ

### 9.1 署名検証

```typescript
import { autoUpdater } from 'electron-updater';

class SecureAutoUpdater {
  constructor() {
    // 署名検証を必須に
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    
    // HTTPSのみ許可
    autoUpdater.requestHeaders = {
      'Cache-Control': 'no-cache'
    };
    
    // 更新サーバーの設定
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'your-org',
      repo: 'your-repo',
      private: false,
      token: process.env.GH_TOKEN // 環境変数から取得
    });
    
    // 証明書検証
    autoUpdater.on('error', (error) => {
      if (error.message.includes('certificate')) {
        console.error('Update certificate verification failed:', error);
        // 更新を中止
        autoUpdater.quitAndInstall = () => {};
      }
    });
  }
  
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      console.error('Update check failed:', error);
    }
  }
}
```

## 10. セキュリティチェックリスト

### 開発時
- [ ] すべての外部入力の検証
- [ ] SQLインジェクション対策（パラメータバインディング）
- [ ] XSS対策（出力エスケープ）
- [ ] CSRF対策（トークン検証）
- [ ] パストラバーサル対策
- [ ] 機密情報の非ハードコーディング

### ビルド時
- [ ] 依存関係の脆弱性スキャン（npm audit）
- [ ] コード署名の実施
- [ ] 難読化の検討
- [ ] デバッグ情報の除去

### 運用時
- [ ] 定期的な依存関係更新
- [ ] セキュリティパッチの適用
- [ ] ログの定期的な監査
- [ ] インシデント対応計画の策定