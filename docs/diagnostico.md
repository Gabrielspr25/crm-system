# Diagnostico de Produccion - VentasProui

## Fuente productiva

- Backend productivo: `server-FINAL.js`.
- No asumir `src/backend/app.js` como entrypoint.
- Base principal: `crm_pro`.

## PM2

```bash
ssh root@143.244.191.139 "pm2 status"
ssh root@143.244.191.139 "pm2 describe ventaspro-backend"
ssh root@143.244.191.139 "pm2 logs ventaspro-backend --lines 50 --nostream"
```

## Backend

```bash
curl -s https://crmp.ss-group.cloud/api/health
ssh root@143.244.191.139 "grep -n \"script\" -i <(pm2 describe ventaspro-backend)"
```

## Base de datos

```bash
ssh root@143.244.191.139 "sudo -u postgres psql -d crm_pro -c 'SELECT 1'"
```

## Verificar endpoints duplicados

```bash
grep -n "ENDPOINT" server-FINAL.js src/backend/routes/*.js
```

Si existe en ambos, confirmar cual esta activo antes de cambiar. Produccion prioriza `server-FINAL.js`.

Actualizado: 2026-06-03.
