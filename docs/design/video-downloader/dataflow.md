# Video Downloader データフロー設計（改訂版）

## 1. 概要

本ドキュメントでは、Video Downloaderアプリケーション内のデータフローを定義します。
IPCチャンネル名は最新仕様（v1.1）に準拠し、実装時の注意点を明記しています。

## 2. 主要データフロー

### 2.1 動画検出フロー

```mermaid
sequenceDiagram
    participant User
    participant BrowserFrame as Browser Frame (Renderer)
    participant WebView as WebContents/BrowserView
    participant Main as Main Process
    participant Sniffer as session.webRequest
    participant Detector as Media Detector
    participant Parser as Manifest Parser
    participant UI as UI (Renderer)
    
    User->>BrowserFrame: URL入力/ナビゲート
    BrowserFrame->>Main: IPC: app:browser:navigate
    Main->>WebView: loadURL(url)
    
    WebView->>WebView: ページ読み込み開始
    
    loop HTTPリクエスト監視 (session.webRequest)
        WebView->>Sniffer: onBeforeRequest
        Sniffer->>Sniffer: URL/パターンチェック
        note right of Sniffer: UA/Referer/Cookie収集
        
        WebView->>Sniffer: onHeadersReceived
        Sniffer->>Sniffer: Content-Type取得
        note right of Sniffer: headers小文字キー正規化
        
        alt 動画候補の可能性あり
            Sniffer->>Detector: analyze(request, response)
            
            alt HLS (.m3u8)
                Detector->>Parser: parseHLS(url, headers)
                Parser-->>Detector: variants[]
            else DASH (.mpd)
                Detector->>Parser: parseDASH(url, headers)
                Parser-->>Detector: representations[]
            else MP4/WebM
                Detector->>Detector: 直接動画として検出
            end
            
            alt 有効な動画
                Detector->>Detector: 重複チェック(dedupKey)
                note right of Detector: dedupKey = hash(url + pageUrl + variant + contentLength)
                alt 新規動画
                    Detector->>Main: emit('video-found', candidate)
                    Main->>Main: バッチング(150ms)
                    Main->>UI: IPC: on:video:found
                    UI->>UI: アイコン表示更新
                end
            else DRM/エラー
                Detector->>Main: emit('video-skipped', reason)
                Main->>UI: IPC: on:video:skipped
                UI->>UI: スキップ理由表示
            end
        end
    end
    
    note over Sniffer,Detector: 検出限界：Service Worker経由やMSE/EME(Widevine)は<br/>webRequestで見えない場合あり→DOM/JSフックで補完検討
```

### 2.2 ダウンロード開始フロー

```mermaid
sequenceDiagram
    participant User
    participant UI as Download Popup (Renderer)
    participant Main as Main Process
    participant DM as Download Manager
    participant Scheduler as Task Scheduler
    participant Task as Download Task
    participant Downloader as FFmpeg/Simple Downloader
    participant DB as SQLite Database
    
    User->>UI: ダウンロードボタンクリック
    UI->>UI: 品質選択/保存先指定
    UI->>Main: IPC: app:download:start(spec)
    
    Main->>DM: startDownload(spec)
    DM->>DM: タスクID生成 (UUID)
    DM->>Task: new DownloadTask(spec)
    Task->>Task: 初期化 (status: 'queued')
    
    DM->>DB: タスク保存（トランザクション）
    DM->>Scheduler: enqueue(task)
    Scheduler->>Scheduler: 優先度チェック
    Scheduler->>Scheduler: 同時実行数チェック
    
    alt スロット利用可能
        Scheduler->>Task: start()
        Task->>Task: status = 'running'
        
        alt HLS/DASH
            Task->>Downloader: new FFmpegDownloader(spec)
            Downloader->>Downloader: FFmpegコマンド構築
            note right of Downloader: -progress pipe:1 使用（locale非依存）
            Downloader->>Downloader: 一時ファイル作成 (.part)
        else 通常ファイル
            Task->>Downloader: new SimpleDownloader(spec)
            Downloader->>Downloader: HTTPストリーム作成
        end
        
        Downloader->>Task: emit('started')
        Task->>DM: emit('status-changed', 'running')
        DM->>Main: emit('download:status-changed')
        Main->>UI: IPC: on:download:status-changed
        UI->>UI: UIステータス更新
    else スロット満杯
        Scheduler->>Task: キューで待機
        Task->>DM: emit('status-changed', 'queued')
        DM->>Main: emit('download:status-changed')
        Main->>UI: IPC: on:download:status-changed
        UI->>UI: 待機中表示
    end
    
    DM-->>Main: return { id: taskId }
    Main-->>UI: return { id: taskId }
```

