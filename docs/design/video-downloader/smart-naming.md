# Smart Naming 仕様書

## 1. 概要

Smart Namingは、ダウンロードする動画ファイルに対して、ページのコンテキストから自動的に意味のあるファイル名を生成する機能です。ユーザーが定義したテンプレートに基づいて、動的にトークンを抽出・置換します。

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│                  WebView (Browser)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │         DOM Content (HTML/Metadata)          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                           ↓
                   DOM情報の抽出
                           ↓
┌─────────────────────────────────────────────────────┐
│               Preload Script                         │
│  ┌─────────────────────────────────────────────┐   │
│  │          Token Extractor                     │   │
│  │  - CSS Selector による抽出                    │   │
│  │  - 正規表現による抽出                         │   │
│  │  - メタデータ解析                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                           ↓
                    IPC経由で送信
                           ↓
┌─────────────────────────────────────────────────────┐
│                  Main Process                        │
│  ┌─────────────────────────────────────────────┐   │
│  │         Smart Naming Engine                  │   │
│  │  - テンプレート処理                          │   │
│  │  - トークン置換                              │   │
│  │  - サニタイゼーション                        │   │
│  │  - 重複回避                                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                           ↓
                    最終ファイル名
```

## 3. トークンシステム

### 3.1 標準トークン

| トークン | 説明 | 抽出元 | フォールバック |
|---------|------|--------|---------------|
| `{title}` | ページ/動画タイトル | `<title>`, `og:title`, h1 | "video" |
| `{site}` | サイト名 | ドメイン名, `og:site_name` | ドメイン |
| `{channel}` | チャンネル/投稿者名 | サイト固有セレクタ | "unknown" |
| `{episode}` | エピソード番号 | 正規表現抽出 | "" |
| `{season}` | シーズン番号 | 正規表現抽出 | "" |
| `{quality}` | 動画品質 | 選択されたvariant | "default" |
| `{resolution}` | 解像度 | variant情報 | "" |
| `{date}` | 現在日付 | システム日時 | YYYY-MM-DD |
| `{time}` | 現在時刻 | システム時刻 | HH-MM-SS |
| `{year}` | 年 | システム日時 | YYYY |
| `{month}` | 月 | システム日時 | MM |
| `{day}` | 日 | システム日時 | DD |
| `{timestamp}` | UNIXタイムスタンプ | システム時刻 | 数値 |
| `{uuid}` | ユニークID | UUID v4 | ランダム |
| `{index}` | 連番 | 自動インクリメント | 数値 |

### 3.2 カスタムトークン

ユーザーがサイトごとに独自のトークンを定義可能：

```typescript
interface CustomToken {
  name: string;           // トークン名（{custom_name}）
  sitePattern: string;    // 適用サイトパターン（正規表現）
  extractors: TokenExtractor[];  // 抽出方法のリスト（優先順）
  fallback?: string;      // デフォルト値
  transform?: TokenTransform[];  // 変換処理
}

interface TokenExtractor {
  type: 'selector' | 'regex' | 'meta' | 'jsonld' | 'attribute';
  value: string;          // セレクタ or 正規表現
  attribute?: string;     // 属性名（type='attribute'の場合）
  group?: number;         // 正規表現グループ番号
}

interface TokenTransform {
  type: 'replace' | 'lowercase' | 'uppercase' | 'trim' | 'truncate' | 'sanitize';
  value?: string;         // 変換パラメータ
}
```

## 4. トークン抽出実装

### 4.1 Preload Script（DOM抽出）

```typescript
// preload/token-extractor.ts
class TokenExtractor {
  private tokens: Map<string, string> = new Map();
  
  extractAll(): Record<string, string> {
    this.extractBasicTokens();
    this.extractMetaTags();
    this.extractStructuredData();
    this.extractCustomTokens();
    
    return Object.fromEntries(this.tokens);
  }
  
