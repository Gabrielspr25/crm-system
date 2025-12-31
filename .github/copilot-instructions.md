# VentasPro CRM - AI Agent Instructions

## Project Overview

VentasPro is a **Spanish-language** CRM for sales teams with integrated customer management, follow-up tracking, goals, and CSV/XLSX import. Built with **React 19 + Vite** (frontend) and **Node/Express + PostgreSQL** (backend).

**Key business context:** System manages Claro Puerto Rico telecom offerings (PYMES/Corporate/Consumer) with AI-powered tariff extraction and offer generation.

## Architecture

### Core Data Model (PostgreSQL with UUIDs)
```
salespeople → users_auth (JWT auth)
           ↓
        clients → bans → subscribers (3-level hierarchy)
           ↓
  follow_up_prospects (tracking pipeline)
```

**Critical relationship:** BAN cannot exist without subscribers (enforced in UI + backend). Each subscriber tracks service expiration dates with badge warnings (Vencido +30, Vence en X días).

### Tech Stack
- **Frontend:** `src/react-app/` - React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** `server-FINAL.js` (2132 lines, Express CommonJS) + modular structure in `src/backend/`
- **Database:** PostgreSQL 15+ (`crm_pro` database, schema in `elementos_extra/sqls/schema-final.sql`)
- **Auth:** JWT with refresh tokens (`authFetch` utility handles auto-refresh)
- **Build:** Vite with aggressive cache-busting (`timestamp` in filenames)

### Project Structure
```
src/
├── backend/          # Modular Express API (controllers, routes, middlewares)
├── react-app/        # React frontend (pages, components, hooks, utils)
├── shared/           # Shared types/utilities
└── worker/           # Cloudflare Workers (if applicable)

Root scripts (many legacy):
- agent-*.js          # Automated deployment helpers
- check-*.js          # Database validation scripts
- DEPLOY*.ps1         # PowerShell deployment scripts
- server-FINAL.js     # Main API entry point
```

## Development Workflows

### Build & Run
```powershell
npm run dev              # Vite dev server (port 5173)
npm run dev:backend      # Express API (port 3001)
npm run build            # Production build → dist/client/
```

### Deployment (Production)
**Primary:** `.\DEPLOY.ps1` (PowerShell)
1. `npm run build`
2. `scp` files to server (root@143.244.191.139)
3. Backend: `/opt/crmp/` (PM2 process: `crmp-api`)
4. Frontend: `/var/www/crmp/` (nginx static files)
5. nginx config: `nginx-crmp-no-cache.conf` (aggressive no-cache headers)