### 2.3 ダウンロード進捗フロー

```mermaid
sequenceDiagram
    participant Downloader as FFmpeg Process
    participant Task as Download Task
    participant DM as Download Manager
    participant Throttle as Progress Throttle
    participant Main as Main Process
    participant UI as UI (Renderer)
    participant DB as SQLite Database
    participant User
    
    loop ダウンロード中
        Downloader->>Task: stdout: progress data
        note right of Task: key=value形式パース<br/>out_time_ms, total_size等
        Task->>Task: 進捗率計算
        
        alt HLS/DASH
            Task->>Task: セグメント数から計算
            note right of Task: 完了セグメント/総セグメント
        else 通常ファイル
            Task->>Task: バイト数から計算
        end
        
        Task->>Task: ETA計算（指数移動平均）
        note right of Task: ゼロ除算回避、スパイク対策
        
        Task->>DM: emit('progress', data)
        DM->>Throttle: throttle(150ms)
        
        alt スロットル期間経過
            Throttle->>Main: emit('download:progress')
            Main->>UI: IPC: on:download:progress
            
            UI->>UI: プログレスバー更新
            UI->>UI: 速度表示更新（Bps）
            UI->>UI: ETA表示
            
            User->>User: 進捗確認
        end
        
        alt 30秒経過（永続化間隔）
            Task->>DB: チェックポイント保存
            note right of DB: メモリキュー経由<br/>atomic write使用
        end
    end
    
    alt ダウンロード完了
        Downloader->>Task: exit(0)
        Task->>Task: status = 'completed'
        Task->>Task: .part → 最終ファイル（atomic rename）
        Task->>DB: 最終状態保存
        Task->>DM: emit('completed', path)
        DM->>Main: emit('download:completed')
        
        alt completedNotification.enabled
            Main->>Main: OS通知表示
        end
        
        alt completedNotification.autoOpenFolder
            Main->>Main: shell.showItemInFolder(path)
        end
        
        Main->>UI: IPC: on:download:completed
        UI->>UI: 完了表示
    else エラー発生
        Downloader->>Task: exit(1) or error
        Task->>Task: エラー解析
        
        alt リトライ可能
            Task->>Task: リトライカウント確認
            alt リトライ上限内
                Task->>Task: 指数バックオフ待機
                Task->>Downloader: 再実行
            else リトライ上限超過
                Task->>Task: status = 'error'
                Task->>DB: エラー状態保存
                Task->>DM: emit('error', error)
                DM->>Main: emit('download:error')
                Main->>UI: IPC: on:download:error
                UI->>UI: エラー表示
            end
        else リトライ不可
            Task->>Task: status = 'error'
            Task->>DB: エラー状態保存
            Task->>DM: emit('error', error)
            DM->>Main: emit('download:error')
            Main->>UI: IPC: on:download:error
            UI->>UI: エラー表示
        end
    end
```

### 2.4 一時停止/再開フロー

