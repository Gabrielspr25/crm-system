# Deploy del sistema nuevo (VentasPro / sistema-nuevo)

Actualizado: 2026-06-27.

> Regla del proyecto: **el deploy lo hace Gabriel** (scp + PM2). Esto es la guía/checklist.
> Orden cuando hay BD: **backup → migración autorizada → backend → frontend → verificación.**

## Qué se sube

- Carpeta **`sistema-nuevo/`** (backend Node + frontend `app.html` + `propuesta-template.html` + `img/`).
- **NO** se sube `node_modules/` ni `.env` (están en `.gitignore`). En el servidor: `npm install`.

## 1) Base de datos (prod)

- Usa la base **`crm_pro`** de producción. El sistema nuevo:
  - Lee data REAL del schema **`public`** (clients, bans, subscribers, sales_opportunities, subscriber_reports…).
  - Guarda su config/catalogo en el schema **`ventaspro_nuevo`** (products, categories, product_step_templates, goals, comparativas…).
- **Correr las migraciones** de `sistema-nuevo/db/migrations/` en prod (crean el schema `ventaspro_nuevo` y sus tablas) — **con backup previo y autorización**.
- Los **pasos por producto** (product_step_templates) hay que cargarlos en prod (hoy en local: Fijo Ren 5, Fijo New 8, Movil Ren 8, Movil New 9). Se copian con un INSERT o desde Configurar pasos.

## 2) Backend

- `cd sistema-nuevo/backend && npm install`
- **`.env`** en el servidor (NO se sube): `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` (crm_pro), `DB_SCHEMA=ventaspro_nuevo`, `PORT=4000`, `TANGO_API_BASE_URL`, `TANGO_API_KEY`.
- **⚠️ `DEV_LOGIN` NO debe estar en `1` en prod** (es un acceso admin sin contraseña, solo para local).
- Levantar con **PM2**: `pm2 start src/server.js --name ventaspro-nuevo` (puerto 4000).
- Puerto: hoy crmp=3001, ofertas=3005. **4000 libre** — si se expone por dominio, agregar **route en nginx** a `:4000`.

## 3) Frontend

- Ya se sirve desde el backend: `http://<server>:4000/` (o el dominio que se le ponga por nginx).
- El frontend usa **rutas relativas** (mismo origen), así que no hay host hardcodeado. ✅

## 4) Verificación

- `GET /api/health` → `{ok:true}`.
- Abrir `/#/clientes` → trae clientes reales. `/#/comisiones`, `/#/asana`, `/#/metas`.

## ⛔ PENDIENTE antes de prod REAL (con login de verdad)

- **Falta pantalla de LOGIN.** Hoy el frontend entra con **dev-login** (admin automático). En prod, con `DEV_LOGIN` apagado, **no hay forma de loguearse** desde la UI → hay que construir la **pantalla de login con Tango** (el backend ya tiene `POST /api/auth/login`). **Sin esto, en prod no se puede usar con auth real.**
- Decidir el **dominio/nginx** para `:4000`.
- Cargar en prod los **pasos** y revisar permisos por rol (vendedor ve solo lo suyo).

## Resumen

- **GitHub:** listo para pushear (rama con los commits de `sistema-nuevo`).
- **Deploy a prod:** code-ready, pero **antes del uso real falta el login** (hoy es dev-login). Para una demo interna se puede deployar con dev-login; para producción real, primero el login.
