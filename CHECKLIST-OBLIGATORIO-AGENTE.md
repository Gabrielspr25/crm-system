# CHECKLIST OBLIGATORIO - VERIFICAR ANTES DE CADA CAMBIO

## REGLA #1: ENDPOINTS LEGACY vs MODULARES
**SIEMPRE verificar si hay endpoints legacy DUPLICADOS que sobrescriben rutas modulares**

### Rutas Modulares Montadas (server-FINAL.js líneas 72-77):
```javascript
app.use('/api/referidos', referidosRoutes);
app.use('/api/tariffs', tarifasRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/vendors', vendorRoutes);
```

### Comando Verificación:
```bash
grep -n 'app\.(get|post|put|delete).*\/api\/(clients|bans|referidos|vendors|importador)' server-FINAL.js
```

### Endpoints Legacy Comentados (v2026-118):
1. **GET /api/vendors** (línea 542) → Usa vendorRoutes
2. **POST /api/clients/merge** (línea 1771) → Usa clientRoutes
3. **POST /api/importador/save** (línea 2165) → Usa importRoutes

---

## REGLA #2: VERIFICAR FUNCIONALIDAD DESPUÉS DE CAMBIOS

### Cuando modificas importController.js:
1. ✅ Verificar que NO rompe importador normal (sin vendor)
2. ✅ Verificar que NO rompe importador con salesperson_id directo (UUID)
3. ✅ Verificar que NO rompe clientes existentes
4. ✅ Verificar que mapeo vendors→salespeople funciona

### Cuando modificas vendorController.js:
1. ✅ Verificar que módulos legacy (follow_up_prospects, sales_reports, goals) siguen funcionando
2. ✅ Verificar que GET /api/vendors devuelve datos
3. ✅ Verificar que POST /api/vendors crea vendor
4. ✅ Verificar que PUT /api/vendors actualiza vendor

### Cuando modificas clientController.js:
1. ✅ Verificar que stats (following_count, completed_count) son correctos
2. ✅ Verificar que GET /api/clients devuelve clientes
3. ✅ Verificar que POST /api/clients/merge funciona
4. ✅ Verificar que filtros (tab=active, tab=following, etc.) funcionan

---

## REGLA #3: DESPLEGAR EN ORDEN CORRECTO

### Orden de Deployment:
1. **Base de datos** (si aplica): ejecutar SQL primero
2. **Backend** (controller + routes): `scp` archivos + `pm2 restart crmp-api`
3. **Frontend** (si aplica): `npm run build` + `scp dist/client/*`
4. **Verificar**: `curl http://localhost:3001/api/version`

### Archivos Críticos:
- `server-FINAL.js` → Main server
- `src/backend/controllers/*.js` → Lógica de negocio
- `src/backend/routes/*.js` → Rutas modulares
- `src/version.ts` → Versión del sistema

---

## REGLA #4: VALIDAR ANTES DE DECIR "LISTO"

### Checklist Post-Deploy:
- [ ] PM2 restart exitoso (sin errores en logs)
- [ ] GET /api/version devuelve versión correcta
- [ ] Endpoint modificado responde (probar con curl o Postman)
- [ ] Frontend puede llamar al endpoint (verificar en consola del navegador)
- [ ] Datos en BD son correctos (ejecutar SELECT de verificación)

### Logs a Revisar:
```bash
ssh root@143.244.191.139 "pm2 logs crmp-api --lines 50 --nostream"
```

---

## REGLA #5: DOCUMENTAR CAMBIOS CRÍTICOS

### Crear archivo de error cuando:
1. Sistema tiene arquitectura dual (vendors/salespeople)
2. Endpoints legacy sobrescriben rutas modulares
3. Cambio afecta múltiples módulos
4. Migración de schema (INTEGER → UUID)

### Formato de Documentación:
```
ERROR-[NOMBRE-DESCRIPTIVO].md
PASO-A-PASO-[PROCESO].md
```

---

## ERRORES DETECTADOS Y CORREGIDOS

### v2026-118: Endpoints Legacy Duplicados
**Fecha:** 2026-01-11 19:30

**Problema:**
- GET /api/vendors (línea 542) sobrescribía vendorRoutes
- POST /api/clients/merge (línea 1771) sobrescribía clientRoutes
- POST /api/importador/save (línea 2165) sobrescribía importRoutes

**Causa:**
- Endpoints legacy no comentados después de crear rutas modulares
- Express usa PRIMER match, entonces legacy bloqueaba rutas modulares

**Solución:**
- Comentados TODOS los endpoints legacy duplicados
- Verificado que rutas modulares funcionan
- PM2 restart #192 exitoso

**Archivos Modificados:**
- server-FINAL.js (líneas 542, 1771, 2165)

**Lección Aprendida:**
- SIEMPRE buscar endpoints legacy con grep antes de desplegar
- NUNCA asumir que rutas modulares funcionan sin verificar

---

## PROCESO OBLIGATORIO ANTES DE CADA CAMBIO

1. **Leer este archivo COMPLETO**
2. **Ejecutar comando de verificación de endpoints**
3. **Revisar si hay legacy duplicados**
4. **Comentar legacy ANTES de desplegar**
5. **Verificar funcionalidad DESPUÉS de desplegar**
6. **Documentar si hay cambio crítico**

---

## CONTACTOS DE EMERGENCIA

**Si algo falla:**
1. Revisar logs: `pm2 logs crmp-api --lines 100 --nostream`
2. Verificar PM2: `pm2 status`
3. Reiniciar: `pm2 restart crmp-api`
4. Rollback: Restaurar backup de server-FINAL.js

**Backups:**
- server-FINAL.js: Git history
- Base de datos: PostgreSQL automatic backups
- Frontend: dist/ folder guardado localmente