  private extractBasicTokens(): void {
    // タイトル
    const title = this.extractTitle();
    if (title) this.tokens.set('title', title);
    
    // サイト名
    const site = this.extractSiteName();
    if (site) this.tokens.set('site', site);
    
    // URL関連
    const url = new URL(window.location.href);
    this.tokens.set('domain', url.hostname);
    this.tokens.set('path', url.pathname);
  }
  
  private extractTitle(): string | null {
    // 優先順位付きで抽出
    const strategies = [
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
      () => document.querySelector('h1')?.textContent?.trim(),
      () => document.title,
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result) return this.sanitizeText(result);
    }
    
    return null;
  }
  
  private extractSiteName(): string | null {
    const strategies = [
      () => document.querySelector('meta[property="og:site_name"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="application-name"]')?.getAttribute('content'),
      () => window.location.hostname.replace('www.', '').split('.')[0],
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result) return this.sanitizeText(result);
    }
    
    return null;
  }
  
  private extractMetaTags(): void {
    // Open Graph
    const ogTags = ['description', 'image', 'video', 'audio', 'type'];
    ogTags.forEach(tag => {
      const content = document.querySelector(`meta[property="og:${tag}"]`)?.getAttribute('content');
      if (content) this.tokens.set(`og_${tag}`, content);
    });
    
    // Twitter Card
    const twitterTags = ['creator', 'site', 'description'];
    twitterTags.forEach(tag => {
      const content = document.querySelector(`meta[name="twitter:${tag}"]`)?.getAttribute('content');
      if (content) this.tokens.set(`twitter_${tag}`, content);
    });
  }
  
  private extractStructuredData(): void {
    // JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '{}');
        this.processStructuredData(data);
      } catch (e) {
        console.warn('Failed to parse JSON-LD:', e);
      }
    });
  }
  
  private processStructuredData(data: any, prefix = ''): void {
    if (data['@type'] === 'VideoObject') {
      if (data.name) this.tokens.set('video_name', data.name);
      if (data.description) this.tokens.set('video_description', data.description);
      if (data.duration) this.tokens.set('video_duration', data.duration);
      if (data.uploadDate) this.tokens.set('video_upload_date', data.uploadDate);
      if (data.creator?.name) this.tokens.set('creator', data.creator.name);
    }
    
    if (data['@type'] === 'BreadcrumbList' && data.itemListElement) {
      const breadcrumbs = data.itemListElement
        .map((item: any) => item.name)
        .filter(Boolean)
        .join('_');
      if (breadcrumbs) this.tokens.set('breadcrumb', breadcrumbs);
    }
  }
  
  private extractCustomTokens(): void {
    // サイト固有の抽出ルール
    const siteRules = this.getSiteSpecificRules();
    
    siteRules.forEach(rule => {
      if (rule.urlPattern.test(window.location.href)) {
        rule.tokens.forEach(tokenDef => {
          const value = this.extractByRule(tokenDef);
          if (value) this.tokens.set(tokenDef.name, value);
        });
      }
    });
  }
  
  private getSiteSpecificRules(): SiteRule[] {
    return [
      {
        urlPattern: /youtube\.com/,
        tokens: [
          {
            name: 'channel',
            selector: 'ytd-channel-name a',
            attribute: 'textContent'
          },
          {
            name: 'views',
            selector: '.view-count',
            regex: /([0-9,]+)/,
            group: 1
          }
        ]
      },
      {
        urlPattern: /vimeo\.com/,
        tokens: [
          {
            name: 'channel',
            selector: '.byline a',
            attribute: 'textContent'
          }
        ]
      },
      // 他のサイトルール...
    ];
  }
  
  private extractByRule(rule: TokenDefinition): string | null {
    if (rule.selector) {
      const element = document.querySelector(rule.selector);
      if (element) {
        let value = rule.attribute 
          ? element.getAttribute(rule.attribute) || element.textContent
          : element.textContent;
          
        if (value && rule.regex) {
          const match = value.match(new RegExp(rule.regex));
          value = match?.[rule.group || 0] || null;
        }
        
        return value ? this.sanitizeText(value) : null;
      }
    }
    
    return null;
  }
  
  private sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')           // 複数スペースを単一に
      .replace(/[<>:"/\\|?*]/g, '_')  // ファイル名禁止文字を置換
      .substring(0, 100);              // 長さ制限
  }
}
```

### 4.2 Main Process（テンプレート処理）

```typescript
// main/smart-naming-engine.ts
import { format } from 'date-fns';

