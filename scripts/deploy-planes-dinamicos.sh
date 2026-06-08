#!/usr/bin/env bash
# deploy-planes-dinamicos.sh
# Deploy completo: migración DB + backend + páginas estáticas + frontend CRM
# Usar desde la raíz del proyecto VentasProui
#
# PRERREQUISITO DE INFRA (una sola vez, ya hecho en prod 2026-06-08):
#   El portal público vive en ofertas.ss-group.cloud (root /opt/claro-ofertas/public-ofertas,
#   backend ofertas-web :3005). Las páginas pegan a /api/planes-modulos, que debe enrutarse
#   al backend ventaspro (:3001). Para eso, en /etc/nginx/sites-available/ofertas.ss-group.cloud
#   debe existir ESTE bloque ANTES de `location /api/` (igual que /api/equipos-lista):
#
#     location /api/planes-modulos {
#       proxy_pass http://127.0.0.1:3001;
#       proxy_http_version 1.1;
#       proxy_set_header Host $host;
#       proxy_set_header X-Real-IP $remote_addr;
#       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     }
#   Luego: nginx -t && nginx -s reload

set -e

SERVER="root@143.244.191.139"
KEY="$HOME/.ssh/id_rsa_ventaspro"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $SERVER"
SCP="scp -i $KEY -o StrictHostKeyChecking=no"

# Backend ventaspro vive en /opt/crmp (NO /opt/crm-pro). Frontend estático: /opt/crmp/dist/client
REMOTE_APP="/opt/crmp"
REMOTE_OFERTAS="/opt/claro-ofertas/public-ofertas"
PM2_APP="ventaspro-backend"

echo "============================================"
echo "  DEPLOY: Planes Dinámicos — Claro Business"
echo "============================================"

# ── 1. Migración DB ───────────────────────────────────────────────────────
# La BD usa peer auth: en el server hay que correr psql como el usuario 'postgres'
# (sudo -u postgres), NO con -U postgres por socket. Además la app conecta como
# crm_user, así que la migración OTORGA permisos a crm_user sobre la tabla nueva.
echo ""
echo "→ [1/5] Ejecutando migración DB..."
$SCP migrations/2026-06-08-planes-modulos.sql      $SERVER:/tmp/
$SCP migrations/2026-06-08-planes-modulos-seed.sql $SERVER:/tmp/

$SSH bash -s <<'REMOTE_MIGRATION'
  set -e
  DB="crm_pro"
  echo "  Backup schema previo..."
  sudo -u postgres pg_dump -d $DB --schema-only -f /opt/crmp/backups/pre-planes-modulos-$(date +%Y%m%d-%H%M%S).sql
  echo "  Creando tabla planes_modulos..."
  sudo -u postgres psql -d $DB -v ON_ERROR_STOP=1 -f /tmp/2026-06-08-planes-modulos.sql
  echo "  Insertando seed data..."
  sudo -u postgres psql -d $DB -v ON_ERROR_STOP=1 -f /tmp/2026-06-08-planes-modulos-seed.sql
  echo "  Filas insertadas:"
  sudo -u postgres psql -d $DB -c "SELECT pagina, COUNT(*) FROM planes_modulos GROUP BY pagina ORDER BY pagina;"
  echo "  ✓ Migración completada"
REMOTE_MIGRATION

# ── 2. Build frontend ─────────────────────────────────────────────────────
echo ""
echo "→ [2/5] Compilando frontend..."
npm run build
echo "  ✓ Build completado"

# ── 3. Deploy backend (rutas + controller + server) ───────────────────────
echo ""
echo "→ [3/5] Subiendo backend..."
$SCP src/backend/controllers/planesModulosController.js $SERVER:$REMOTE_APP/src/backend/controllers/
$SCP src/backend/routes/planesModulosRoutes.js          $SERVER:$REMOTE_APP/src/backend/routes/
$SCP server-FINAL.js                                    $SERVER:$REMOTE_APP/
echo "  ✓ Backend subido"

# ── 4. Deploy frontend CRM + admin-planes ────────────────────────────────
echo ""
echo "→ [4/5] Subiendo frontend CRM..."
# El dist completo incluye admin-planes.html (copiado desde public/ por el build)
$SCP -r dist/client $SERVER:$REMOTE_APP/dist/
echo "  ✓ Frontend CRM subido"

# ── 5. Deploy páginas estáticas del portal ────────────────────────────────
echo ""
echo "→ [5/5] Subiendo páginas del portal Claro Ofertas..."
$SCP "Planes para web/index.html"       $SERVER:$REMOTE_OFERTAS/
$SCP "Planes para web/movil.html"       $SERVER:$REMOTE_OFERTAS/
$SCP "Planes para web/banda-ancha.html" $SERVER:$REMOTE_OFERTAS/
echo "  ✓ Páginas del portal subidas"

# ── Restart PM2 (solo el backend ventaspro, NO 'all') ─────────────────────
echo ""
echo "→ Reiniciando $PM2_APP..."
$SSH "pm2 restart $PM2_APP"
sleep 4

# ── Verificación ──────────────────────────────────────────────────────────
echo ""
echo "→ Verificando endpoints (localhost:3001)..."
for pagina in moviles fijos inalambrico; do
  $SSH curl -s "http://localhost:3001/api/planes-modulos/$pagina" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  ✓ /api/planes-modulos/$pagina — {len(d.get(\"modulos\",[]))} módulos')
" 2>/dev/null || echo "  ⚠ Verificar manualmente: curl localhost:3001/api/planes-modulos/$pagina"
done

echo ""
echo "============================================"
echo "  ✅ Deploy completado"
echo ""
echo "  Portal: https://ofertas.ss-group.cloud"
echo "    • index.html        → Planes Fijos"
echo "    • movil.html        → Planes Móviles"
echo "    • banda-ancha.html  → Inalámbrico/IoT"
echo ""
echo "  Admin: https://crmp.ss-group.cloud/admin-planes.html"
echo "============================================"
