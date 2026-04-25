-- Diagnostico: BANs con status NULL en BD.
-- Uso: psql ... -f bans-status-null.sql
-- Despues revisa la salida y aplica el UPDATE adecuado en
-- scripts/migraciones/cleanup-bans-status-null.sql.

-- 1) Conteo total
SELECT COUNT(*) AS bans_status_null FROM bans WHERE status IS NULL;

-- 2) Detalle de cada BAN sin status (con info para decidir A/C)
SELECT
    b.id,
    b.ban_number,
    b.account_type,
    b.dealer_code,
    b.dealer_name,
    b.reason_desc,
    b.sub_status_report,
    b.created_at,
    b.updated_at,
    c.id   AS client_id,
    c.name AS client_name,
    (SELECT COUNT(*) FROM subscribers s WHERE s.ban_id = b.id) AS total_subs,
    (SELECT COUNT(*) FROM subscribers s WHERE s.ban_id = b.id AND s.status = 'activo')    AS subs_activos,
    (SELECT COUNT(*) FROM subscribers s WHERE s.ban_id = b.id AND s.status = 'cancelado') AS subs_cancelados
FROM bans b
LEFT JOIN clients c ON c.id = b.client_id
WHERE b.status IS NULL
ORDER BY b.created_at DESC;