class SmartNamingEngine {
  private db: Database;
  private defaultTemplate = '{site}-{title}-{quality}-{date}';
  
  async generateFileName(
    template: string,
    tokens: Record<string, string>,
    context: DownloadContext
  ): Promise<string> {
    // ユーザー定義テンプレートまたはデフォルト
    const finalTemplate = template || this.defaultTemplate;
    
    // コンテキストからトークンを追加
    const allTokens = {
      ...tokens,
      ...this.getContextTokens(context),
      ...this.getSystemTokens(),
    };
    
    // テンプレート処理
    let filename = this.processTemplate(finalTemplate, allTokens);
    
    // サニタイゼーション
    filename = this.sanitizeFileName(filename);
    
    // 重複回避
    filename = await this.ensureUnique(filename, context.saveDir);
    
    return filename;
  }
  
  private getContextTokens(context: DownloadContext): Record<string, string> {
    const tokens: Record<string, string> = {};
    
    if (context.variant) {
      tokens.quality = context.variant.label || context.variant.resolution || 'default';
      tokens.resolution = context.variant.resolution || '';
      tokens.bitrate = context.variant.bandwidth?.toString() || '';
      tokens.codec = context.variant.codecs || '';
    }
    
    if (context.mediaType) {
      tokens.type = context.mediaType;
    }
    
    return tokens;
  }
  
