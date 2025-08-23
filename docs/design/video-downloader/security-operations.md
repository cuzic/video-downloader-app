# Video Downloader セキュリティ運用ガイドライン v1.0

## 1. 許可ドメイン管理

### デフォルト許可ドメイン
```json
{
  "allowedDomains": [
    // 動画共有サービス（DRM保護なし）
    "youtube.com",
    "www.youtube.com",
    "vimeo.com",
    "player.vimeo.com",
    "dailymotion.com",
    "www.dailymotion.com",
    
    // 教育・オープンコンテンツ
    "archive.org",
    "www.ted.com",
    "www.khanacademy.org",
    
    // CDN（直接ファイル配信）
    "*.cloudfront.net",
    "*.akamaihd.net",
    "*.googleapis.com"
  ],
  
  "blockedDomains": [
    // DRM保護サービス
    "*.netflix.com",
    "*.amazonvideo.com",
    "*.hulu.com",
    "*.disneyplus.com",
    "*.peacocktv.com",
    "*.paramountplus.com",
    "*.max.com",
    "*.spotifycdn.com",
    "*.spotify.com",
    
    // 日本の有料配信
    "*.unext.jp",
    "*.abema.tv",
    "*.nicovideo.jp/premium",
    "*.dmm.com",
    "*.rakuten.tv",
    
    // ライブ配信
    "*.twitch.tv",
    "live.*.com",
    "*.live-streaming.*.com"
  ]
}
```

### ドメイン管理ルール
1. **新規ドメイン追加時**
   - 法務部門の承認を得る
   - DRM使用有無を必ず確認
   - テスト環境で検証後に本番追加

2. **定期レビュー**
   - 月次でブロックリストを更新
   - 新規ストリーミングサービスを調査
   - コミュニティ報告を反映

## 2. FFmpeg セキュリティ設定

### 許可コマンドラインフラグ
```typescript
const FFMPEG_ALLOWED_FLAGS = [
  // 入力オプション
  '-i', '-ss', '-t', '-to',
  
  // 出力フォーマット
  '-c:v', '-c:a', '-f',
  
  // 品質設定
  '-crf', '-b:v', '-b:a', '-q:v',
  
  // フィルター（基本的なもののみ）
  '-vf', 'scale', 'fps', 'rotate',
  
  // メタデータ
  '-metadata', '-map_metadata',
  
  // プログレス出力
  '-progress', '-stats',
  
  // セーフモード
  '-nostdin', '-y', '-loglevel'
];

const FFMPEG_BLOCKED_FLAGS = [
  // シェルコマンド実行
  '-filter_complex', 'movie=', 'amovie=',
  
  // 外部プロトコル
  'rtmp://', 'rtsp://', 'rtp://',
  
  // ファイルシステム操作
  '-init_hw_device', '-filter_script',
  
  // 危険なフィルター
  'drawtext=', 'subtitles=', 'ass='
];
```

### FFmpeg実行時の検証
```typescript
function validateFFmpegCommand(args: string[]): boolean {
  // 禁止フラグのチェック
  for (const arg of args) {
    for (const blocked of FFMPEG_BLOCKED_FLAGS) {
      if (arg.includes(blocked)) {
        logger.warn('Blocked FFmpeg flag detected', { arg, blocked });
        return false;
      }
    }
  }
  
  // 入出力パスの検証
  const inputIndex = args.indexOf('-i');
  if (inputIndex !== -1) {
    const inputPath = args[inputIndex + 1];
    if (!isValidPath(inputPath)) {
      return false;
    }
  }
  
  return true;
}
```

## 3. クラッシュレポート同意UI

### 初回起動時の同意画面
```typescript
interface PrivacyConsentDialog {
  title: "プライバシーと診断データ",
  sections: [
    {
      heading: "クラッシュレポート",
      content: `
        アプリケーションの品質向上のため、クラッシュ時に以下の情報を送信します：
        • エラーメッセージとスタックトレース
        • OSバージョンとアプリバージョン
        • 使用メモリとCPU使用率
        
        以下の情報は送信されません：
        • ダウンロードしたファイルの内容
        • 閲覧したURL（ドメイン名のみ送信）
        • 個人を特定できる情報
      `,
      defaultEnabled: false
    },
    {
      heading: "使用統計",
      content: `
        機能改善のため、匿名の使用統計を送信します：
        • 使用した機能（ダウンロード形式、品質設定など）
        • エラー発生頻度
        • アプリ使用時間
      `,
      defaultEnabled: false
    }
  ],
  buttons: [
    { label: "すべて許可", action: "accept-all" },
    { label: "選択した項目のみ許可", action: "accept-selected" },
    { label: "すべて拒否", action: "reject-all" }
  ]
}
```

