import { useState, useEffect, useCallback } from 'react';
import type { DownloadTaskDTO } from '@shared/types';

/**
 * Hook for managing download tasks - named export for hooks
 */
export function useDownloadTasks(): {
  tasks: DownloadTaskDTO[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
} {
  const [tasks, setTasks] = useState<DownloadTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await window.electronAPI.download.listTasks();
      setTasks(response.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();

    // Setup event listeners
    const unsubscribeProgress = window.electronAPI.download.onProgress(() => {
      void loadTasks();
    });

    const unsubscribeError = window.electronAPI.download.onError(() => {
      void loadTasks();
    });

    const unsubscribeCompleted = window.electronAPI.download.onCompleted(() => {
      void loadTasks();
    });

    return () => {
      unsubscribeProgress();
      unsubscribeError();
      unsubscribeCompleted();
    };
  }, [loadTasks]);

  const pauseTask = async (taskId: string) => {
    await window.electronAPI.download.pause(taskId);
    await loadTasks();
  };

  const resumeTask = async (taskId: string) => {
    await window.electronAPI.download.resume(taskId);
    await loadTasks();
  };

  const cancelTask = async (taskId: string) => {
    await window.electronAPI.download.cancel(taskId);
    await loadTasks();
  };

  const retryTask = async (taskId: string) => {
    await window.electronAPI.download.retry(taskId);
    await loadTasks();
  };

  return {
    tasks,
    loading,
    error,
    loadTasks,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
  };
}