  private getSystemTokens(): Record<string, string> {
    const now = new Date();
    
    return {
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'HH-mm-ss'),
      year: format(now, 'yyyy'),
      month: format(now, 'MM'),
      day: format(now, 'dd'),
      timestamp: now.getTime().toString(),
      uuid: uuidv4().substring(0, 8),
    };
  }
  
  private processTemplate(template: string, tokens: Record<string, string>): string {
    // 条件付きセクション処理
    // {?quality:{quality}_}? → qualityが存在する場合のみ展開
    template = template.replace(
      /\{\?(\w+):([^}]*)\}\?/g,
      (match, tokenName, content) => {
        if (tokens[tokenName]) {
          return content.replace(`{${tokenName}}`, tokens[tokenName]);
        }
        return '';
      }
    );
    
    // 通常のトークン置換
    let result = template;
    Object.entries(tokens).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value || '');
    });
    
    // 未置換トークンの処理
    result = result.replace(/\{[^}]+\}/g, '');
    
    // 連続する区切り文字の削減
    result = result.replace(/[-_]{2,}/g, '_');
    result = result.replace(/^[-_]+|[-_]+$/g, '');
    
    return result;
  }
  
  private sanitizeFileName(filename: string): string {
    // OS予約文字の置換
    const reserved = /[<>:"/\\|?*\x00-\x1F]/g;
    filename = filename.replace(reserved, '_');
    
    // Windows予約名の回避
    const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (windowsReserved.test(filename)) {
      filename = `_${filename}`;
    }
    
    // 空白の正規化
    filename = filename.replace(/\s+/g, '_');
    
    // 長さ制限（拡張子を考慮）
    const maxLength = 200; // 安全マージンを持たせる
    if (filename.length > maxLength) {
      filename = filename.substring(0, maxLength);
    }
    
    // 先頭・末尾の処理
    filename = filename.replace(/^\.+/, ''); // 先頭のドット削除
    filename = filename.replace(/\.+$/, ''); // 末尾のドット削除
    
    return filename || 'download';
  }
  
  private async ensureUnique(filename: string, saveDir: string): Promise<string> {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    
    let counter = 0;
    let finalName = filename;
    
    while (await this.fileExists(path.join(saveDir, finalName))) {
      counter++;
      finalName = `${base}_${counter}${ext}`;
      
      if (counter > 999) {
        // 無限ループ防止
        finalName = `${base}_${Date.now()}${ext}`;
        break;
      }
    }
    
    return finalName;
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

## 5. UI実装

### 5.1 テンプレート編集画面

```typescript
// renderer/components/SmartNamingConfig.tsx
import React, { useState, useEffect } from 'react';

interface SmartNamingConfigProps {
  onSave: (template: string, rules: CustomTokenRule[]) => void;
}

export const SmartNamingConfig: React.FC<SmartNamingConfigProps> = ({ onSave }) => {
  const [template, setTemplate] = useState('{site}-{title}-{quality}-{date}');
  const [preview, setPreview] = useState('');
  const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
  const [customRules, setCustomRules] = useState<CustomTokenRule[]>([]);
  
  // リアルタイムプレビュー
  useEffect(() => {
    updatePreview();
  }, [template]);
  
  const updatePreview = async () => {
    const sampleTokens = {
      site: 'youtube',
      title: 'Sample_Video_Title',
      quality: '1080p',
      date: '2024-01-15',
      channel: 'SampleChannel',
    };
    
    const result = await window.electronAPI.naming.preview(template, sampleTokens);
    setPreview(result);
  };
  
  const handleTokenClick = (token: string) => {
    const cursorPos = inputRef.current?.selectionStart || template.length;
    const newTemplate = 
      template.slice(0, cursorPos) + 
      `{${token}}` + 
      template.slice(cursorPos);
    setTemplate(newTemplate);
  };
  
  const handleAddCustomRule = () => {
    setCustomRules([
      ...customRules,
      {
        id: Date.now().toString(),
        name: '',
        sitePattern: '',
        selector: '',
        enabled: true,
      }
    ]);
  };
  
  return (
    <div className="smart-naming-config">
      <div className="template-section">
        <h3>ファイル名テンプレート</h3>
        <div className="template-input">
          <input
            ref={inputRef}
            type="text"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="ファイル名テンプレートを入力"
          />
          <button onClick={() => setTemplate('{site}-{title}-{quality}-{date}')}>
            デフォルトに戻す
          </button>
        </div>
        
        <div className="token-palette">
          <h4>利用可能なトークン</h4>
          <div className="token-grid">
            {availableTokens.map(token => (
              <button
                key={token.name}
                className="token-button"
                onClick={() => handleTokenClick(token.name)}
                title={token.description}
              >
                {`{${token.name}}`}
              </button>
            ))}
          </div>
        </div>
        
        <div className="preview-section">
          <h4>プレビュー</h4>
          <div className="preview-box">
            <span className="preview-text">{preview || 'プレビューを生成中...'}</span>
            <span className="extension">.mp4</span>
          </div>
        </div>
      </div>
      
      <div className="custom-rules-section">
        <h3>カスタム抽出ルール</h3>
        <div className="rules-list">
          {customRules.map((rule, index) => (
            <CustomRuleEditor
              key={rule.id}
              rule={rule}
              onChange={(updated) => updateRule(index, updated)}
              onDelete={() => deleteRule(index)}
            />
          ))}
        </div>
        <button onClick={handleAddCustomRule}>
          + 新しいルールを追加
        </button>
      </div>
      
      <div className="tips-section">
        <h4>💡 ヒント</h4>
        <ul>
          <li>条件付きトークン: {`{?quality:{quality}_}?`} - qualityが存在する場合のみ表示</li>
          <li>日付フォーマット: {`{date}`} でYYYY-MM-DD形式</li>
          <li>連番: {`{index}`} で自動的に番号付け</li>
        </ul>
      </div>
      
      <div className="actions">
        <button onClick={() => onSave(template, customRules)}>
          保存
        </button>
      </div>
    </div>
  );
};
```

## 6. サイト別設定

### 6.1 プリセット定義

```typescript
// デフォルトのサイト別ルール
const SITE_PRESETS: SitePreset[] = [
  {
    name: 'YouTube',
    pattern: /youtube\.com|youtu\.be/,
    template: '{channel}-{title}-{quality}-{date}',
    tokens: [
      { name: 'channel', selector: 'ytd-channel-name a' },
      { name: 'views', selector: '.view-count', regex: /([0-9,]+)/ },
      { name: 'likes', selector: '[aria-label*="like"]', regex: /([0-9,]+)/ },
    ]
  },
  {
    name: 'Vimeo',
    pattern: /vimeo\.com/,
    template: '{channel}-{title}-{quality}',
    tokens: [
      { name: 'channel', selector: '.byline a' },
      { name: 'plays', selector: '.plays', regex: /([0-9,]+)/ },
    ]
  },
  {
    name: 'Twitch',
    pattern: /twitch\.tv/,
    template: '{channel}-{title}-{date}-{time}',
    tokens: [
      { name: 'channel', selector: '.channel-header__user' },
      { name: 'game', selector: '[data-a-target="stream-game-link"]' },
    ]
  },
  {
    name: 'Generic',
    pattern: /.*/,
    template: '{site}-{title}-{date}',
    tokens: []
  }
];
```

## 7. エクスポート/インポート

### 7.1 設定のエクスポート

```typescript
interface SmartNamingExport {
  version: string;
  templates: {
    default: string;
    sites: Array<{
      pattern: string;
      template: string;
    }>;
  };
  customTokens: CustomToken[];
  createdAt: string;
}

// エクスポート処理
async function exportSettings(): Promise<string> {
  const settings = await db.getSmartNamingSettings();
  const exportData: SmartNamingExport = {
    version: '1.0.0',
    templates: settings.templates,
    customTokens: settings.customTokens,
    createdAt: new Date().toISOString(),
  };
  
  return JSON.stringify(exportData, null, 2);
}

// インポート処理
async function importSettings(jsonString: string): Promise<void> {
  const data: SmartNamingExport = JSON.parse(jsonString);
  
  // バージョン互換性チェック
  if (!isCompatibleVersion(data.version)) {
    throw new Error(`Incompatible version: ${data.version}`);
  }
  
  // バリデーション
  validateImportData(data);
  
  // 設定の適用
  await db.saveSmartNamingSettings({
    templates: data.templates,
    customTokens: data.customTokens,
  });
}
```

## 8. トラブルシューティング

### 8.1 一般的な問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| トークンが置換されない | セレクタが正しくない | 開発者ツールでセレクタを確認 |
| ファイル名が長すぎる | テンプレートが複雑 | 不要なトークンを削除 |
| 重複ファイル名 | 同じ名前の生成 | {timestamp}や{uuid}を追加 |
| 文字化け | エンコーディング問題 | UTF-8を確実に使用 |

### 8.2 デバッグモード

```typescript
// デバッグ情報の出力
class SmartNamingDebugger {
  static logExtraction(tokens: Record<string, string>): void {
    console.group('Smart Naming: Token Extraction');
    console.table(tokens);
    console.groupEnd();
  }
  
  static logTemplate(template: string, result: string): void {
    console.group('Smart Naming: Template Processing');
    console.log('Template:', template);
    console.log('Result:', result);
    console.groupEnd();
  }
  
  static logSanitization(before: string, after: string): void {
    console.group('Smart Naming: Sanitization');
    console.log('Before:', before);
    console.log('After:', after);
    console.groupEnd();
  }
}