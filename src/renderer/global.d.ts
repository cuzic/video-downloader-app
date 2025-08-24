import type { ElectronAPI } from '../preload';
import type { ULog } from '@/shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    ulog: ULog;
  }
}

export {};
