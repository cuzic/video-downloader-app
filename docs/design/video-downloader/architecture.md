# Video Downloader アーキテクチャ設計

## 1. システム概要

Video Downloaderは、Electronベースのデスクトップアプリケーションで、内蔵ブラウザで表示したWebページから動画（HLS、DASH、MP4形式）を検出し、ローカル環境にダウンロードする機能を提供します。

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Main Process                       │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │              Core Components               │     │    │
│  │  │  - Application Manager                     │     │    │
│  │  │  - Window Manager (UI/Main Windows)        │     │    │
│  │  │  - IPC Handler                            │     │    │
│  │  │  - Settings Manager                       │     │    │
│  │  │  - Logger                                 │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │                                                      │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │           Detection Layer                  │     │    │
│  │  │  - Request Sniffer                        │     │    │
│  │  │  - Media Detector                         │     │    │
│  │  │  - HLS/DASH Manifest Parsers              │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │                                                      │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │           Download Domain                  │     │    │
│  │  │  - Download Manager                       │     │    │
│  │  │  - Task Scheduler                         │     │    │
│  │  │  - Download Repository                    │     │    │
│  │  │  - FFmpeg/Simple Downloaders              │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Preload Script                         │    │
│  │  - IPC Bridge (contextBridge)                       │    │
│  │  - Security Isolation                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Renderer Process (React UI)               │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │            UI Components                   │     │    │
│  │  │  - Browser Frame                          │     │    │
│  │  │  - Download Manager Panel                 │     │    │
│  │  │  - Settings Modal                         │     │    │
│  │  │  - Download Icon & Popup                  │     │    │
│  │  │  - Toast Notifications                    │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 3. 技術スタック

### 3.1 コア技術
- **Electron**: v28.x - クロスプラットフォーム デスクトップアプリケーション
- **Node.js**: v20.x - ランタイム環境
- **TypeScript**: v5.x - 型安全性の確保

### 3.2 フロントエンド
- **React**: v18.x - UIフレームワーク
- **Tailwind CSS**: v3.x - スタイリング
- **Zustand**: 状態管理
- **React Query**: 非同期状態管理

### 3.3 ビルド・開発ツール
- **Vite**: 高速ビルドツール
- **electron-builder**: パッケージング・配布
- **electron-updater**: 自動更新機能

### 3.4 外部依存
- **FFmpeg**: HLS/DASHセグメントダウンロード
- **electron-store**: 設定の永続化
- **winston**: ロギング

## 4. コンポーネント詳細

### 4.1 Main Process コンポーネント

#### Application Manager
- アプリケーションのライフサイクル管理
- ウィンドウの作成と管理
- グローバルショートカットの登録

#### Window Manager
- UIWindow: アプリケーションのメインUI
- MainWindow: ブラウザコンテンツ表示用
- ウィンドウ間の通信調整

#### IPC Handler
- Renderer-Main間の通信管理
- 型安全なメッセージング
- エラーハンドリング

#### Settings Manager
- ユーザー設定の読み書き
- デフォルト設定の管理
- 設定のバリデーション（Zod使用）

### 4.2 Detection Layer

#### Request Sniffer
- webRequest APIを使用したHTTPリクエスト監視
- ヘッダー情報の収集（User-Agent、Referer、Cookie）
- Content-Type判定

#### Media Detector
- 動画形式の判定（HLS、DASH、MP4）
- 重複検出の抑制
- DRM保護コンテンツの検出

#### Manifest Parsers
- HLS Manifest Parser: .m3u8ファイルの解析
- DASH Manifest Parser: .mpdファイルの解析
- 品質バリアント情報の抽出

### 4.3 Download Domain

#### Download Manager
- ダウンロードタスクの管理
- キュー管理と優先度制御
- イベント通知システム

#### Task Scheduler
- 同時実行数の制御
- タスクの優先度管理
- リソース使用量の最適化

#### Download Repository
- タスク状態の永続化
- クラッシュリカバリー
- ダウンロード履歴管理

#### Downloaders
- FFmpeg Downloader: HLS/DASH用
- Simple Downloader: 通常のHTTPダウンロード用
- 進捗追跡とエラーハンドリング

### 4.4 UI Components

#### Browser Frame
- Webビューの表示
- ナビゲーションコントロール
- URL入力バー

#### Download Manager Panel
- アクティブなダウンロードの一覧
- 進捗表示とコントロール
- ダウンロード履歴

#### Settings Modal
- アプリケーション設定
- ダウンロード設定
- プロキシ設定

## 5. データフロー

### 5.1 動画検出フロー
1. ユーザーがWebページにアクセス
2. Request SnifferがHTTPリクエストを監視
3. Media Detectorが動画候補を検出
4. Manifest Parserが品質情報を解析
5. UIに検出結果を通知

### 5.2 ダウンロードフロー
1. ユーザーがダウンロードを開始
2. Download Managerがタスクを作成
3. Schedulerがタスクをキューに追加
4. Downloaderが実際のダウンロードを実行
5. 進捗情報をUIに通知
6. 完了後、ファイルを指定場所に保存

## 6. セキュリティ考慮事項

### 6.1 プロセス分離
- Main/Renderer プロセスの厳密な分離
- contextBridgeを使用した安全なIPC通信
- nodeIntegration: false

### 6.2 コンテンツセキュリティ
- CSP (Content Security Policy) の適用
- 外部スクリプトの実行制限
- XSS対策

### 6.3 ネットワークセキュリティ
- HTTPS優先
- 証明書検証
- プロキシサポート

## 7. パフォーマンス最適化

### 7.1 メモリ管理
- 大容量ファイルのストリーミング処理
- メモリリークの防止
- ガベージコレクションの最適化

### 7.2 並行処理
- Worker Threadsの活用
- 非同期処理の適切な実装
- バックプレッシャー対策

### 7.3 UI応答性
- 進捗更新のスロットリング（150ms間隔）
- 仮想スクロールの実装
- 遅延ローディング

## 8. エラーハンドリング

### 8.1 検出エラー
- ネットワークエラー
- パースエラー
- タイムアウト

### 8.2 ダウンロードエラー
- 接続エラー
- ディスク容量不足
- 権限エラー

### 8.3 リトライ戦略
- 指数バックオフ
- 最大リトライ回数の設定
- 部分的な再開機能

## 9. 拡張性

### 9.1 プラグインシステム
- 新しい動画形式のサポート追加
- カスタムダウンローダーの実装
- UI拡張機能

### 9.2 国際化
- 多言語サポート
- 地域設定
- 日付・時刻フォーマット

## 10. デプロイメント

### 10.1 ビルド設定
- プラットフォーム別ビルド
- コード署名
- 自動更新設定

### 10.2 配布
- GitHub Releases
- 自動更新サーバー
- インストーラー生成

## 11. モニタリング

### 11.1 ロギング
- アプリケーションログ
- エラーログ
- パフォーマンスメトリクス

### 11.2 分析
- 使用統計
- クラッシュレポート
- ユーザーフィードバック