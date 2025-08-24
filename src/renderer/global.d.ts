import type { ElectronAPI, ULog } from '../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    ulog: ULog;
  }
}

export {};
