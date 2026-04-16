# VentasPro CRM

Proyecto CRM de ventas con frontend React/Vite y backend Node/Express.

## Estado actual
- Backend principal: `server-FINAL.js`
- Scripts operativos organizados en `scripts/`
- Scripts antiguos preservados en `scripts/legacy/` (sin borrar)

## Estructura clave
- `src/`: código de aplicación
- `server-FINAL.js`: API backend activa
- `scripts/diagnostico/`: consultas y verificaciones
- `scripts/migraciones/`: ajustes y migraciones de datos
- `scripts/tests-manuales/`: pruebas manuales
- `scripts/ops-deploy/`: despliegue y operaciones
- `scripts/legacy/`: scripts históricos en cuarentena

## Comandos oficiales
- `npm run dev`: frontend local
- `npm run dev:backend`: backend local
- `npm run build`: compilar frontend
- `npm run start`: iniciar backend
- `npm run ops:deploy`: despliegue por PowerShell
- `npm run ops:check-server`: verificación de servidor
- `npm run ops:verify-ssh`: validar conexión SSH
- `npm run ops:diagnostico`: diagnóstico operativo

## Regla de trabajo
Todo script nuevo debe vivir dentro de `scripts/` en su categoría. No crear scripts sueltos en raíz.

## Control operativo
- Historial: `HISTORIAL-FUNCIONAMIENTO.md`
