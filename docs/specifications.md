
# Video Downloader 内部仕様書



## 1. 概要



### 1.1. プロジェクト名



Video Downloader (Electron版)



### 1.2. 目的



内蔵ブラウザで表示したWebページから、**HLS形式(.m3u8)やDASH形式(.mpd)**、MP4形式の動画を検出し、ユーザーが自身のローカル環境にダウンロードできるようにするスタンドアロンのデスクトップアプリケーションを提供する。



### 1.3. アーキテクチャ



Electronを採用し、Mainプロセス（コアロジック）、Rendererプロセス（UI）、Preloadスクリプト（IPCブリッジ）を分離した設計とする。UIはReactとTailwind CSSで構築する。



### 1.4. 運用・配布方針



- **配布**: `electron-builder`でインストーラを生成し、直接配布する。

- **自動更新**: `electron-updater`を導入し、GitHub ReleasesやS3等をホスティング先とする。

- **コード署名**: Windows/macOSのコードサイニング証明書を取得・維持する。

- **対象環境**: PC環境を前提とする。



## 2. アーキテクチャ設計（クラス図）



アプリケーションの主要なクラスとモジュール、そしてそれらの関係性を示す。



    classDiagram direction TB package "Mainプロセス (コアロジック)" { class Application { +main() -createUiWindow() -createWebWindow() } class UIWindow { <<Window>> - browserWindow } class MainWindow { <<Window>> - browserWindow } class IpcHandler { +registerHandlers() } class SettingsManager { - store: ElectronStore - schema: ZodSchema +get() +set() } class Logger { +info(message, context) +error(message, context) } subgraph "Detection (検出レイヤー)" direction LR class RequestSniffer { +start(session) +onRequest(callback) } class MediaDetector { +detect(requestInfo): MediaCandidate } class MediaManifestParser { <<Interface>> +parse(url, headers) } class HlsManifestParser { +parse(url, headers): Variant[] } class DashManifestParser { +parse(url, headers): Representation[] } end subgraph "Download (ダウンロードドメイン)" direction LR class DownloadManager { +add(taskSpec) +cancel(id) +pause(id) +resume(id) +onEvent(callback) } class Scheduler { - maxConcurrent: number +schedule(queue) } class DownloadRepository { +loadAll(): DownloadTask[] +save(task) } class DownloadTask { +id: string +status: DownloadStatus +retryPolicy: RetryPolicy +start() +pause() +cancel() +onProgress(callback) } class Downloader { <<Abstract>> +start() } class FfmpegDownloader { +start() } class SimpleDownloader { +start() } enum DownloadStatus { Queued Running Paused Canceled Error Completed } end Application --> UIWindow : creates Application --> MainWindow : creates Application --> IpcHandler Application --> SettingsManager Application --> Logger Application --> RequestSniffer RequestSniffer --> MediaDetector : notifies MediaDetector --> MediaManifestParser : uses MediaManifestParser <|-- HlsManifestParser MediaManifestParser <|-- DashManifestParser IpcHandler ..> DownloadManager : controls IpcHandler ..> SettingsManager : uses DownloadManager o-- Scheduler DownloadManager o-- DownloadRepository DownloadManager o-- DownloadTask DownloadTask o-- Downloader Downloader <|-- FfmpegDownloader Downloader <|-- SimpleDownloader DownloadTask -- DownloadStatus } package "Preloadスクリプト" { class ElectronAPI { <<Interface>> +on(event, callback) +startDownload(spec) +pauseDownload(id) +cancelDownload(id) +getSettings() +saveSettings(settings) +revealInFolder(path) } } package "Rendererプロセス (UI - React)" { class App class BrowserFrame class DownloadIcon class DownloadPopup class DownloadManagerPanel class SettingsModal class Toasts App o-- BrowserFrame App o-- DownloadManagerPanel App o-- SettingsModal App o-- Toasts BrowserFrame o-- DownloadIcon DownloadIcon ..> DownloadPopup : shows } IpcHandler -- ElectronAPI : IPC ElectronAPI -- App : provides API



## 3. シーケンス設計



### 3.1. 動画検出シーケンス



