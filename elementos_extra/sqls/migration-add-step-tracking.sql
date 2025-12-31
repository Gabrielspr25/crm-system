
-- Agregar columnas para seguimiento de pasos en call_logs
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS step_id INTEGER REFERENCES follow_up_steps(id) ON DELETE SET NULL;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS step_completed BOOLEAN DEFAULT FALSE;
