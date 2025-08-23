import { useState, useEffect } from 'react';
import type { DownloadTaskDTO } from '@/shared/types';

export function App() {
  const [tasks, setTasks] = useState<DownloadTaskDTO[]>([]);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    // Initialize settings on app start
    window.electronAPI.settings.getAll();
    
    // Get app version
    window.electronAPI.system.getInfo().then(info => setVersion(info.version));
    
    // Load initial tasks
    loadTasks();
    
    // Setup event listeners
    const unsubscribeProgress = window.electronAPI.download.onProgress((progress) => {
      console.log('Progress update:', progress);
      loadTasks();
    });
    
    const unsubscribeError = window.electronAPI.download.onError((error) => {
      console.log('Download error:', error);
      loadTasks();
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
    
    loadTasks();
  };

  const handlePause = async (taskId: string) => {
    await window.electronAPI.download.pause(taskId);
    loadTasks();
  };

  const handleResume = async (taskId: string) => {
    await window.electronAPI.download.resume(taskId);
    loadTasks();
  };

  const handleCancel = async (taskId: string) => {
    await window.electronAPI.download.cancel(taskId);
    loadTasks();
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Video Downloader</h1>
        <span className="version">v{version}</span>
      </header>
      
      <div className="toolbar">
        <button onClick={handleAddDownload} className="btn btn-primary">
          Add Download
        </button>
      </div>
      
      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>No downloads yet. Click "Add Download" to start.</p>
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
                  <button onClick={() => handlePause(task.id)} className="btn btn-sm">
                    Pause
                  </button>
                )}
                {task.status === 'paused' && (
                  <button onClick={() => handleResume(task.id)} className="btn btn-sm">
                    Resume
                  </button>
                )}
                {task.status !== 'completed' && task.status !== 'canceled' && (
                  <button onClick={() => handleCancel(task.id)} className="btn btn-sm btn-danger">
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