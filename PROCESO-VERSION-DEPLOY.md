# ⚠️ PROCESO OBLIGATORIO PARA CAMBIAR VERSIÓN

## PROBLEMA CRÍTICO DETECTADO

Hay **DOS archivos** que controlan la versión. Si no se actualizan AMBOS, el navegador muestra versión incorrecta.

## ARCHIVOS A ACTUALIZAR (SIEMPRE AMBOS)

### 1. package.json
```json
{
  "version": "2026-XX"
}
```

### 2. src/version.ts (CRÍTICO - SE OLVIDA SIEMPRE)
```typescript
export const APP_VERSION = '2026-XX';
export const BUILD_LABEL = "v2026-XX - Descripción del cambio";
```

## PROCESO CORRECTO

### Paso 1: Cambiar versión en AMBOS archivos
```bash
# Editar package.json línea 4
# Editar src/version.ts línea 1 y 2
```

### Paso 2: Build y Deploy
```powershell
.\DEPLOY.ps1
```

### Paso 3: Verificar en navegador
1. Abrir https://crmp.ss-group.cloud
2. F12 → Console
3. Debe mostrar: `VERSION ACTUAL: 2026-XX` (mismo número que package.json)
4. Si muestra versión vieja:
   - Ctrl+Shift+Delete → Clear data
   - Refresh

## ¿POR QUÉ FALLA SI NO ACTUALIZO src/version.ts?

- `package.json` → Controla el título HTML: `<title>VentasPro CRM - 2026-XX</title>`
- `src/version.ts` → Se compila en el JavaScript, aparece en consola del navegador
- El navegador puede tener HTML nuevo pero JavaScript viejo si no coinciden

## SÍNTOMAS DE VERSION INCORRECTA

❌ Consola muestra: `VERSION ACTUAL: 2026-37`
✅ package.json dice: `"version": "2026-51"`
🔴 **PROBLEMA**: Olvidaste actualizar `src/version.ts`

## CHECKLIST ANTES DE DEPLOY

- [ ] Actualicé `package.json` versión
- [ ] Actualicé `src/version.ts` APP_VERSION
- [ ] Actualicé `src/version.ts` BUILD_LABEL con descripción
- [ ] Ejecuté `.\DEPLOY.ps1`
- [ ] Verifiqué consola navegador muestra versión correcta

## HISTORIAL DE ERRORES

### 2026-01-05: Incompletos y Statistics Fix
- ❌ Error: package.json → 2026-51, src/version.ts → 2026-37
- 🔧 Solución: Actualizar src/version.ts y redesplegar
- ⏱️ Tiempo perdido: 1 hora depurando cache cuando el problema era versión compilada

## COMANDO DE VERIFICACIÓN POST-DEPLOY

```powershell
# Verificar versión en servidor
ssh root@143.244.191.139 "grep 'const CURRENT_VERSION' /opt/crmp/dist/client/index.html"

# Debe mostrar la versión de package.json
```

## NOTA PARA COPILOT

🤖 **GitHub Copilot**: Cuando el usuario pida cambiar versión o hacer deploy:
1. SIEMPRE pregunta: "¿Actualizo package.json Y src/version.ts?"
2. NUNCA omitas src/version.ts
3. Verifica ambos archivos antes de hacer npm run build
