export const CREATE_TABLES_SQL = `
-- Projects: Tracking projects created by user
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  cover_image_uri TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  reminder_time TEXT,
  reminder_days TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  is_deleted INTEGER DEFAULT 0
);

-- Entries: Daily progress entries
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  content_text TEXT,
  media_uri TEXT,
  media_remote_url TEXT,
  thumbnail_uri TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  upload_status TEXT DEFAULT 'pending',
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Reports: Monthly progress reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  month TEXT NOT NULL,
  summary_text TEXT,
  entry_ids TEXT,
  first_entry_id TEXT,
  last_entry_id TEXT,
  total_entries INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  total_photos INTEGER DEFAULT 0,
  total_text_entries INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Notification Settings: Per-project reminders
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  time TEXT NOT NULL,
  days TEXT NOT NULL,
  last_sent_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Sync Queue: Offline operation queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_project ON entries(project_id);
CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_project_created ON entries(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_upload_status ON entries(upload_status);
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON projects(is_deleted);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_reports_project_month ON reports(project_id, month);
CREATE INDEX IF NOT EXISTS idx_notification_settings_project ON notification_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_attempts ON sync_queue(attempts);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record ON sync_queue(table_name, record_id);
`;
