-- Tabla de auditoría para registrar todas las acciones del sistema
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  username VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  entity_name VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar consultas
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- Comentarios
COMMENT ON TABLE audit_log IS 'Registro de auditoría de todas las acciones del sistema';
COMMENT ON COLUMN audit_log.action IS 'Tipo de acción: CREAR, EDITAR, ELIMINAR, MOVER_A_SEGUIMIENTO, DEVOLVER, COMPLETAR_VENTA, etc';
COMMENT ON COLUMN audit_log.entity_type IS 'Tipo de entidad: cliente, prospecto, venta, ban, etc';
