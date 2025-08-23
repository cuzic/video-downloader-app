# IPC (Inter-Process Communication) 仕様書

**バージョン**: v1.1  
**作成日**: 2025-01-23  
**対象**: Video Downloader（Electron アプリ）  
**目的**: Main ⇄ Renderer 間の通信仕様を安全・一貫・拡張容易に定義

---

## 1. 概要

本仕様は、Electron アプリケーションにおける IPC の**チャンネル設計 / Preload API / Main ハンドラー構成 / エラー体系 / セキュリティ指針**を定義します。`contextBridge` + `contextIsolation: true` を前提に、Renderer 側からは `window.electronAPI` のみを公開インターフェースとします。

---

## 2. アーキテクチャ

```
┌──────────────────────────────────────────────────────┐
│                  Renderer Process                      │
│  ┌──────────────────────────────────────────────┐    │
│  │              React Application                │    │
│  │         (window.electronAPI を使用)           │    │
│  └──────────────────────────────────────────────┘    │
│                         ↑↓                            │
│  ┌──────────────────────────────────────────────┐    │
│  │            Preload Script                     │    │
│  │  (contextBridge.exposeInMainWorld)           │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                          ↑↓
                    IPC Channel
                          ↑↓
┌──────────────────────────────────────────────────────┐
│                   Main Process                        │
│  ┌──────────────────────────────────────────────┐    │
│  │              IPC Handler                      │    │
│  │    (ipcMain.handle / webContents.send)       │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 3. IPC チャンネル定義

### 3.1 命名規則

- **Request/Response**: `app:{domain}:{action}`（Renderer → Main, `ipcRenderer.invoke`）
  - 例: `app:download:start`
- **Event（Main → Renderer）**: `on:{domain}:{event}`（`webContents.send`）
  - 例: `on:download:progress`
  - **備考**: 単一/複数 Renderer いずれにも送信可能。複数 Renderer が存在する場合は、アプリ実装側で送信先の選択またはブロードキャストを行う。

> 旧 `broadcast:*` は廃止し、`on:*` に統一。

### 3.2 チャンネル一覧

#### 3.2.1 ダウンロード管理

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:download:start` | R→M | Request/Response | ダウンロード開始 |
| `app:download:pause` | R→M | Request/Response | 一時停止 |
| `app:download:resume` | R→M | Request/Response | 再開 |
| `app:download:cancel` | R→M | Request/Response | キャンセル |
| `app:download:retry` | R→M | Request/Response | リトライ |
| `app:download:get-all` | R→M | Request/Response | 全タスク取得 |
| `app:download:get-by-id` | R→M | Request/Response | 特定タスク取得 |
| `app:download:clear-completed` | R→M | Request/Response | 完了済みクリア |
| `on:download:progress` | M→R | Event | 進捗更新（スロットリング対象） |
| `on:download:status-changed` | M→R | Event | ステータス変更 |
| `on:download:completed` | M→R | Event | 完了通知 |
| `on:download:error` | M→R | Event | エラー通知 |

#### 3.2.2 動画検出

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:detection:enable` | R→M | Request/Response | 検出有効化 |
| `app:detection:disable` | R→M | Request/Response | 検出無効化 |
| `app:detection:get-candidates` | R→M | Request/Response | 検出候補取得 |
| `app:detection:clear` | R→M | Request/Response | 検出候補クリア |
| `on:video:found` | M→R | Event | 動画検出 |
| `on:video:skipped` | M→R | Event | 検出スキップ |

#### 3.2.3 ブラウザ制御

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:browser:navigate` | R→M | Request/Response | URL 遷移 |
| `app:browser:back` | R→M | Request/Response | 戻る |
| `app:browser:forward` | R→M | Request/Response | 進む |
| `app:browser:reload` | R→M | Request/Response | リロード |
| `app:browser:stop` | R→M | Request/Response | 読み込み停止 |
| `app:browser:get-state` | R→M | Request/Response | 状態取得 |
| `on:browser:navigation` | M→R | Event | ナビゲーション変更 |
| `on:browser:title-updated` | M→R | Event | タイトル更新 |
| `on:browser:loading` | M→R | Event | ロード状態変更 |