### 設定画面での管理
```typescript
// プライバシー設定画面
interface PrivacySettings {
  crashReports: {
    enabled: boolean,
    includeSystemInfo: boolean,
    autoSubmit: boolean
  },
  analytics: {
    enabled: boolean,
    shareWithPartners: false  // 常にfalse
  },
  dataRetention: {
    days: 30,  // 最大30日
    autoDelete: true
  }
}
```

## 4. セキュリティインシデント対応

### インシデント分類
| レベル | 内容 | 対応時間 | 対応者 |
|------|------|---------|--------|
| Critical | DRM迂回の試み検出 | 即時 | セキュリティチーム |
| High | 不正なコード実行の試み | 1時間以内 | 開発リード |
| Medium | 異常な大量ダウンロード | 24時間以内 | サポートチーム |
| Low | 設定ファイルの改ざん | 次回リリース | 開発チーム |

### 自動ブロック条件
```typescript
const AUTO_BLOCK_RULES = {
  // 1時間あたりのダウンロード数制限
  maxDownloadsPerHour: 100,
  
  // 1日あたりの総ダウンロードサイズ
  maxDailyBandwidthGB: 50,
  
  // DRM検出試行回数
  maxDrmAttempts: 3,
  
  // 同一URLの連続失敗
  maxConsecutiveFailures: 10
};
```

## 5. アップデート配信セキュリティ

### 署名検証プロセス
```typescript
const UPDATE_VERIFICATION = {
  // 公開鍵（実際の値は環境変数から）
  publicKey: process.env.UPDATE_PUBLIC_KEY,
  
  // 許可される署名アルゴリズム
  allowedAlgorithms: ['RSA-SHA256'],
  
  // アップデートサーバー
  allowedHosts: [
    'updates.videodownloader.example.com',
    'cdn.videodownloader.example.com'
  ],
  
  // バージョンダウングレード防止
  preventDowngrade: true,
  
  // 差分更新の最大サイズ
  maxDeltaSize: 100 * 1024 * 1024  // 100MB
};
```

## 6. ログ管理とプライバシー

### ログ収集ルール
```typescript
const LOG_RULES = {
  // URLのマスキング
  maskUrls: (url: string) => {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/***`;
  },
  
  // IPアドレスの匿名化
  anonymizeIP: (ip: string) => {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'xxx.xxx.xxx.xxx';
  },
  
  // 個人情報のフィルタリング
  sensitivePatterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,  // Phone
    /\b\d{3}-\d{2}-\d{4}\b/g,  // SSN
  ],
  
  // ログ保持期間
  retention: {
    error: 30,     // エラーログ: 30日
    warning: 14,   // 警告ログ: 14日
    info: 7,       // 情報ログ: 7日
    debug: 1       // デバッグログ: 1日
  }
};
```

## 7. コンプライアンスチェックリスト

### リリース前チェック
- [ ] DRMブロックリストが最新か確認
- [ ] FFmpeg脆弱性情報の確認（CVEデータベース）
- [ ] Electronセキュリティアップデートの適用
- [ ] 依存パッケージの脆弱性スキャン（npm audit）
- [ ] CSPヘッダーの動作確認
- [ ] プロキシ設定のバイパステスト
- [ ] 自動アップデート署名の検証

### 月次レビュー
- [ ] ダウンロード統計の異常値チェック
- [ ] ブロックされたドメインへのアクセス試行
- [ ] セキュリティインシデントの分析
- [ ] ユーザー報告の精査
- [ ] 新規ストリーミングサービスの調査

## 8. 問い合わせ対応テンプレート

### DRM関連の問い合わせ
```
お問い合わせありがとうございます。

本アプリケーションは著作権法を遵守し、DRM（デジタル著作権管理）で
保護されたコンテンツのダウンロードには対応しておりません。

以下のサービスからのダウンロードはブロックされています：
- 有料動画配信サービス（Netflix、Amazon Prime Video等）
- 音楽ストリーミングサービス（Spotify、Apple Music等）
- ライブ配信サービス

著作権フリーまたは適切な権利を持つコンテンツのみ
ダウンロード可能です。

ご理解のほどよろしくお願いいたします。
```

### セキュリティ脆弱性の報告
```
セキュリティ脆弱性のご報告ありがとうございます。

報告いただいた内容は直ちにセキュリティチームで検証し、
必要に応じて以下の対応を行います：

1. 脆弱性の確認と影響範囲の特定
2. 修正パッチの開発
3. 緊急度に応じたアップデートの配信
4. 必要に応じてCVE番号の取得

報告者様には検証結果と対応状況をご連絡いたします。
責任ある開示にご協力いただき感謝申し上げます。

セキュリティチーム: security@videodownloader.example.com
```

## 9. 更新履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0 | 2025-01-23 | 初版作成 |

## 10. 関連文書

- [セキュリティポリシー](./security-policy.md)
- [アーキテクチャ設計書](./architecture.md)
- [IPC仕様書](./ipc-specification.md)
- [プライバシーポリシー](../../legal/privacy-policy.md)
- [利用規約](../../legal/terms-of-service.md)