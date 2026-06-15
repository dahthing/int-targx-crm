-- Migration 006: Project Hours Log
CREATE TABLE IF NOT EXISTS project_hours_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  hours NUMERIC(6,2) NOT NULL CHECK (hours > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_hours_log_project_id ON project_hours_log(project_id);

-- RLS
ALTER TABLE project_hours_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_own_project_hours" ON project_hours_log
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE partner_id = auth.uid()
    )
  );

CREATE POLICY "admins_all_hours" ON project_hours_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