#### 3.2.4 設定管理（改訂）

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:settings:get-all` | R→M | Request/Response | 設定全件取得 |
| `app:settings:get-by-key` | R→M | Request/Response | キー指定の取得 |
| `app:settings:set` | R→M | Request/Response | 設定保存 |
| `app:settings:reset` | R→M | Request/Response | 設定リセット（全体/キー） |
| `app:settings:export` | R→M | Request/Response | JSON 文字列エクスポート |
| `app:settings:import` | R→M | Request/Response | JSON 文字列インポート |
| `on:settings:updated` | M→R | Event | 設定更新（全 Renderer へ送信想定） |

#### 3.2.5 システム

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:system:get-info` | R→M | Request/Response | システム情報取得 |
| `app:system:check-update` | R→M | Request/Response | 更新確認 |
| `app:system:install-update` | R→M | Request/Response | 更新インストール |
| `app:system:reveal-in-folder` | R→M | Request/Response | フォルダで表示 |
| `app:system:open-external` | R→M | Request/Response | 外部リンクを開く |
| `app:system:get-path` | R→M | Request/Response | パス取得（`home`/`downloads` 等） |
| `on:update:available` | M→R | Event | 更新利用可能 |
| `on:update:progress` | M→R | Event | 更新進捗 |
| `on:update:downloaded` | M→R | Event | 更新 DL 完了 |

#### 3.2.6 Smart Naming

| チャンネル | 方向 | タイプ | 説明 |
|-----------|------|--------|------|
| `app:naming:extract-tokens` | R→M | Request/Response | トークン抽出 |
| `app:naming:preview` | R→M | Request/Response | ファイル名プレビュー |
| `app:naming:get-rules` | R→M | Request/Response | ルール取得 |
| `app:naming:save-rules` | R→M | Request/Response | ルール保存 |

---

## 4. Preload Script 実装

