# 🗑️ INSTRUCCIONES PARA BORRAR DATOS DE LA BD

## ❌ PROBLEMA:

El script Node.js no encuentra las tablas, pero **las tablas SÍ existen** (las viste en la BD).

## ✅ SOLUCIÓN: Ejecutar SQL directamente

### Opción 1: Desde psql (terminal)

```bash
psql -h localhost -U crm_user -d crm_pro
```

Luego ejecutar:

```sql
DELETE FROM subscribers;
DELETE FROM bans;
DELETE FROM clients;
```

### Opción 2: Desde pgAdmin o cliente SQL

1. Conectarse a la BD `crm_pro`
2. Abrir Query Tool
3. Ejecutar este SQL:

```sql
-- 1. Ver cuántos registros hay ANTES
SELECT 
    (SELECT COUNT(*) FROM subscribers) as total_subscribers,
    (SELECT COUNT(*) FROM bans) as total_bans,
    (SELECT COUNT(*) FROM clients) as total_clients;

-- 2. BORRAR en orden (respetando foreign keys)
DELETE FROM subscribers;
DELETE FROM bans;
DELETE FROM clients;

-- 3. Verificar que quedó vacío
SELECT 
    (SELECT COUNT(*) FROM subscribers) as remaining_subscribers,
    (SELECT COUNT(*) FROM bans) as remaining_bans,
    (SELECT COUNT(*) FROM clients) as remaining_clients;
```

### Opción 3: Ejecutar archivo SQL

```bash
psql -h localhost -U crm_user -d crm_pro -f LIMPIAR-BD-MANUAL.sql
```

## ⚠️ IMPORTANTE:

- Este proceso **NO SE PUEDE DESHACER**
- Asegúrate de tener backup si necesitas los datos
- Los registros se borrarán permanentemente

## ✅ DESPUÉS DE BORRAR:

1. Verifica que todas las tablas queden en 0 registros
2. Procede con la importación
3. Los clientes incompletos aparecerán en el tab "Incompletos"

