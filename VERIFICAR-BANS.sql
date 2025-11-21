-- ================================================
-- VERIFICAR CONTEO DE BANs
-- ================================================

-- 1. Total de BANs únicos (sin duplicados por número)
SELECT 
    'Total BANs únicos por número' as tipo,
    COUNT(DISTINCT ban_number) as total
FROM bans
WHERE COALESCE(is_active, 1) = 1;

-- 2. Total de registros BAN (puede haber duplicados si mismo BAN en diferentes clientes)
SELECT 
    'Total registros BAN' as tipo,
    COUNT(*) as total
FROM bans
WHERE COALESCE(is_active, 1) = 1;

-- 3. BANs duplicados (mismo número asignado a diferentes clientes)
SELECT 
    'BANs duplicados (mismo número en diferentes clientes)' as tipo,
    ban_number,
    COUNT(*) as veces_repetido,
    STRING_AGG(DISTINCT client_id::text, ', ') as clientes_asignados
FROM bans
WHERE COALESCE(is_active, 1) = 1
GROUP BY ban_number
HAVING COUNT(*) > 1
ORDER BY veces_repetido DESC;

-- 4. BANs por cliente (promedio)
SELECT 
    'Estadísticas BANs por cliente' as tipo,
    COUNT(DISTINCT client_id) as clientes_con_ban,
    COUNT(*) as total_registros_ban,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT client_id), 0), 2) as promedio_bans_por_cliente
FROM bans
WHERE COALESCE(is_active, 1) = 1;

-- 5. Distribución: clientes con X cantidad de BANs
SELECT 
    'Distribución BANs por cliente' as tipo,
    ban_count,
    COUNT(*) as cantidad_clientes
FROM (
    SELECT 
        client_id,
        COUNT(*) as ban_count
    FROM bans
    WHERE COALESCE(is_active, 1) = 1
    GROUP BY client_id
) sub
GROUP BY ban_count
ORDER BY ban_count;

-- 6. BANs sin suscriptores vs con suscriptores
SELECT 
    'BANs con/sin suscriptores' as tipo,
    CASE 
        WHEN s.subscriber_count IS NULL OR s.subscriber_count = 0 THEN 'Sin suscriptores'
        ELSE 'Con suscriptores'
    END as estado,
    COUNT(*) as cantidad_bans
FROM bans b
LEFT JOIN (
    SELECT 
        ban_id,
        COUNT(*) as subscriber_count
    FROM subscribers
    WHERE COALESCE(is_active, 1) = 1
    GROUP BY ban_id
) s ON s.ban_id = b.id
WHERE COALESCE(b.is_active, 1) = 1
GROUP BY estado;

-- 7. Comparación: BANs contados por cliente vs BANs únicos
SELECT 
    'Comparación de conteo' as tipo,
    (SELECT COUNT(*) FROM bans WHERE COALESCE(is_active, 1) = 1) as total_registros_ban,
    (SELECT COUNT(DISTINCT ban_number) FROM bans WHERE COALESCE(is_active, 1) = 1) as bans_unicos_por_numero,
    (SELECT COUNT(DISTINCT id) FROM bans WHERE COALESCE(is_active, 1) = 1) as bans_unicos_por_id;
