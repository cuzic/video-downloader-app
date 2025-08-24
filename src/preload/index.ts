import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadSpec, DownloadTaskDTO, AppSettings, ULog } from '@/shared/types';
import {
  downloadSpecSchema,
  taskIdSchema,
  systemPathNameSchema,
  filePathSchema,
  urlSchema,
  drmDetectionSchema,
  validateInput,
  sanitizePath,
} from '../shared/validation';

// Define the API exposed to the renderer process
const api = {
  // Download operations
  download: {
    start: async (spec: DownloadSpec) => {
      const validation = validateInput(downloadSpecSchema, spec);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:download:start', validation.data);
    },

    pause: async (taskId: string) => {
      const validation = validateInput(taskIdSchema, taskId);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:download:pause', validation.data);
    },

    resume: async (taskId: string) => {
      const validation = validateInput(taskIdSchema, taskId);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:download:resume', validation.data);
    },

    cancel: async (taskId: string) => {
      const validation = validateInput(taskIdSchema, taskId);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:download:cancel', validation.data);
    },

    retry: async (taskId: string) => {
      const validation = validateInput(taskIdSchema, taskId);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:download:retry', validation.data);
    },

    list: (): Promise<DownloadTaskDTO[]> => ipcRenderer.invoke('app:download:list'),

    get: (taskId: string): Promise<DownloadTaskDTO | null> =>
      ipcRenderer.invoke('app:download:get', taskId),

    // Event listeners
    onProgress: (callback: (taskId: string, progress: any) => void) => {
      const handler = (_: any, taskId: string, progress: any) => callback(taskId, progress);
      ipcRenderer.on('on:download:progress', handler);
      return () => ipcRenderer.removeListener('on:download:progress', handler);
    },

    onStatusChanged: (callback: (taskId: string, status: string) => void) => {
      const handler = (_: any, taskId: string, status: string) => callback(taskId, status);
      ipcRenderer.on('on:download:status-changed', handler);
      return () => ipcRenderer.removeListener('on:download:status-changed', handler);
    },

    onError: (callback: (taskId: string, error: any) => void) => {
      const handler = (_: any, taskId: string, error: any) => callback(taskId, error);
      ipcRenderer.on('on:download:error', handler);
      return () => ipcRenderer.removeListener('on:download:error', handler);
    },
  },

  // Settings operations
  settings: {
    get: (key: string): Promise<any> => ipcRenderer.invoke('app:settings:get', key),

    set: (key: string, value: any) => ipcRenderer.invoke('app:settings:set', key, value),

    getAll: (): Promise<Partial<AppSettings>> => ipcRenderer.invoke('app:settings:getAll'),

    initialize: () => ipcRenderer.invoke('app:settings:initialize'),

    // Event listener for settings changes
    onChanged: (callback: (key: string, value: any) => void) => {
      const handler = (_: any, key: string, value: any) => callback(key, value);
      ipcRenderer.on('on:settings:changed', handler);
      return () => ipcRenderer.removeListener('on:settings:changed', handler);
    },
  },

  // System operations
  system: {
    getPath: async (name: 'home' | 'downloads' | 'documents' | 'videos'): Promise<string> => {
      const validation = validateInput(systemPathNameSchema, name);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:system:getPath', validation.data);
    },

    openPath: async (filePath: string) => {
      const sanitized = sanitizePath(filePath);
      const validation = validateInput(filePathSchema, sanitized);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:system:openPath', validation.data);
    },

    showItemInFolder: async (filePath: string) => {
      const sanitized = sanitizePath(filePath);
      const validation = validateInput(filePathSchema, sanitized);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:system:showItemInFolder', validation.data);
    },

    openExternal: async (url: string) => {
      const validation = validateInput(urlSchema, url);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:system:openExternal', validation.data);
    },

    getVersion: (): Promise<string> => ipcRenderer.invoke('app:system:getVersion'),

    checkFileExists: async (filePath: string): Promise<boolean> => {
      const sanitized = sanitizePath(filePath);
      const validation = validateInput(filePathSchema, sanitized);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      return ipcRenderer.invoke('app:system:checkFileExists', validation.data);
    },
  },

  // Media detection
  detection: {
    onDetected: (callback: (candidate: any) => void) => {
      const handler = (_: any, candidate: any) => callback(candidate);
      ipcRenderer.on('on:detection:found', handler);
      return () => ipcRenderer.removeListener('on:detection:found', handler);
    },
  },

  // DRM detection
  drmDetected: (data: any) => {
    const validation = validateInput(drmDetectionSchema, data);
    if (validation.success) {
      ipcRenderer.send('app:drm:detected', validation.data);
    }
  },
};

// Helper to create log functions
const createLogFunction =
  (level: string, cid?: string) => (msg: string, meta?: Record<string, unknown>) => {
    ipcRenderer.send(`log:${level}`, { msg, meta, cid });
  };

// Define the logging API exposed to the renderer process
const logLevels = ['info', 'warn', 'error', 'debug'] as const;
const ulog: ULog = {
  ...(Object.fromEntries(logLevels.map((level) => [level, createLogFunction(level)])) as Pick<
    ULog,
    (typeof logLevels)[number]
  >),
  withCid: (cid: string) => {
    const withCidFunctions = Object.fromEntries(
      logLevels.map((level) => [level, createLogFunction(level, cid)])
    ) as unknown as ReturnType<ULog['withCid']>;
    return withCidFunctions;
  },
};

// Expose the APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('ulog', ulog);

// Type definitions for TypeScript
export type ElectronAPI = typeof api;