```mermaid
sequenceDiagram
    participant User
    participant UI as UI (Renderer)
    participant Main as Main Process
    participant DM as Download Manager
    participant Task as Download Task
    participant Process as FFmpeg/HTTP Process
    participant DB as SQLite Database
    
    rect rgb(200, 230, 255)
        note right of User: 一時停止フロー
        User->>UI: 一時停止ボタンクリック
        UI->>Main: IPC: app:download:pause(id)
        Main->>DM: pauseDownload(id)
        DM->>Task: pause()
        
        Task->>Process: kill(SIGTERM)
        note right of Process: 安全な終了シグナル
        Process->>Process: プロセス終了
        Task->>Task: status = 'paused'
        Task->>DB: saveCheckpoint()
        note right of DB: 完了セグメント一覧保存<br/>（HLS/DASH用）
        
        Task->>DM: emit('status-changed', 'paused')
        DM->>Main: emit('download:status-changed')
        Main->>UI: IPC: on:download:status-changed
        UI->>UI: 一時停止状態表示
    end
    
    User->>User: 時間経過...
    
    rect rgb(200, 255, 200)
        note right of User: 再開フロー
        User->>UI: 再開ボタンクリック
        UI->>Main: IPC: app:download:resume(id)
        Main->>DM: resumeDownload(id)
        DM->>Task: resume()
        
        Task->>DB: loadCheckpoint()
        DB-->>Task: 保存された進捗
        
        alt HLS/DASH
            Task->>Task: 未完了セグメント一覧構築
            note right of Task: セグメント境界での再開
            Task->>Process: spawn(ffmpeg, resumeArgs)
            note right of Process: -segment_time, -f segment等
            Process->>Process: 未完了セグメントから再開
        else HTTP Range対応
            Task->>Task: ダウンロード済みバイト確認
            Task->>Process: spawn(curl/wget, --continue)
            Process->>Process: Range要求で再開
        else Range非対応
            Task->>Process: spawn(最初から)
            Process->>Process: 最初からダウンロード
            note right of Process: 既存.partは破棄
        end
        
        Task->>Task: status = 'running'
        Task->>DM: emit('status-changed', 'running')
        DM->>Main: emit('download:status-changed')
        Main->>UI: IPC: on:download:status-changed
        UI->>UI: 実行中状態表示
    end
```

### 2.5 アプリケーション起動時の復元フロー

```mermaid
sequenceDiagram
    participant App as Application
    participant DB as SQLite Database
    participant DM as Download Manager
    participant Main as Main Process
    participant UI as UI (Renderer)
    participant User
    
    App->>App: アプリ起動
    App->>DB: loadAllTasks()
    DB-->>App: 保存されたタスク一覧
    
    App->>App: 未完了タスクフィルタ
    note right of App: status in ['running', 'queued', 'paused']
    
    alt 未完了タスクあり
        App->>DM: restoreTasks(incompleteTasks)
        
        loop 各タスク
            DM->>DM: タスク復元
            alt 実行中だった
                DM->>DM: status = 'paused' に降格
                note right of DM: 安全のため必ずpaused
            end
        end
        
        DM->>Main: 復元サマリー準備
        Main->>UI: IPC: on:download:restore-summary
        note right of UI: {total, paused, resumable}
        UI->>UI: 復元ダイアログ表示
        UI->>User: "未完了のダウンロードがあります"
        
        alt ユーザーが再開選択
            User->>UI: "すべて再開"クリック
            UI->>Main: IPC: app:download:resume-all
            Main->>DM: resumeAll()
            DM->>DM: 全タスク再開
        else ユーザーが個別選択
            User->>UI: 個別に再開/キャンセル
            UI->>Main: IPC: app:download:resume/cancel(ids)
            Main->>DM: 選択されたタスク処理
        else ユーザーがスキップ
            User->>UI: "後で"クリック
            UI->>UI: ダイアログ閉じる
            DM->>DM: タスクは'paused'のまま
        end
    else 未完了タスクなし
        App->>App: 通常起動継続
    end
```

### 2.6 設定変更フロー

