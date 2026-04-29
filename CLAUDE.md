# CLAUDE.md — Memoria activa del proyecto VentasProui

> Lee este archivo al inicio de cada sesión antes de hacer cualquier cosa.

---

## ¿Qué es este sistema?

**VentasProui CRM** — Sistema CRM para agentes de ventas de **Claro Puerto Rico**.
- **Dueño:** Gabriel Sánchez (gafsanchez@gmail.com) — SS Group
- **URL producción:** https://crmp.ss-group.cloud
- **Servidor:** 143.244.191.139
- **Ruta en server:** `/opt/crmp`
- **Versión actual:** 2026-398
- **Usuarios activos:** ~5 vendedores

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express (`server-FINAL.js`) |
| Base de datos | PostgreSQL |
| Auth | JWT |
| Deploy | PM2 en VPS (proceso: `ventaspro-backend`) |

---

## Módulos activos

- **Clientes** — Empresas con múltiples contactos, asignación de vendedor, historial
- **Servicios y BANs** — Líneas telefónicas Claro (móvil, fijo, internet, TV)
- **Ventas y Comisiones** — Registro de ventas, cálculo de comisiones por producto/volumen
- **Metas** — Metas por vendedor y período, seguimiento de cumplimiento en tiempo real
- **Pipeline** — Prospectos, etapas customizables, seguimientos, agenda
- **Importación** — Carga masiva desde Excel, detección de duplicados
- **Sincronización Tango** — Comparación CRM vs sistema oficial Claro, detección de discrepancias
- **Campañas Email** — Envío masivo con plantillas, seguimiento aperturas/clics
- **Reportes** — Comisiones, comparativa CRM vs Tango, auditoría de acciones
- **Tareas** — Vinculadas a clientes, estados, fechas límite, exportación Excel

---

## Integraciones

| Sistema | Propósito |
|---|---|
| Tango (Claro ERP) | Sync de ventas y suscriptores |
| OCR | Lectura de documentos e imágenes |
| Email (SMTP) | Campañas y notificaciones |
| Excel | Importación y exportación masiva |

---

## Estructura clave del código

```
VentasProui/
├── server-FINAL.js          ← Backend principal (API)
├── src/
│   ├── backend/
│   │   ├── controllers/     ← Lógica de negocio
│   │   └── routes/          ← Rutas modulares
│   └── (frontend React)
├── scripts/
│   ├── diagnostico/         ← Consultas y verificaciones
│   ├── migraciones/         ← Ajustes y migraciones BD
│   ├── tests-manuales/      ← Pruebas
│   ├── ops-deploy/          ← Despliegue
│   └── legacy/              ← Scripts históricos (no tocar)
```

---

## Comandos importantes

```bash
# Desarrollo local
npm run dev            # Frontend
npm run dev:backend    # Backend

# Producción — solo hay 2 scripts npm reales: build y start.
#                NO existe `npm run ops:deploy`.
npm run build          # Compilar frontend (genera dist/client/)
npm run start          # Iniciar backend (node server-FINAL.js)

# Diagnóstico servidor
ssh root@143.244.191.139 "pm2 logs ventaspro-backend --lines 50 --nostream"
ssh root@143.244.191.139 "pm2 status"
ssh root@143.244.191.139 "pm2 describe ventaspro-backend"
```

### Deploy real (scp directo, no `git pull`)

El proyecto se despliega copiando archivos directos al server con `scp`. El repo
git en `/opt/crmp` está dirty desde hace tiempo (35+ archivos M sin commit) y un
`git pull` produciría merge conflicts; **no usar `git pull` en producción**.

Procedimiento:

```bash
# 1) Backup de los archivos a tocar (para rollback rápido)
ssh root@143.244.191.139 "cp /opt/crmp/<ruta>/<archivo> /opt/crmp/<ruta>/<archivo>.bak-$(date +%F)"

# 2) Subir backend (Node ejecuta JS directo, no requiere build)
scp src/backend/controllers/<archivo>.js root@143.244.191.139:/opt/crmp/src/backend/controllers/

# 3) Subir frontend ya buildeado (NO buildar en server: el work-tree puede
#    estar inconsistente y romper el build). Buildar local y empaquetar:
npm run build
tar czf /tmp/dist-client.tar.gz -C dist/client .
scp /tmp/dist-client.tar.gz root@143.244.191.139:/tmp/

# 4) En el server, reemplazar dist/client preservando ownership www-data
ssh root@143.244.191.139 "cd /opt/crmp/dist && \
  mv client client.bak-$(date +%F) && mkdir client && \
  tar xzf /tmp/dist-client.tar.gz -C client/ && \
  chown -R www-data:www-data client/ && chmod -R 755 client/"

# 5) Reiniciar PM2 para que tome los nuevos controllers
ssh root@143.244.191.139 "pm2 restart ventaspro-backend"

# 6) Validar agente de sistema (POST con auth admin)
#    Endpoint: /api/system-test/full
#    Generar token JWT en el server con JWT_SECRET del /opt/crmp/.env
```

**Nota sobre `/api/version`**: el endpoint existe en `server-FINAL.js` legacy
pero NO en `src/backend/app.js` modular (que es lo que ejecuta PM2 en prod).
Si necesitás ver la versión, leé `package.json` o usá `pm2 describe`.

---

## Reglas críticas de trabajo (no ignorar)

1. **Endpoints legacy vs modulares** — Siempre verificar con grep si hay legacy duplicados antes de desplegar
2. **Orden de deploy:** BD → Backend → Frontend → Verificar
3. **Nunca crear scripts sueltos en raíz** — van dentro de `scripts/` en su categoría
4. **Validar después de cada cambio** — PM2 restart exitoso + endpoint responde + datos en BD correctos
5. Ver `CHECKLIST-OBLIGATORIO-AGENTE.md` para detalle completo

---

## Rutas modulares activas (server-FINAL.js)

```javascript
app.use('/api/referidos', referidosRoutes);
app.use('/api/tariffs', tarifasRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/vendors', vendorRoutes);
```

---

## Pendiente / En desarrollo

- Panel general de informes (metas, cumplimiento, KPIs, tendencia de ventas) — **solicitado por Gabriel**
- Integrar oferta de agencia digital a los mismos clientes de Claro
- Definir automatizaciones faltantes
- Reportes para toma de decisiones del dueño

---

## Notas de sesiones anteriores

- **Abril 2026:** Gabriel solicita panel general de informes con KPIs, metas, ranking de vendedores, embudo de ventas, tendencia y alertas.

- **2026-04-29 — Módulos retirados.** Se retira acceso a 3 módulos no operativos:
  - **Importador viejo** (`/importador`, `ImportadorVisual.tsx`) — Import New (`/importador-nuevo`) lo reemplaza.
  - **Cognos** (`/discrepancias`, endpoint `/api/discrepancias`) — sin uso operativo.
  - **Referidos** (`/referidos`, endpoint `/api/referidos`) — sin uso operativo.

  Razón: limpieza pre-lanzamiento. Backend `/api/importador` se mantiene porque
  Import New lo reusa. Archivos físicos quedan en `legacy/*.bak` (no eliminados).
  BD intacta — datos históricos (`referidos`, tablas relacionadas) se conservan.
  Tests del agente sistema correspondientes pasan a `skip` con razón "módulo retirado".

---

*Actualizado: 2026-04-29 — Gabriel Sánchez / SS Group*
