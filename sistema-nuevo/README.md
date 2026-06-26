# Sistema nuevo VentasPro

Sistema nuevo limpio, construido de cero. Estado: **base + backend + app core
funcionando y probados en local.** Falta el resto de pantallas y el deploy.

## Estructura
- `db/migrations/` — las 5 migraciones (14 tablas) de la base de datos.
- `backend/` — API en Node/Express. Conecta a Tango (login + ventas) y a Postgres.
- `frontend/` — la app web (por ahora HTML+JS; `app.html` es la app navegable).

## Cómo prenderlo (local, para probar)

### 1. Base de datos
- Prender el servicio PostgreSQL (como admin):
  `Start-Service postgresql-x64-15`
- Las tablas viven en el **schema aislado `ventaspro_nuevo`** dentro de `crm_pro`
  (NO toca las tablas actuales). Para recrearlo desde cero, aplicar las migraciones
  de `db/migrations/` en orden, con `SET search_path TO ventaspro_nuevo, public;`.

### 2. Backend
```
cd backend
npm install
npm start        # arranca en http://localhost:4000
```
Configuración en `backend/.env` (NO commitear): credenciales de Postgres,
`DB_SCHEMA=ventaspro_nuevo`, y la API key de Tango.

### 3. Frontend
- Abrir `frontend/app.html` en un navegador (Chrome/Edge). Se conecta solo al
  backend del puerto 4000.

## ⚠️ Notas importantes
- `DEV_LOGIN=1` en el `.env` activa un **acceso de prueba sin Tango** (solo para
  probar local). **En producción va APAGADO** y se usa el login real con Tango
  (`/api/auth/login`).
- El **deploy a producción** (Fase 4) NO está hecho: se hace con backup, montando
  el nuevo al lado del actual, probando, y recién después reemplazando.

## Pantallas conectadas (frontend `app.html`)
- ✅ Clientes (lista) · Ficha del cliente (datos + BANs + líneas + enviar a
  seguimiento)
- ✅ Asana (seguimiento del día) · Detalle de seguimiento (caminito de pasos +
  bitácora: registrar llamada/nota, avanzar paso, cerrar al pool)
- ✅ Comisiones (ventas + ganancia) · Metas (cumplimiento + barras por producto)

## Pendiente (mismo patrón, sumar pantallas)
- BAN/Suscriptores con OCR · Comparativa + PDF · Asana pasos (config) · Panel
  General completo · Pendientes Tango · Correos · Campañas · Categorías · Import
  New · Historial · Perfil · Permisos · Ofertas Web.

Ver `docs/reglas-negocio.md` (reglas) y `docs/plan-construccion.md` (plan).
