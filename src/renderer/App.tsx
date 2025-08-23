import { useState, useEffect } from 'react';
import type { DownloadTaskDTO } from '@/shared/types';

function App(): JSX.Element {
  const [tasks, setTasks] = useState<DownloadTaskDTO[]>([]);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    // Initialize settings on app start
    void window.electronAPI.settings.getAll();

    // Get app version
    void window.electronAPI.system.getInfo().then((info) => setVersion(info.version));

    // Load initial tasks
    void loadTasks();

    // Setup event listeners
    const unsubscribeProgress = window.electronAPI.download.onProgress((progress) => {
      console.warn('Progress update:', progress);
      void loadTasks();
    });

    const unsubscribeError = window.electronAPI.download.onError((error) => {
      console.error('Download error:', error);
      void loadTasks();
    });

    return () => {
      unsubscribeProgress();
      unsubscribeError();
    };
  }, []);

  const loadTasks = async () => {
    const response = await window.electronAPI.download.listTasks();
    setTasks(response.tasks);
  };

  const handleAddDownload = async () => {
    const url = prompt('Enter video URL:');
    if (!url) return;

    const paths = await window.electronAPI.system.getPaths();
    const downloadsPath = paths.downloads;

    await window.electronAPI.download.start({
      url,
      type: 'file', // Will be detected automatically later
      saveDir: downloadsPath,
    });

    void loadTasks();
  };

  const handlePause = async (taskId: string) => {
    await window.electronAPI.download.pause(taskId);
    void loadTasks();
  };

  const handleResume = async (taskId: string) => {
    await window.electronAPI.download.resume(taskId);
    void loadTasks();
  };

  const handleCancel = async (taskId: string) => {
    await window.electronAPI.download.cancel(taskId);
    void loadTasks();
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Video Downloader</h1>
        <span className="version">v{version}</span>
      </header>

      <div className="toolbar">
        <button onClick={() => void handleAddDownload()} className="btn btn-primary">
          Add Download
        </button>
      </div>

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>No downloads yet. Click &quot;Add Download&quot; to start.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="task-item">
              <div className="task-info">
                <div className="task-url">{task.spec.url}</div>
                <div className="task-status">{task.status}</div>
                {task.progress.percent !== undefined && (
                  <div className="task-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.progress.percent}%` }}
                      />
                    </div>
                    <span className="progress-text">{task.progress.percent.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <div className="task-actions">
                {task.status === 'running' && (
                  <button onClick={() => void handlePause(task.id)} className="btn btn-sm">
                    Pause
                  </button>
                )}
                {task.status === 'paused' && (
                  <button onClick={() => void handleResume(task.id)} className="btn btn-sm">
                    Resume
                  </button>
                )}
                {task.status !== 'completed' && task.status !== 'canceled' && (
                  <button
                    onClick={() => void handleCancel(task.id)}
                    className="btn btn-sm btn-danger"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