`Content-Type`の確認やHLS/DASHの画質選択、重複検出の抑制など、より信頼性の高い検出フローを示す。



    sequenceDiagram participant Main participant Sniffer as "RequestSniffer" participant Detector as "MediaDetector" participant ManifestParser as "MediaManifestParser" participant Renderer as "Renderer (UI)" Main->>Sniffer: onBeforeSendHeaders(req) note right of Sniffer: UA/Referer/Cookieを収集 Main->>Sniffer: onHeadersReceived(res) note right of Sniffer: Content-Typeを取得 Sniffer->>Detector: detect({url, headers, contentType}) alt HLS (.m3u8) または DASH (.mpd) と判定 Detector->>ManifestParser: parse(url, headers) ManifestParser-->>Detector: Variant[] / Representation[] (品質リスト) end alt 動画候補が見つかり、重複していない場合 Detector-->>Main: "video-found" {candidate, variants?, dedupKey} Main->>Main: 検出結果を短時間バッチング（集約） Main-->>Renderer: IPC: onVideoFound(batchedCandidates) Renderer->>Renderer: UIを更新（アイコンをアクティブ化） else DRMや権限エラーが疑われる場合 Detector-->>Main: "video-skipped" {reason} Main-->>Renderer: IPC: onVideoSkipped(reason) Renderer->>Renderer: UIを更新（アイコンを無効状態で表示＋ツールチップで理由説明） end



### 3.2. セグメントベースのダウンロードシーケンス (HLS/DASH)



進捗取得の安定化、再試行ポリシー、一時ファイルとアトミックリネーム、中断・復帰の概念を反映。**このフローはHLSとDASHで共通**。



    sequenceDiagram participant Task as "DownloadTask" participant FFD as "FfmpegDownloader" participant FF as "ffmpeg (外部プロセス)" participant Repo as "DownloadRepository" participant Renderer as "Renderer (UI)" Task->>FFD: start(spec with headers, variant) note right of FFD: 一時ファイル名 (.part) を決定 FFD->>FF: spawn(ffmpeg, ["-progress", "pipe:1", ...]) loop 処理中 FF-->>FFD: progress (key=value形式) FFD-->>Task: onProgress(progressData) Task->>Task: durationベースで進捗率(%)を計算 note right of Task: duration不明時はETAを推定 Task-->>Renderer: IPC: onDownloadEvent({type: 'progress', ...}) Task->>Repo: save checkpoint (完了セグメント等を記録) end alt 正常完了 (exit code 0) FFD-->>Task: "completed" Task->>Task: 一時ファイルをアトミックにリネーム Task->>Repo: 最終状態を保存 Task-->>Renderer: IPC: onDownloadEvent({type: 'completed', path}) else エラー終了 (exit code != 0) FFD-->>Task: "error" alt 再試行ポリシーに基づきリトライ可能 Task->>Task: 指数バックオフで待機後、リトライ else リトライ上限超過 Task->>Repo: エラー状態を保存 Task-->>Renderer: IPC: onDownloadEvent({type: 'error', message}) end end



### 3.3. キャンセル・アプリ終了シーケンス



子プロセスのリークを防ぎ、安全に終了するためのフロー。



    sequenceDiagram participant User participant App as "Application" participant Manager as "DownloadManager" participant Task as "DownloadTask" participant FF as "ffmpeg (外部プロセス)" User->>App: アプリケーションを終了 App->>Manager: before-quitイベント: cancelAll() Manager->>Task: cancel() Task->>FF: kill() (SIGTERM/SIGINT) note right of FF: Windowsの場合はtaskkill /T /F Task->>Task: 一時ファイルを削除 Task-->>Manager: "canceled" Manager-->>App: 全タスクのキャンセル完了 App->>App: アプリケーションを安全に終了



### 3.4. クラッシュからの復帰シーケンス



