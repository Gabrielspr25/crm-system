# VentasPro CRM - Documentación para Análisis

**Fecha:** 15 de enero de 2026  
**Versión:** 2026-144  
**Proyecto:** CRM para gestión de clientes, ventas y pipeline de seguimiento

---

## 📁 Estructura de la Documentación

### 🔴 **1-PRIORIDAD-ALTA** (Crítico)

#### `auth/`
- **auth.ts** - Utilidad frontend: `authFetch()`, manejo de tokens JWT, auto-refresh
- **auth.js** - Middleware backend: `authenticateToken()`, verificación JWT
- **authController.js** - Controller: login, registro, refresh tokens
- **authRoutes.js** - Rutas de autenticación

**Sistema de autenticación:**
- JWT con access token (15min TTL) + refresh token (7 días TTL)
- Tokens en localStorage: `crm_token`, `crm_refresh_token`, `crm_user`
- Auto-refresh automático en 401

#### `modelo-datos/`
- **schema-final.sql** - Schema completo de PostgreSQL (SSOT)
- **migrations/** - Migraciones numeradas (1/, 3/, 4/, etc.)

**Modelo de datos principal:**
```
salespeople → users_auth (JWT auth)
           ↓
        clients → bans → subscribers (jerarquía 3 niveles)
           ↓
  follow_up_prospects (pipeline tracking)
```

#### `roles/`
**Sistema de roles actual:**
- Tabla: `users_auth.role` (columna TEXT)
- Roles: 'admin', 'vendor', 'user'
- Verificación: En middleware `auth.js` y frontend por `localStorage.crm_user.role`
- **Problema conocido:** No hay tabla `roles` separada, roles hardcodeados

---

### 🟠 **2-PRIORIDAD-MEDIA** (Muy importante)

#### `controllers/`
Controllers principales del backend (Express):
- **clientController.js** - CRUD clientes, asignación a vendedores
- **banController.js** - Gestión de BANs (cuentas)
- **subscriberController.js** - Gestión de suscriptores (líneas/servicios)
- **importController.js** - Importación CSV/XLSX con auto-mapeo de columnas
- **productController.js** - Productos + gestión de tiers de comisiones

#### `routes/`
Rutas modulares (todas requieren auth excepto `/api/login`, `/api/health`):
- authRoutes, clientRoutes, banRoutes, subscriberRoutes
- importRoutes, productRoutes, tarifasRoutes, referidosRoutes

#### `modulo-problematico/`
**Módulo con más cambios recientes:**
- **Reports.tsx** - Cálculo de comisiones con lógica compleja:
  - `calculateCompanyEarnings()`: FIJO NEW 3.2%, FIJO REN 1.6%, CLOUD/MPLS/TV 100%, MÓVIL usa tiers
  - `calculateVendorDirectCommission()`: FIJO NEW 1.0%, FIJO REN 0.5%, otros 50% de company earnings
- **Products.tsx** - Gestión de productos + modal de tiers para MÓVIL
  - Problema conocido: Página no carga en producción (v2026-144)

---

### 🟡 **3-PRIORIDAD-BAJA** (Referencia)

#### `frontend/`
- **App.tsx** - Router principal con React Router v7, rutas protegidas

#### `config/`
- **db.js** - Pool de conexiones PostgreSQL
- **server-FINAL.js** - Entry point del backend (Express, 2132 líneas)
- **package.json** - Dependencias y scripts

**Variables de entorno requeridas:**
```bash
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
JWT_SECRET, JWT_REFRESH_SECRET
VITE_API_BASE_URL
```

---

## 🚨 Problemas Conocidos

1. **Roles hardcodeados** - No hay tabla `roles`, valores en TEXT
2. **Products.tsx no carga** - Error de autenticación en v2026-144
3. **BAN validation** - Requiere al menos 1 subscriber (enforcement en UI + backend)
4. **Cache frontend** - Vite usa timestamp-based filenames, puede requerir Ctrl+Shift+R
5. **Importador** - No se desplegó en último deployment (agent error)

---

## 🔧 Stack Técnico

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express (CommonJS/ES Modules mixto)
- **Database:** PostgreSQL 15+ (crm_pro database)
- **Auth:** JWT con refresh tokens
- **Deployment:** PM2 (crmp-api), nginx, servidor en 143.244.191.139

---

## 📚 Archivos Adicionales Relevantes

**No incluidos en este ZIP pero importantes:**
- `elementos_extra/sqls/` - Queries SQL de utilidad
- `src/react-app/pages/` - Todas las páginas del frontend
- `src/react-app/components/` - Componentes reutilizables
- `CHECKLIST-OBLIGATORIO-AGENTE.md` - Errores comunes y prevención
- `ARQUITECTURA_AGENTES_CLARO.md` - Sistema de tarifas con AI

---

**Notas:**
- Proyecto actualmente en revisión con profesor
- Versión 2026-144 tiene issues de autenticación pendientes
- Sistema maneja ofertas de Claro Puerto Rico (PYMES/Corporate/Consumer)