```typescript
// preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { 
  DownloadSpec, 
  DownloadTask, 
  MediaCandidate,
  AppSettings,
  SystemInfo,
  DownloadProgress,
  DownloadStatus,
  DownloadError,
  SkipReason,
  BrowserState,
} from './interfaces';

// チャンネル定数
const IPC_CHANNELS = {
  // Download
  DOWNLOAD_START: 'app:download:start',
  DOWNLOAD_PAUSE: 'app:download:pause',
  DOWNLOAD_RESUME: 'app:download:resume',
  DOWNLOAD_CANCEL: 'app:download:cancel',
  DOWNLOAD_RETRY: 'app:download:retry',
  DOWNLOAD_GET_ALL: 'app:download:get-all',
  DOWNLOAD_GET_BY_ID: 'app:download:get-by-id',
  DOWNLOAD_CLEAR_COMPLETED: 'app:download:clear-completed',
  
  // Detection
  DETECTION_ENABLE: 'app:detection:enable',
  DETECTION_DISABLE: 'app:detection:disable',
  DETECTION_GET_CANDIDATES: 'app:detection:get-candidates',
  DETECTION_CLEAR: 'app:detection:clear',
  
  // Browser
  BROWSER_NAVIGATE: 'app:browser:navigate',
  BROWSER_BACK: 'app:browser:back',
  BROWSER_FORWARD: 'app:browser:forward',
  BROWSER_RELOAD: 'app:browser:reload',
  BROWSER_STOP: 'app:browser:stop',
  BROWSER_GET_STATE: 'app:browser:get-state',
  
  // Settings (改訂)
  SETTINGS_GET_ALL: 'app:settings:get-all',
  SETTINGS_GET_BY_KEY: 'app:settings:get-by-key',
  SETTINGS_SET: 'app:settings:set',
  SETTINGS_RESET: 'app:settings:reset',
  SETTINGS_EXPORT: 'app:settings:export',
  SETTINGS_IMPORT: 'app:settings:import',
  
  // System
  SYSTEM_GET_INFO: 'app:system:get-info',
  SYSTEM_CHECK_UPDATE: 'app:system:check-update',
  SYSTEM_INSTALL_UPDATE: 'app:system:install-update',
  SYSTEM_REVEAL_IN_FOLDER: 'app:system:reveal-in-folder',
  SYSTEM_OPEN_EXTERNAL: 'app:system:open-external',
  SYSTEM_GET_PATH: 'app:system:get-path',
  
  // Smart Naming
  NAMING_EXTRACT_TOKENS: 'app:naming:extract-tokens',
  NAMING_PREVIEW: 'app:naming:preview',
  NAMING_GET_RULES: 'app:naming:get-rules',
  NAMING_SAVE_RULES: 'app:naming:save-rules',
} as const;

const EVENT_CHANNELS = {
  // Download
  ON_DOWNLOAD_PROGRESS: 'on:download:progress',
  ON_DOWNLOAD_STATUS_CHANGED: 'on:download:status-changed',
  ON_DOWNLOAD_COMPLETED: 'on:download:completed',
  ON_DOWNLOAD_ERROR: 'on:download:error',
  
  // Detection
  ON_VIDEO_FOUND: 'on:video:found',
  ON_VIDEO_SKIPPED: 'on:video:skipped',
  
  // Browser
  ON_BROWSER_NAVIGATION: 'on:browser:navigation',
  ON_BROWSER_TITLE_UPDATED: 'on:browser:title-updated',
  ON_BROWSER_LOADING: 'on:browser:loading',
  
  // Settings (改訂)
  ON_SETTINGS_UPDATED: 'on:settings:updated',
  
  // System
  ON_UPDATE_AVAILABLE: 'on:update:available',
  ON_UPDATE_PROGRESS: 'on:update:progress',
  ON_UPDATE_DOWNLOADED: 'on:update:downloaded',
} as const;

// 型安全なイベント購読ユーティリティ
export type EventCallback<T = any> = (data: T) => void;
export type UnsubscribeFn = () => void;

class EventManager {
  private listeners = new Map<string, Set<EventCallback>>();

  on<T>(channel: string, callback: EventCallback<T>): UnsubscribeFn {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      
      ipcRenderer.on(channel, (_ev: IpcRendererEvent, data: T) => {
        const set = this.listeners.get(channel);
        if (set) set.forEach(cb => cb(data));
      });
    }
    
    const set = this.listeners.get(channel)!;
    set.add(callback);
    
    return () => {
      set.delete(callback);
      if (set.size === 0) {
        ipcRenderer.removeAllListeners(channel);
        this.listeners.delete(channel);
      }
    };
  }
  
  removeAll() {
    this.listeners.forEach((_, ch) => ipcRenderer.removeAllListeners(ch));
    this.listeners.clear();
  }
}

const eventManager = new EventManager();

// 公開 API 本体
const electronAPI = {
  download: {
    start: (spec: DownloadSpec): Promise<{ id: string }> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_START, spec),
      
    pause: (id: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_PAUSE, id),
      
    resume: (id: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RESUME, id),
      
    cancel: (id: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, id),
      
    retry: (id: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RETRY, id),
      
    getAll: (): Promise<DownloadTask[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_GET_ALL),
      
    getById: (id: string): Promise<DownloadTask | null> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_GET_BY_ID, id),
      
    clearCompleted: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CLEAR_COMPLETED),
      
    onProgress: (cb: EventCallback<{ id: string; progress: DownloadProgress }>) => 
      eventManager.on(EVENT_CHANNELS.ON_DOWNLOAD_PROGRESS, cb),
      
    onStatusChanged: (cb: EventCallback<{ 
      id: string; 
      status: DownloadStatus; 
      previousStatus: DownloadStatus 
    }>) => eventManager.on(EVENT_CHANNELS.ON_DOWNLOAD_STATUS_CHANGED, cb),
    
    onCompleted: (cb: EventCallback<{ id: string; path: string }>) => 
      eventManager.on(EVENT_CHANNELS.ON_DOWNLOAD_COMPLETED, cb),
      
    onError: (cb: EventCallback<{ id: string; error: DownloadError }>) => 
      eventManager.on(EVENT_CHANNELS.ON_DOWNLOAD_ERROR, cb),
  },
  
  detection: {
    enable: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DETECTION_ENABLE),
      
    disable: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DETECTION_DISABLE),
      
    getCandidates: (): Promise<MediaCandidate[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.DETECTION_GET_CANDIDATES),
      
    clear: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.DETECTION_CLEAR),
      
    onVideoFound: (cb: EventCallback<MediaCandidate[]>) => 
      eventManager.on(EVENT_CHANNELS.ON_VIDEO_FOUND, cb),
      
    onVideoSkipped: (cb: EventCallback<{ url: string; reason: SkipReason }>) => 
      eventManager.on(EVENT_CHANNELS.ON_VIDEO_SKIPPED, cb),
  },
  
  browser: {
    navigate: (url: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_NAVIGATE, url),
      
    back: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_BACK),
      
    forward: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_FORWARD),
      
    reload: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_RELOAD),
      
    stop: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STOP),
      
    getState: (): Promise<BrowserState> => 
      ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_STATE),
      
    onNavigation: (cb: EventCallback<{ url: string; isMainFrame: boolean }>) => 
      eventManager.on(EVENT_CHANNELS.ON_BROWSER_NAVIGATION, cb),
      
    onTitleUpdated: (cb: EventCallback<{ title: string }>) => 
      eventManager.on(EVENT_CHANNELS.ON_BROWSER_TITLE_UPDATED, cb),
      
    onLoadingChanged: (cb: EventCallback<{ isLoading: boolean }>) => 
      eventManager.on(EVENT_CHANNELS.ON_BROWSER_LOADING, cb),
  },
  
  settings: {
    getAll: (): Promise<AppSettings> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
      
    getByKey: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_BY_KEY, key),
      
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
      
    reset: (key?: keyof AppSettings): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET, key),
      
    export: (): Promise<string> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_EXPORT),
      
    import: (jsonString: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IMPORT, jsonString),
      
    onUpdated: (cb: EventCallback<{ key: keyof AppSettings; value: any }>) => 
      eventManager.on(EVENT_CHANNELS.ON_SETTINGS_UPDATED, cb),
  },
  
  system: {
    getInfo: (): Promise<SystemInfo> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
      
    checkUpdate: (): Promise<{ available: boolean; version?: string; releaseNotes?: string }> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_CHECK_UPDATE),
      
    installUpdate: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_INSTALL_UPDATE),
      
    revealInFolder: (path: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_REVEAL_IN_FOLDER, path),
      
    openExternal: (url: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url),
      
    getPath: (name: 'home' | 'downloads' | 'documents' | 'videos'): Promise<string> => 
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_PATH, name),
      
    onUpdateAvailable: (cb: EventCallback<{ version: string; releaseNotes?: string }>) => 
      eventManager.on(EVENT_CHANNELS.ON_UPDATE_AVAILABLE, cb),
      
    onUpdateProgress: (cb: EventCallback<{ 
      percent: number; 
      bytesPerSecond: number; 
      transferred: number; 
      total: number 
    }>) => eventManager.on(EVENT_CHANNELS.ON_UPDATE_PROGRESS, cb),
    
    onUpdateDownloaded: (cb: EventCallback<{ version: string }>) => 
      eventManager.on(EVENT_CHANNELS.ON_UPDATE_DOWNLOADED, cb),
  },
  
  naming: {
    extractTokens: (html: string): Promise<Record<string, string>> => 
      ipcRenderer.invoke(IPC_CHANNELS.NAMING_EXTRACT_TOKENS, html),
      
    preview: (template: string, tokens: Record<string, string>): Promise<string> => 
      ipcRenderer.invoke(IPC_CHANNELS.NAMING_PREVIEW, template, tokens),
      
    getRules: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.NAMING_GET_RULES),
      
    saveRules: (rules: any[]): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.NAMING_SAVE_RULES, rules),
  },
  
  removeAllListeners: () => eventManager.removeAll(),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

## 5. Main Process ハンドラー実装

### 5.1 共通ユーティリティ

```typescript
// main/ipc.ts
import { ipcMain, BrowserWindow, shell, app } from 'electron';