**Alternative:** `.\SUBIR-AL-SERVIDOR.ps1` (uses PuTTY's pscp/plink)

**Critical:** Frontend MUST have cache-busting enabled. Check [vite.config.ts](vite.config.ts) for timestamp-based filenames.

### Database Migrations
- **Schema:** `elementos_extra/sqls/schema-final.sql` (authoritative source)
- **Migrations:** `migrations/` folder (numbered: 1/, 3/, 4/, etc.)
- **Apply:** `psql -U crm_user -d crm_pro -f schema-final.sql`
- **Remote:** Use `RUN-MIGRATIONS.ps1` to apply via SSH

## Critical Patterns

### Authentication Flow
1. Login → `/api/login` returns `accessToken` (15min TTL) + `refreshToken` (7d TTL)
2. All API calls use `authFetch()` from [src/react-app/utils/auth.ts](src/react-app/utils/auth.ts)
3. On 401 → auto-refresh with `/api/token/refresh` → retry original request
4. Tokens stored in localStorage: `crm_token`, `crm_refresh_token`, `crm_user`

**Never use raw fetch()** - always use `authFetch()` for authenticated endpoints.

### Import System (CSV/XLSX)
Located: [src/backend/controllers/importController.js](src/backend/controllers/importController.js)

**Smart features:**
- Auto-detects columns via aliases (e.g., "Cliente", "Nombre Cliente" → `name`)
- Drag & drop UI (no dropdowns) - two required fields:
  - `Cliente · Nombre` (mandatory)
  - `BAN · Número` (if no client name)
- Handles `ON CONFLICT` automatically (`ban_number`, `phone`, `name`)
- Supports: `clients`, `bans`, `subscribers`, `products`
- Transaction-based: All-or-nothing with rollback on error

### Client → Follow-Up Flow
1. Client must have: `salesperson_id` assigned + at least 1 BAN with subscribers
2. "A Seguimiento" button creates `follow_up_prospects` record (is_active=true)
3. "Devolver" button marks prospect inactive, returns to client pool
4. "Completado" button sets `completed_date`, keeps prospect in tracking

**Validation:** Frontend prevents actions if requirements not met.

### Tariff System (Claro PR Offers)
Located: `src/backend/routes/tarifasRoutes.js`, Architecture doc: [ARQUITECTURA_AGENTES_CLARO.md](ARQUITECTURA_AGENTES_CLARO.md)

**AI-powered extraction:**
- PDF boletins → structured JSON offers
- Categories: INTERNET_FIJO, PLANES_POSTPAGO, EQUIPOS, CONVERGENCIA, etc.
- Client types: PYMES, CORPORATIVO, PERSONAS
- Convergence logic: Cliente with FIJO + MÓVIL gets special benefits

**Tables:** `tariffs_categories`, `tariffs_plans`, `tariffs_offers_log`

## Code Conventions

### Backend (server-FINAL.js)
- **Module system:** ES Modules (`import`/`export`), but uses `createRequire()` for package.json
- **Database:** Pool connection from `pg`, use parameterized queries (`$1, $2`)
- **Error handling:** Custom helpers in `src/backend/middlewares/errorHandler.js`
- **Auth middleware:** JWT verification, checks PUBLIC_ROUTES Set
- **Routes:** Modular in `src/backend/routes/` (referidosRoutes, tarifasRoutes, clientRoutes, banRoutes)

### Frontend (React)
- **Routing:** react-router v7 (`useNavigate`, not older useHistory)
- **State:** useState/useEffect (no Redux)
- **API calls:** Custom `useApi()` hook + `authFetch()`
- **Icons:** lucide-react
- **Styling:** Tailwind utility classes, `clsx` + `tailwind-merge` for conditionals
- **Exports:** XLSX library for data export

### Naming
- **Spanish variable names** in business logic (e.g., `vendedor`, `suscriptor`, `prospectos`)
- **English for technical** (e.g., `authFetch`, `useApi`)
- **Files:** kebab-case for scripts, PascalCase for React components

## Common Tasks

### Adding a new API endpoint
1. Create controller in `src/backend/controllers/`
2. Create route in `src/backend/routes/`
3. Import route in `server-FINAL.js` and mount with `app.use()`
4. If public route, add to `PUBLIC_ROUTES` Set

### Adding a new page
1. Create in `src/react-app/pages/YourPage.tsx`
2. Add route in `src/react-app/App.tsx`
3. Use `authFetch()` for API calls
4. Follow existing modal patterns (see ClientModal, BANModal, SubscriberModal)

### Database changes
1. Update `elementos_extra/sqls/schema-final.sql` (authoritative)
2. Create migration in `migrations/N/up.sql` and `down.sql`
3. Test locally: `psql -U crm_user -d crm_pro -f migrations/N/up.sql`
4. Deploy: Update schema-final.sql on server, restart API

### Debugging deployment issues
1. Check version: `GET /api/version` (returns package.json version + timestamp)
2. Check health: `GET /api/health/full` (runs [src/backend/controllers/healthController.js](src/backend/controllers/healthController.js))
3. PM2 logs: `ssh root@143.244.191.139 "pm2 logs crmp-api"`
4. nginx logs: `/var/log/nginx/error.log`
5. Frontend cache: Verify timestamp hash in built filenames (`dist/client/assets/`)

## Environment Variables

Required in `.env` (never commit):
```bash
# Database
DB_HOST=localhost
DB_USER=crm_user
DB_PASSWORD=***
DB_NAME=crm_pro
DB_PORT=5432

# JWT
JWT_SECRET=***
JWT_REFRESH_SECRET=***
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend API URL
VITE_API_BASE_URL=http://localhost:3001  # or production domain
```

## Testing & Validation

**No formal test suite**, but extensive manual validation scripts:
- `check-*.js` files validate DB integrity
- `VERIFICAR-*.js` files check data consistency
- Use `DIAGNOSTICO-COMPLETO.ps1` for full system check

## Known Quirks

1. **Cache battles:** Frontend uses timestamp-based filenames + nginx no-cache headers. If changes don't appear, check [vite.config.ts](vite.config.ts) build config.

2. **Module mixing:** `server-FINAL.js` is ES Module but needs CommonJS for package.json (uses `createRequire()`).

3. **BAN validation:** Frontend prevents BAN deletion if last subscriber, but backend double-checks. Always trust backend validation.

4. **Spanish content:** Business logic and UI text are in Spanish. Database columns have English names.

5. **PowerShell deployment:** Scripts use Windows PowerShell 7. Linux users: adapt to bash or use Node.js deployment scripts (auto-deploy*.js).

6. **Many legacy files:** Root folder has 100+ utility scripts (agent-*.js, check-*.js, etc.). Most are one-off helpers - focus on core files listed above.

## AI Agent Best Practices

- **Read schema first:** Check [elementos_extra/sqls/schema-final.sql](elementos_extra/sqls/schema-final.sql) before modifying DB logic
- **Use authFetch:** Never raw fetch() for authenticated endpoints
- **Respect hierarchy:** clients → bans → subscribers (foreign keys enforce this)
- **Spanish context:** Business logic speaks Spanish, translate when necessary
- **Check deployments:** Run `.\DEPLOY.ps1` after changes, verify with `/api/version`
- **Migrations matter:** Update schema-final.sql AND create migration files
- **Test imports:** Use `/importar` page with sample CSV before modifying importController.js
