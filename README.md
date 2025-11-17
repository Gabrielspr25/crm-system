# VentasPro CRM

Aplicación CRM para equipos de ventas que combina gestión de clientes, seguimiento comercial, metas y un importador CSV/XLSX. El stack principal es **React + Vite** en el frontend y **Node/Express + PostgreSQL** en el backend.

## Estructura general

- `src/react-app/` → frontend React (Vite, TypeScript, Tailwind)
- `server-FINAL.js` → API Express (CommonJS)
- `schema-final.sql` → esquema PostgreSQL (uuid + relaciones cliente → ban → suscriptor)
- `deploy.ps1` → script PowerShell que compila, sube y reinicia el servidor (PM2)

## Requisitos

- Node.js 18+
- PostgreSQL 15+ con la base `crm_pro`
- PM2 (en el servidor de producción)
- PowerShell 7 si ejecutas los scripts desde Windows

## Configuración inicial

1. **Clonar/reinstalar dependencias**
   ```bash
   npm install
   ```

2. **Variables de entorno**
   - Copia `.env.example` → `.env`
   - Ajusta credenciales de base de datos (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
   - Ajusta `VITE_API_BASE_URL` si el frontend habla con un dominio distinto

3. **Migraciones**
   - Usa `schema-final.sql` para levantar la BD nueva
     ```bash
     psql -U crm_user -d crm_pro -f schema-final.sql
     ```

4. **Semillas** (incluidas en el SQL) → vendedores, usuarios auth, categorías, productos, pipeline, cliente demo

## Scripts principales

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Levanta Vite (frontend) en modo desarrollo |
| `npm run dev:backend` | Ejecuta `server-FINAL.js` en local |
| `npm run build` | Compila TypeScript + bundle Vite |
| `deploy.ps1` | Build, subida (pscp), reinstala deps, reinicia PM2 |

## Backend rápido (`server-FINAL.js`)

- Autenticación JWT (login + refresh token)
- Gestión de vendedores, clientes, BANs, suscriptores, prospectos, prioridades, pasos, call-logs
- Importador CSV/XLSX (`/api/import/*`)
- Socket.IO removido → todo es HTTP
- Helper genérico `authFetch` en frontend maneja refresh automático

## Módulos frontend principales

| Ruta | Descripción |
|------|-------------|
| `/` | Clientes agrupados (Disponible, Seguimiento, Completados), envío a seguimiento, BANs y suscriptores |
| `/seguimiento` | Tablero de prospectos + gestión de llamadas, prioridades y pasos “tipo Asana” |
| `/metas` | Metas generales y de producto |
| `/categorias`, `/productos`, `/vendedores` | CRUD básicos |
| `/importar` | Importador drag & drop (mapeo manual, alias, validaciones) |

## Flujos clave

### Clientes → Seguimiento

1. Cliente debe tener vendedor asignado y BAN + suscriptores creados
2. Botón "A Seguimiento" crea prospecto `follow_up_prospects`
3. “Devolver” marca prospecto como inactivo y regresa al pool
4. Modal de prospecto permite marcar "Completado" (se registra `completed_date`)

### BANs y suscriptores

- BAN no puede quedarse sin suscriptores (validado en modal + backend)
- Suscriptores muestran badges de vencimiento:
  - `Vencido +30 días` (sin fecha)
  - `Vencido hace X días`
  - `Vence en X días` (15/30 días)

### Importador inteligente

- Analiza CSV/XLSX y autodetecta columnas (alias)
- Drag & drop sin selectores; dos campos clave:
  - `Cliente · Nombre` (obligatorio)
  - `BAN · Número` (si no hay nombre)
- `server-FINAL.js` elige `ON CONFLICT` automático (`ban_number`, `phone`, `name`)
- Compatible con tablas `clients`, `bans`, `subscribers`, `products`

## Despliegue (PowerShell)

```powershell
./deploy.ps1
```
Pasos automatizados:
1. `npm run build`
2. `pscp` → `/opt/crmp` (backend) y `/var/www/crmp` (frontend)
3. `npm install --production` en servidor
4. Reinicio PM2 (`pm2 stop/delete/start crmp-api`)
5. Reload Nginx

## Estado actual

- **Socket.IO** retirado; la UI usa fetch + hooks
- **Importador** y **Seguimiento** con mejoras 2025-11-11
- Lectura de badges de vencimiento sincronizada en todas las vistas (Clientes, Card, Modal)
- Scripts auxiliares en raíz (`SUBIR-AL-SERVIDOR.ps1`, etc.) se mantienen por referencia (no ejecutar en producción)

## Próximos pasos sugeridos

1. Documentar colecciones Postman / pruebas automáticas
2. Añadir tests e2e (Playwright) para envío a seguimiento y importaciones
3. Consolidar scripts PowerShell → uno solo con control de errores
4. Automatizar despliegues (GitHub Actions + rsync/SSH)

---
Cualquier aporte/bug report, abrir issue o ping directo a Gabriel. ¡Vamos! 🚀
