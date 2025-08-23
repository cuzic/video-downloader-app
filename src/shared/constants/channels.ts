/**
 * IPC Channel Constants
 * 
 * Naming Convention:
 * - Request/Response: `app:{domain}:{action}`
 * - Events (Main → Renderer): `on:{domain}:{event}`
 */

// Download channels
export const DOWNLOAD_CHANNELS = {
  // Commands
  START: 'app:download:start',
  PAUSE: 'app:download:pause',
  RESUME: 'app:download:resume',
  CANCEL: 'app:download:cancel',
  RETRY: 'app:download:retry',
  REMOVE: 'app:download:remove',
  GET_TASK: 'app:download:get-task',
  LIST_TASKS: 'app:download:list-tasks',
  CLEAR_COMPLETED: 'app:download:clear-completed',
  
  // Events
  ON_PROGRESS: 'on:download:progress',
  ON_COMPLETED: 'on:download:completed',
  ON_ERROR: 'on:download:error',
  ON_STARTED: 'on:download:started',
  ON_PAUSED: 'on:download:paused',
  ON_RESUMED: 'on:download:resumed',
  ON_CANCELED: 'on:download:canceled',
} as const;

// Detection channels
export const DETECTION_CHANNELS = {
  // Commands
  ENABLE: 'app:detection:enable',
  DISABLE: 'app:detection:disable',
  IS_ENABLED: 'app:detection:is-enabled',
  GET_CANDIDATES: 'app:detection:get-candidates',
  CLEAR_DETECTIONS: 'app:detection:clear',
  IGNORE_URL: 'app:detection:ignore-url',
  
  // Events
  ON_VIDEO_FOUND: 'on:detection:video-found',
  ON_VIDEO_SKIPPED: 'on:detection:video-skipped',
  ON_STATUS_CHANGED: 'on:detection:status-changed',
} as const;

// Settings channels
export const SETTINGS_CHANNELS = {
  // Commands
  GET_ALL: 'app:settings:get-all',
  GET: 'app:settings:get',
  SET: 'app:settings:set',
  RESET: 'app:settings:reset',
  
  // Events
  ON_CHANGED: 'on:settings:changed',
} as const;

// System channels
export const SYSTEM_CHANNELS = {
  // Commands
  GET_PATH: 'app:system:getPath',
  GET_PATHS: 'app:system:get-paths',
  OPEN_PATH: 'app:system:openPath',
  SHOW_ITEM_IN_FOLDER: 'app:system:showItemInFolder',
  OPEN_EXTERNAL: 'app:system:openExternal',
  GET_VERSION: 'app:system:getVersion',
  GET_INFO: 'app:system:get-info',
  CHECK_FILE_EXISTS: 'app:system:checkFileExists',
  SELECT_DIRECTORY: 'app:system:selectDirectory',
  SELECT_FILE: 'app:system:selectFile',
  GET_FILE_INFO: 'app:system:getFileInfo',
  TRASH_ITEM: 'app:system:trashItem',
  
  // Clipboard
  CLIPBOARD_WRITE_TEXT: 'app:clipboard:write-text',
  CLIPBOARD_READ_TEXT: 'app:clipboard:read-text',
} as const;

// Window channels
export const WINDOW_CHANNELS = {
  // Commands
  MINIMIZE: 'app:window:minimize',
  MAXIMIZE: 'app:window:maximize',
  CLOSE: 'app:window:close',
  IS_MAXIMIZED: 'app:window:is-maximized',
  SET_ALWAYS_ON_TOP: 'app:window:set-always-on-top',
  
  // Events
  ON_MAXIMIZED: 'on:window:maximized',
  ON_UNMAXIMIZED: 'on:window:unmaximized',
  ON_FOCUS: 'on:window:focus',
  ON_BLUR: 'on:window:blur',
} as const;

// App channels
export const APP_CHANNELS = {
  // Commands
  GET_VERSION: 'app:app:get-version',
  QUIT: 'app:app:quit',
  RELAUNCH: 'app:app:relaunch',
  
  // Events
  ON_BEFORE_QUIT: 'on:app:before-quit',
  ON_ACTIVATE: 'on:app:activate',
} as const;

// Collect all channels for validation
export const ALL_CHANNELS = [
  ...Object.values(DOWNLOAD_CHANNELS),
  ...Object.values(DETECTION_CHANNELS),
  ...Object.values(SETTINGS_CHANNELS),
  ...Object.values(SYSTEM_CHANNELS),
  ...Object.values(WINDOW_CHANNELS),
  ...Object.values(APP_CHANNELS),
] as const;

export type Channel = typeof ALL_CHANNELS[number];