```mermaid
sequenceDiagram
    participant User
    participant Settings as Settings Modal (Renderer)
    participant Main as Main Process
    participant SM as Settings Manager
    participant DB as SQLite Database
    participant Components as Affected Components
    participant UI as Other UI Components
    
    User->>Settings: 設定画面を開く
    Settings->>Main: IPC: app:settings:get-all
    Main->>SM: getAll()
    SM->>DB: query settings
    DB-->>SM: 現在の設定
    SM-->>Main: settings object
    Main-->>Settings: 設定データ
    Settings->>Settings: フォーム表示
    
    User->>Settings: 設定変更
    Settings->>Settings: バリデーション（Zod）
    
    alt バリデーション成功
        Settings->>Main: IPC: app:settings:set(key, value)
        Main->>SM: set(key, value)
        SM->>SM: スキーマ検証
        SM->>DB: atomic write
        DB->>DB: 永続化
        
        SM->>Components: 設定適用
        
        alt ダウンロード設定変更
            Components->>Components: 同時実行数調整
            note right of Components: 実行中＞新上限なら自然減待ち
            Components->>Components: リトライポリシー更新
        else プロキシ設定変更
            Components->>Components: セッション再構築
            Components->>Components: 新規接続に適用
        else UI設定変更
            Components->>Components: テーマ切り替え
            Components->>Components: 言語切り替え
        end
        
        Main->>UI: IPC: on:settings:updated
        UI->>UI: 関連UIコンポーネント更新
        
        Settings->>User: 成功通知
    else バリデーション失敗
        Settings->>User: エラー表示
    end
```

## 3. データ永続化フロー

### 3.1 データ保存タイミング

```mermaid
graph TD
    A[データ変更イベント] --> B{データ種別}
    
    B -->|ダウンロードタスク| C[メモリキュー]
    B -->|設定変更| D[即座に保存]
    B -->|検出動画| E[バッチキュー]
    B -->|進捗情報| F[定期キュー]
    
    C --> G[単一フラッシャー]
    E --> H[5秒間隔でバッチ]
    F --> I[30秒間隔で保存]
    
    G --> J[Atomic Write]
    H --> J
    I --> J
    D --> J
    
    J --> K[SQLite WAL mode]
    K --> L[ローカルファイル]
    
    M[app:before-quit] --> N[全キューフラッシュ]
    N --> J
    
    O[スキーマバージョン] --> P[マイグレーション]
    P --> K
```

### 3.2 データ読み込みフロー

```mermaid
graph TD
    A[アプリ起動] --> B[SQLite初期化]
    B --> C[スキーマバージョン確認]
    C --> D{マイグレーション必要?}
    D -->|Yes| E[マイグレーション実行]
    D -->|No| F[設定読み込み]
    E --> F
    
    F --> G[タスク履歴読み込み]
    G --> H[検出動画キャッシュ読み込み]
    
    F --> I{設定ファイル存在?}
    I -->|Yes| J[設定適用]
    I -->|No| K[デフォルト設定作成]
    K --> J
    
    G --> L{未完了タスク存在?}
    L -->|Yes| M[running→pausedに降格]
    M --> N[復元ダイアログ表示]
    L -->|No| O[通常起動]
    
    N --> P{ユーザー選択}
    P -->|再開| Q[タスク再開]
    P -->|キャンセル| R[タスククリア]
    P -->|後で| O
    
    Q --> O
    R --> O
```

## 4. エラーハンドリングフロー

### 4.1 エラー伝播

```mermaid
graph TD
    A[エラー発生] --> B{エラー発生場所}
    
    B -->|Downloader| C[Task層でキャッチ]
    B -->|Network| D[Request層でキャッチ]
    B -->|FileSystem| E[FS層でキャッチ]
    B -->|IPC| F[Handler層でキャッチ]
    
    C --> G[エラー分類]
    D --> G
    E --> G
    F --> G
    
    G --> H[ErrorCode割り当て]
    H --> I{リトライ可能?}
    
    I -->|Yes| J[RetryPolicy確認]
    J --> K{リトライ条件合致?}
    K -->|Yes| L[指数バックオフ]
    L --> M[リトライ実行]
    K -->|No| N[エラー記録]
    
    I -->|No| N
    
    M --> O{リトライ成功?}
    O -->|Yes| P[処理継続]
    O -->|No| N
    
    N --> Q[SerializedError生成]
    Q --> R[ユーザー通知]
    R --> S[ログ記録]
    
    S --> T[エラーレポート生成]
```

