# Guia de Deploy - VentasProui

## Regla principal

Produccion usa `server-FINAL.js`.

No asumir `src/backend/app.js` como entrypoint productivo.

## Servidor

- IP: `143.244.191.139`
- Ruta app: `/opt/crmp`
- PM2: `ventaspro-backend`
- URL: `https://crmp.ss-group.cloud`

## Metodo

- No usar `git pull` en produccion.
- Deploy por `scp` directo.
- Compilar frontend localmente.

## Orden

1. Backup.
2. Migracion autorizada, si aplica.
3. Backend, si aplica.
4. Frontend, si aplica.
5. Reinicio PM2, si aplica.
6. Verificacion.

## Frontend

```bash
npm run build
tar czf /tmp/dist-client.tar.gz -C dist/client .
scp /tmp/dist-client.tar.gz root@143.244.191.139:/tmp/
ssh root@143.244.191.139 "cd /opt/crmp/dist && mv client client.bak-$(date +%F-%H%M%S) && mkdir client && tar xzf /tmp/dist-client.tar.gz -C client/ && chown -R www-data:www-data client && chmod -R 755 client"
```

## Backend

Cuando cambia backend productivo, subir `server-FINAL.js` o el archivo autorizado por la tarea si el deploy especifico lo requiere.

```bash
ssh root@143.244.191.139 "cp /opt/crmp/server-FINAL.js /opt/crmp/server-FINAL.js.bak-$(date +%F-%H%M%S)"
scp server-FINAL.js root@143.244.191.139:/opt/crmp/server-FINAL.js
ssh root@143.244.191.139 "pm2 restart ventaspro-backend"
```

## Verificacion

```bash
ssh root@143.244.191.139 "pm2 status && pm2 logs ventaspro-backend --lines 30 --nostream"
curl -s https://crmp.ss-group.cloud/api/health
```

Actualizado: 2026-06-03.
