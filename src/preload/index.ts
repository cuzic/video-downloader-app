import { contextBridge, ipcRenderer } from 'electron';
import type { 
  DownloadSpec, 
  DownloadTaskDTO, 
  AppSettings 
} from '@/shared/types';

// Define the API exposed to the renderer process
const api = {
  // Download operations
  download: {
    start: (spec: DownloadSpec) => 
      ipcRenderer.invoke('app:download:start', spec),
    
    pause: (taskId: string) => 
      ipcRenderer.invoke('app:download:pause', taskId),
    
    resume: (taskId: string) => 
      ipcRenderer.invoke('app:download:resume', taskId),
    
    cancel: (taskId: string) => 
      ipcRenderer.invoke('app:download:cancel', taskId),
    
    retry: (taskId: string) => 
      ipcRenderer.invoke('app:download:retry', taskId),
    
    list: (): Promise<DownloadTaskDTO[]> => 
      ipcRenderer.invoke('app:download:list'),
    
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
    get: (key: string): Promise<any> => 
      ipcRenderer.invoke('app:settings:get', key),
    
    set: (key: string, value: any) => 
      ipcRenderer.invoke('app:settings:set', key, value),
    
    getAll: (): Promise<Partial<AppSettings>> => 
      ipcRenderer.invoke('app:settings:getAll'),
    
    initialize: () => 
      ipcRenderer.invoke('app:settings:initialize'),
    
    // Event listener for settings changes
    onChanged: (callback: (key: string, value: any) => void) => {
      const handler = (_: any, key: string, value: any) => callback(key, value);
      ipcRenderer.on('on:settings:changed', handler);
      return () => ipcRenderer.removeListener('on:settings:changed', handler);
    },
  },
  
  // System operations
  system: {
    getPath: (name: 'home' | 'downloads' | 'documents' | 'videos'): Promise<string> => 
      ipcRenderer.invoke('app:system:getPath', name),
    
    openPath: (filePath: string) => 
      ipcRenderer.invoke('app:system:openPath', filePath),
    
    showItemInFolder: (filePath: string) => 
      ipcRenderer.invoke('app:system:showItemInFolder', filePath),
    
    openExternal: (url: string) => 
      ipcRenderer.invoke('app:system:openExternal', url),
    
    getVersion: (): Promise<string> => 
      ipcRenderer.invoke('app:system:getVersion'),
    
    checkFileExists: (filePath: string): Promise<boolean> => 
      ipcRenderer.invoke('app:system:checkFileExists', filePath),
  },
  
  // Media detection (to be implemented)
  detection: {
    onDetected: (callback: (candidate: any) => void) => {
      const handler = (_: any, candidate: any) => callback(candidate);
      ipcRenderer.on('on:detection:found', handler);
      return () => ipcRenderer.removeListener('on:detection:found', handler);
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api);

// Type definitions for TypeScript
export type ElectronAPI = typeof api;