## 5. パフォーマンス最適化フロー

### 5.1 メモリ管理

```mermaid
graph TD
    A[大容量ファイルダウンロード] --> B[ストリーミング処理]
    B --> C[チャンクサイズ: 64KB]
    
    C --> D[バッファ管理]
    D --> E{メモリ使用量}
    
    E -->|80%以上| F[バックプレッシャー適用]
    E -->|80%未満| G[通常処理継続]
    
    F --> H[stream.pause()]
    H --> I[バッファフラッシュ]
    I --> J[メモリ解放待機]
    J --> K[stream.resume()]
    K --> G
    
    G --> L[ディスク書き込み]
    L --> M[バッファクリア]
    
    note1[手動GCは不可]
    note2[パイプライン制御で対応]
```

## 6. セキュリティフロー

### 6.1 URL検証

```mermaid
graph TD
    A[URL入力] --> B[スキーマ検証]
    B --> C{許可されたスキーマ?}
    
    C -->|http/https| D[ホスト検証]
    C -->|その他| E[拒否]
    
    D --> F{許可リスト存在?}
    F -->|Yes| G[許可リスト確認]
    F -->|No| H[拒否リスト確認]
    
    G --> I{許可リストに含む?}
    I -->|Yes| H
    I -->|No| E
    
    H --> J{拒否リストに含む?}
    J -->|Yes| E
    J -->|No| K[パス検証]
    
    K --> L{危険なパス?}
    L -->|Yes| E
    L -->|No| M[許可]
    
    E --> N[エラー通知]
    M --> O[処理継続]
    
    note3[評価順序: allow→deny]
```

### 6.2 ファイルパス検証

```mermaid
graph TD
    A[保存パス指定] --> B[絶対パス変換]
    B --> C[正規化]
    C --> D[予約文字サニタイズ]
    
    D --> E[Windows予約文字除去]
    note right of E: < > : " / \ | ? * 除去
    E --> F[予約名回避]
    note right of F: CON, AUX, NUL, COM1-9, LPT1-9
    
    F --> G[先頭末尾処理]
    note right of G: 空白・ドット除去
    
    G --> H{ダウンロードディレクトリ内?}
    H -->|Yes| I[長さ確認]
    H -->|No| J[拒否]
    
    I --> K{パス長制限内?}
    K -->|Yes| L[許可]
    K -->|No| M[短縮]
    
    M --> L
    J --> N[エラー通知]
```

## 7. 実装上の注意事項

### 7.1 FFmpeg進捗パース
- `-progress pipe:1` 使用（locale非依存）
- key=value形式で安定した値を取得
- `out_time_ms`, `total_size` 等のキーを使用

### 7.2 ETA計算
- ゼロ除算回避
- 速度スパイク対策で指数移動平均（EMA）使用
- 異常値の除外処理

### 7.3 一時停止と再開
- 常に `.part` ファイルを使用
- 完了時にatomic renameで最終ファイルに
- 破損コンテナ対策でハッシュ検証（オプション）

### 7.4 復元処理
- 起動時は必ず `running` → `paused` に降格
- ユーザー選択で明示的に再開

### 7.5 同時実行制御
- `MAX_CONCURRENT` 変更時の動作：
  - 実行中タスク数 > 新上限なら自然減を待つ
  - 強制停止はしない

### 7.6 dedupKey仕様
```
dedupKey = SHA256(
  url + 
  pageUrl + 
  variantKey +  // bandwidth + resolution
  contentLength // optional
)
```

## 8. IPC追加仕様

### 8.1 復元サマリーイベント

```typescript
// on:download:restore-summary
interface RestoreSummaryEvent {
  total: number;      // 未完了タスク総数
  paused: number;     // 一時停止中の数
  resumable: number;  // 再開可能な数
  failed: number;     // エラー状態の数
}
```

### 8.2 一括操作API

```typescript
// app:download:resume-all
// app:download:pause-all
// app:download:cancel-all
```

これらは既存の個別操作APIの拡張として実装。