export type IpcAsyncHandler = (
  event: Electron.IpcMainInvokeEvent, 
  ...args: any[]
) => Promise<any>;

export function wrapError(err: any): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export function wrapHandler(fn: IpcAsyncHandler): IpcAsyncHandler {
  return async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (e) {
      throw wrapError(e);
    }
  };
}

export function registerHandler(channel: string, handler: IpcAsyncHandler) {
  ipcMain.handle(channel, wrapHandler(handler));
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[IPC Registered] ${channel}`);
  }
}

export function broadcast(win: BrowserWindow, channel: string, payload: any) {
  win.webContents.send(channel, payload);
}
```

### 5.2 ハンドラー登録

```typescript
// main/ipc-handler.ts
import { BrowserWindow, shell, app, Notification } from 'electron';
import { registerHandler, broadcast } from './ipc';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-manager';
import { MediaDetector } from './media-detector';
import { SmartNamingEngine } from './smart-naming-engine';

export class IpcHandler {
  constructor(
    private downloadManager: DownloadManager,
    private settingsManager: SettingsManager,
    private mediaDetector: MediaDetector,
    private smartNaming: SmartNamingEngine,
    private mainWindow: BrowserWindow
  ) {
    this.register();
  }
  
  private register() {
    // ========================================
    // Settings (改訂)
    // ========================================
    registerHandler('app:settings:get-all', async () => 
      this.settingsManager.getAll()
    );
    
    registerHandler('app:settings:get-by-key', async (_e, key) => 
      this.settingsManager.get(key)
    );
    
    registerHandler('app:settings:set', async (_e, key, value) => {
      await this.settingsManager.set(key, value);
      broadcast(this.mainWindow, 'on:settings:updated', { key, value });
    });
    
    registerHandler('app:settings:reset', async (_e, key) => {
      await this.settingsManager.reset(key);
      const value = key 
        ? this.settingsManager.get(key) 
        : this.settingsManager.getAll();
      broadcast(this.mainWindow, 'on:settings:updated', { 
        key: key ?? ('*' as any), 
        value 
      });
    });
    
    registerHandler('app:settings:export', async () => 
      this.settingsManager.export()
    );
    
    registerHandler('app:settings:import', async (_e, json) => 
      this.settingsManager.import(json)
    );
    
    // ========================================
    // Download
    // ========================================
    registerHandler('app:download:start', async (_e, spec) => ({
      id: await this.downloadManager.startDownload(spec)
    }));
    
    registerHandler('app:download:pause', async (_e, id) => 
      this.downloadManager.pauseDownload(id)
    );
    
    registerHandler('app:download:resume', async (_e, id) => 
      this.downloadManager.resumeDownload(id)
    );
    
    registerHandler('app:download:cancel', async (_e, id) => 
      this.downloadManager.cancelDownload(id)
    );
    
    registerHandler('app:download:retry', async (_e, id) => 
      this.downloadManager.retryDownload(id)
    );
    
    registerHandler('app:download:get-all', async () => 
      this.downloadManager.getAll()
    );
    
    registerHandler('app:download:get-by-id', async (_e, id) => 
      this.downloadManager.getById(id)
    );
    
    registerHandler('app:download:clear-completed', async () => 
      this.downloadManager.clearCompleted()
    );
    
    // Download events → Renderer
    this.downloadManager.on('progress', (data) => 
      broadcast(this.mainWindow, 'on:download:progress', data)
    );
    
    this.downloadManager.on('status-changed', (data) => 
      broadcast(this.mainWindow, 'on:download:status-changed', data)
    );
    
    this.downloadManager.on('completed', (data) => {
      broadcast(this.mainWindow, 'on:download:completed', data);
      
      // 完了通知
      if (this.settingsManager.get('completedNotification.enabled')) {
        new Notification({
          title: 'ダウンロード完了',
          body: `${data.filename} のダウンロードが完了しました`,
        }).show();
      }
    });
    
    this.downloadManager.on('error', (data) => 
      broadcast(this.mainWindow, 'on:download:error', data)
    );
    
    // ========================================
    // Detection
    // ========================================
    registerHandler('app:detection:enable', async () => 
      this.mediaDetector.enable()
    );
    
    registerHandler('app:detection:disable', async () => 
      this.mediaDetector.disable()
    );
    
    registerHandler('app:detection:get-candidates', async () => 
      this.mediaDetector.getCandidates()
    );
    
    registerHandler('app:detection:clear', async () => 
      this.mediaDetector.clear()
    );
    
    this.mediaDetector.on('video-found', (cands) => 
      broadcast(this.mainWindow, 'on:video:found', cands)
    );
    
    this.mediaDetector.on('video-skipped', (data) => 
      broadcast(this.mainWindow, 'on:video:skipped', data)
    );
    
    // ========================================
    // System
    // ========================================
    registerHandler('app:system:reveal-in-folder', async (_e, p) => 
      shell.showItemInFolder(p)
    );
    
    registerHandler('app:system:open-external', async (_e, url) => 
      shell.openExternal(url)
    );
    
    registerHandler('app:system:get-path', async (_e, name) => 
      app.getPath(name as any)
    );
    
    // ========================================
    // Smart Naming
    // ========================================
    registerHandler('app:naming:extract-tokens', async (_e, html) => 
      this.smartNaming.extractTokens(html)
    );
    
    registerHandler('app:naming:preview', async (_e, template, tokens) => 
      this.smartNaming.preview(template, tokens)
    );
    
    registerHandler('app:naming:get-rules', async () => 
      this.smartNaming.getRules()
    );
    
    registerHandler('app:naming:save-rules', async (_e, rules) => 
      this.smartNaming.saveRules(rules)
    );
  }
}
```

---

## 6. エラーハンドリング

### 6.1 エラーコード体系

```typescript
export enum ErrorCode {
  // ネットワーク (1xxx)
  NETWORK_ERROR = 'E1000',
  TIMEOUT = 'E1001',
  CONNECTION_REFUSED = 'E1002',
  DNS_LOOKUP_FAILED = 'E1003',
  
  // ファイルシステム (2xxx)
  FILE_NOT_FOUND = 'E2000',
  PERMISSION_DENIED = 'E2001',
  DISK_FULL = 'E2002',
  PATH_TOO_LONG = 'E2003',
  
  // ダウンロード (3xxx)
  INVALID_URL = 'E3000',
  UNSUPPORTED_PROTOCOL = 'E3001',
  DRM_PROTECTED = 'E3002',
  LIVE_STREAM = 'E3003',
  
  // アプリ共通 (4xxx)
  INVALID_ARGUMENT = 'E4000',
  TASK_NOT_FOUND = 'E4001',
  ALREADY_EXISTS = 'E4002',
  OPERATION_CANCELLED = 'E4003',
}

export interface IPCError {
  code: ErrorCode;
  message: string;
  details?: any;
  stack?: string;
}
```

### 6.2 入力検証（Zod使用）

```typescript
import { z } from 'zod';

// スキーマ定義
const DownloadSpecSchema = z.object({
  url: z.string().url(),
  type: z.enum(['hls', 'dash', 'file']),
  filename: z.string().min(1).optional(),
  saveDir: z.string().min(1).optional(),
  headers: z.record(z.string()).optional(),
  variant: z.object({
    bandwidth: z.number().optional(),
    resolution: z.string().optional(),
    codecs: z.string().optional(),
  }).optional(),
  retry: z.object({
    maxAttempts: z.number().min(0).max(10),
    backoff: z.enum(['exponential', 'fixed']),
    initialDelayMs: z.number().min(100),
    maxDelayMs: z.number().optional(),
  }).optional(),
});

// ハンドラーでの検証
registerHandler('app:download:start', async (_e, spec) => {
  const parsed = DownloadSpecSchema.safeParse(spec);
  
  if (!parsed.success) {
    const err: IPCError = {
      code: ErrorCode.INVALID_ARGUMENT,
      message: 'Invalid DownloadSpec',
      details: parsed.error.flatten()
    };
    throw Object.assign(new Error(err.message), err);
  }
  
  const id = await this.downloadManager.startDownload(parsed.data);
  return { id };
});
```

---

## 7. セキュリティ指針

### 7.1 必須設定

- `contextIsolation: true` - コンテキスト分離を有効化
- `nodeIntegration: false` - Node.js統合を無効化
- `webSecurity: true` - Webセキュリティを有効化
- `sandbox: true` - サンドボックスを有効化
- Preload以外で`ipcRenderer`を直接触らない（露出は`window.electronAPI`のみ）

### 7.2 パス操作

- **絶対パスのみ許可**し、相対パスは拒否
- アプリ管理下ディレクトリにサンドボックス化
- シンボリックリンクの解決とチェック

### 7.3 URL制御

- 外部URLへはホワイトリスト/確認ダイアログで制限
- ローカルアドレスへのアクセスをブロック（SSRF対策）

### 7.4 通知

- OS通知（`Notification`）はユーザー設定でopt-in/opt-out可能に

---

## 8. パフォーマンス最適化

### 8.1 スロットリング実装

```typescript
function throttle<T extends (...args: any[]) => void>(
  fn: T, 
  wait: number
): T {
  let last = 0;
  let timeout: any = null;
  let lastArgs: any[] = [];
  
  const throttled = function(this: any, ...args: any[]) {
    const now = Date.now();
    const remaining = wait - (now - last);
    lastArgs = args;
    
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      last = now;
      fn.apply(this, lastArgs);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        last = Date.now();
        timeout = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  } as any;
  
  return throttled as T;
}

// 使用例：進捗更新のスロットリング
const sendProgress = throttle((payload: any) => {
  this.mainWindow.webContents.send('on:download:progress', payload);
}, 150); // 150ms間隔
```

### 8.2 バッチング

```typescript
class EventBatcher<T> {
  private batch: T[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private callback: (batch: T[]) => void,
    private delay: number = 100
  ) {}
  
  add(item: T): void {
    this.batch.push(item);
    
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.delay);
    }
  }
  
  flush(): void {
    if (this.batch.length > 0) {
      this.callback([...this.batch]);
      this.batch = [];
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// 使用例：検出動画のバッチング
const videoBatcher = new EventBatcher<MediaCandidate>(
  (batch) => broadcast(mainWindow, 'on:video:found', batch),
  150
);
```

### 8.3 大容量データ処理

- 進捗・検出候補等は**差分転送**や**ページング**を検討
- Renderer側は**仮想化リスト**等で描画負荷を軽減
- ストリーミング処理とバックプレッシャー制御

---

## 9. テスト戦略

### 9.1 単体テスト

```typescript
// __tests__/ipc.test.ts
import { wrapError, wrapHandler } from '../main/ipc';

describe('IPC Utilities', () => {
  describe('wrapError', () => {
    it('should return Error instance as-is', () => {
      const err = new Error('test');
      expect(wrapError(err)).toBe(err);
    });
    
    it('should convert non-Error to Error', () => {
      expect(wrapError('string error')).toBeInstanceOf(Error);
      expect(wrapError(123)).toBeInstanceOf(Error);
    });
  });
  
  describe('wrapHandler', () => {
    it('should catch and wrap errors', async () => {
      const handler = wrapHandler(async () => {
        throw 'string error';
      });
      
      await expect(handler({} as any)).rejects.toThrow(Error);
    });
  });
});
```

### 9.2 統合テスト

```typescript
// Playwright + Electron
import { _electron as electron } from 'playwright';

test('IPC communication', async () => {
  const app = await electron.launch({ args: ['main.js'] });
  const page = await app.firstWindow();
  
  // Renderer側でIPCを呼び出し
  const result = await page.evaluate(async () => {
    return await window.electronAPI.system.getInfo();
  });
  
  expect(result).toHaveProperty('platform');
  expect(result).toHaveProperty('version');
  
  await app.close();
});
```

### 9.3 モック

```typescript
// Renderer側テストでのモック
const mockElectronAPI = {
  download: {
    start: jest.fn().mockResolvedValue({ id: 'test-id' }),
    pause: jest.fn().mockResolvedValue(undefined),
    onProgress: jest.fn(),
  },
  // ... 他のAPI
};

(global as any).window = {
  electronAPI: mockElectronAPI
};
```

---

## 10. デバッグ支援

### 10.1 IPCロギング

```typescript
// 開発環境でのIPCメッセージログ
if (process.env.NODE_ENV === 'development') {
  // リクエストログ
  ipcMain.on('*', (event, ...args) => {
    console.log(`[IPC Request] ${event}`, args);
  });
  
  // レスポンスログ（wrapHandlerに組み込み）
  export function wrapHandler(fn: IpcAsyncHandler): IpcAsyncHandler {
    return async (event, ...args) => {
      const start = Date.now();
      try {
        const result = await fn(event, ...args);
        console.log(`[IPC Response] OK (${Date.now() - start}ms)`);
        return result;
      } catch (e) {
        console.error(`[IPC Response] ERROR (${Date.now() - start}ms)`, e);
        throw wrapError(e);
      }
    };
  }
}
```

### 10.2 DevTools Extension

```typescript
// IPC監視用のDevTools Extension
class IPCDevTools {
  private history: any[] = [];
  
  logRequest(channel: string, args: any[]): void {
    this.history.push({
      type: 'request',
      channel,
      args,
      timestamp: Date.now()
    });
  }
  
  logResponse(channel: string, result: any, error?: any): void {
    this.history.push({
      type: 'response',
      channel,
      result,
      error,
      timestamp: Date.now()
    });
  }
  
  getHistory(): any[] {
    return [...this.history];
  }
  
  clear(): void {
    this.history = [];
  }
}
```

---

## 11. 変更履歴

### v1.1 (2025-01-23)
- `broadcast:*` → `on:*` に統一
- Settings APIを`getAll`/`getByKey`に分離  
- `wrapHandler`/`registerHandler`を導入し、ログと例外処理を共通化
- 入力検証（Zod）導入方針を明記
- スロットリング・バッチングの実装例を追加
- Smart Naming APIを追加

### v1.0
- 初版作成（IPCチャンネル/Preload API/ハンドラー雛形/エラー体系）

---

## 12. Renderer用型定義

```typescript
// renderer/types/electron-api.d.ts
export type { ElectronAPI } from '../../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

使用例：

```typescript
// renderer/hooks/useDownload.ts
import { useEffect, useState } from 'react';

export function useDownload() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  
  useEffect(() => {
    // 初期データ取得
    window.electronAPI.download.getAll().then(setTasks);
    
    // イベント購読
    const unsubProgress = window.electronAPI.download.onProgress(({ id, progress }) => {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, progress } : t
      ));
    });
    
    const unsubStatus = window.electronAPI.download.onStatusChanged(({ id, status }) => {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, status } : t
      ));
    });
    
    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, []);
  
  return { tasks };
}
```

---

以上