アプリ起動時に未完了のダウンロードを検出し、ユーザーに再開を促すフロー。



    sequenceDiagram participant App as "Application" participant Repo as "DownloadRepository" participant Manager as "DownloadManager" participant Renderer as "Renderer (UI)" actor User App->>Repo: loadAll() Repo-->>App: [tasks with status in {Running,Queued,Paused}] App->>Manager: restore(tasks) Manager-->>Renderer: IPC: onRestoreSummary({resumable: n}) Renderer->>User: 「未完了のダウンロードがあります。再開しますか？」 alt Userが「再開」を選択 User->>Renderer: 再開ボタンをクリック Renderer-->>Manager: resume(selectedIds) else Userが「スキップ」を選択 User->>Renderer: スキップボタンをクリック Renderer-->>Manager: cancel(selectedIds) end



## 4. プロセス間通信(IPC)の契約



MainプロセスとRendererプロセス間の通信を型安全にするためのTypeScript定義。



    // shared/ipc.ts export type MediaType = "hls" | "dash" | "file";export type SkipReason = "drm" | "403" | "cors" | "mime-mismatch" | "widevine-hint" | "live"; export type MediaCandidate = { id: string; // dedupKey url: string; mediaType: MediaType; variants?: Array<{ bandwidth?: number; resolution?: string; codecs?: string }>;}; export type RetryPolicy = { maxAttempts: number; backoff: "exponential" | "fixed"; initialDelayMs: number; maxDelayMs?: number; retryOn?: string[]; // エラーコードのリスト}; export type DownloadSpec = { url: string; type: MediaType; filename?: string; headers?: Record<string,string>; variant?: { bandwidth?: number; resolution?: string }; retry?: RetryPolicy;}; export type DownloadEvent = | { type: "queued"; id: string } | { type: "progress"; id: string; percent?: number; speedBps?: number; etaMs?: number } | { type: "completed"; id: string; path: string } | { type: "error"; id: string; message: string; code?: string; attempt?: number } | { type: "canceled"; id: string }; export interface ElectronAPI { // Download startDownload(spec: DownloadSpec): Promise<{ id: string }>; pauseDownload(id: string): Promise<void>; cancelDownload(id: string): Promise<void>; onDownloadEvent(cb: (e: DownloadEvent) => void): () => void; // Unsubscribe function // Settings getSettings(): Promise<Settings>; saveSettings(s: Settings): Promise<void>; // Detection onVideoFound(cb: (v: MediaCandidate[]) => void): () => void; // Unsubscribe function onVideoSkipped(cb: (r: { reason: SkipReason; url: string }) => void): () => void; // Utility revealInFolder(path: string): void;}



## 5. 実装上の重要事項



- **検出**:



    - **DASH対応**: `MediaManifestParser`インターフェースを介して、DASH形式（`.mpd`拡張子、`application/dash+xml` Content-Type）の解析を実装する。

    - **ライブHLS**: `#EXT-X-ENDLIST` タグの有無でVOD/Liveを判別し、ライブストリームは原則として対象外とする。UI上で「ライブ放送はダウンロードできません」と明示する。

- **ダウンロード**:



    - **進捗計算**: HLS/DASHで`total_duration`が不明な場合、進捗率(%)は非表示とし、推定残り時間(ETA)のみを表示するフォールバックを実装する。

    - **ヘッダ付与**: `ffmpeg`は内部で複数回HTTPリクエストを行うため、`-user_agent`と`-headers`引数を常に指定し、リダイレクト先でも認証情報が維持されるようにする。

- **IPC**:



    - **背圧対策**: `progress`イベントは高頻度で発生するため、`150ms`間隔または`1%`刻みでスロットリング（間引き）して送信し、UIのフリーズを防ぐ。

- **ファイルシステム**:



    - **ファイル名**: ユーザーが指定したファイル名やWebページタイトルからファイル名を生成する際は、OSの予約文字やパス長制限を考慮し、安全な文字列にサニタイズ（無害化）する。

- **セキュリティ**:



    - **Webウィンドウの強化**: コンテンツを表示する`MainWindow`は、`allowpopups: false`を設定し、`setWindowOpenHandler`で外部リンクはOSの標準ブラウザで開くように強制する。

- **法務リスク**:



    - **注意書き強化**: アプリケーション内に「本アプリケーションは、技術的な検証および教育、そして私的利用を目的としています。コンテンツのダウンロードは、各サービスの利用規約と著作権法を遵守してください。本アプリを利用したことによるいかなる問題についても、開発者は責任を負いません。」といった文言を明記する。
