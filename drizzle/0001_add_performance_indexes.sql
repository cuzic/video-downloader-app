-- Add performance indexes for frequently queried columns

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- History table indexes  
CREATE INDEX IF NOT EXISTS idx_history_task_id ON history(task_id);
CREATE INDEX IF NOT EXISTS idx_history_event ON history(event);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_task_created ON history(task_id, created_at);

-- Detections table indexes
CREATE INDEX IF NOT EXISTS idx_detections_page_url ON detections(page_url);
CREATE INDEX IF NOT EXISTS idx_detections_detected_at ON detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_detections_auto_delete ON detections(auto_delete);
CREATE INDEX IF NOT EXISTS idx_detections_skip_reason ON detections(skip_reason);

-- Segments table indexes
CREATE INDEX IF NOT EXISTS idx_segments_task_id_status ON segments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_segments_task_id ON segments(task_id);
CREATE INDEX IF NOT EXISTS idx_segments_status ON segments(status);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);

-- Statistics table indexes
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date DESC);
CREATE INDEX IF NOT EXISTS idx_statistics_domains_date ON statistics_domains(date);
CREATE INDEX IF NOT EXISTS idx_statistics_media_types_date ON statistics_media_types(date);

-- Settings table index
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at DESC);