ALTER TABLE subscribers ADD COLUMN status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'cancelado', 'suspendido'));

CREATE TABLE subscriber_cancel_reason (
  id SERIAL PRIMARY KEY,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
