
-- Tabla para historial de pasos completados (Independiente de las llamadas)
CREATE TABLE IF NOT EXISTS prospect_step_history (
    id SERIAL PRIMARY KEY,
    follow_up_id INTEGER NOT NULL REFERENCES follow_up_prospects(id) ON DELETE CASCADE,
    step_id INTEGER NOT NULL REFERENCES follow_up_steps(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
