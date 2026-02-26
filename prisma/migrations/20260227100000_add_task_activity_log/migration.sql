-- REQ-010: Task Activity Log for tracking changes
CREATE TABLE task_activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_activity_task_id ON task_activity_logs(task_id);
CREATE INDEX idx_task_activity_created ON task_activity_logs(created_at);
