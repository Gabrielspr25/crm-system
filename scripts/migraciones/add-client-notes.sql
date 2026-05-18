-- ---------------------------------------------------------------------------
-- Migración: client_notes
-- Fecha:     2026-05-15
-- Owner:     Gabriel Sánchez / SS Group
--
-- Crea tabla client_notes para guardar notas históricas por cliente, con
-- autor (FK a salespeople), nombre snapshot, y timestamps. Independiente
-- de follow_up_notes (atadas a follow-ups) y de la columna legacy
-- clients.notes (campo único). No modifica datos existentes.
--
-- Características:
--   - INSERT-only desde el endpoint (no edit ni delete por diseño).
--   - ON DELETE CASCADE sobre clients: si se borra el cliente, sus notas también.
--   - ON DELETE SET NULL sobre salespeople: si se borra el vendedor, la nota
--     mantiene created_by_name como rastro y created_by queda null.
--   - Índice compuesto (client_id, created_at DESC) para listar ordenado.
--
-- Reversible:  DROP INDEX idx_client_notes_client_created; DROP TABLE client_notes;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_notes (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  note            text          NOT NULL,
  created_by      uuid          REFERENCES salespeople(id) ON DELETE SET NULL,
  created_by_name text          NOT NULL DEFAULT 'Sistema',
  created_at      timestamp     NOT NULL DEFAULT NOW(),
  updated_at      timestamp     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_created
  ON client_notes(client_id, created_at DESC);
