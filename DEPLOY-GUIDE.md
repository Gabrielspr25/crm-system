# 🚀 GUÍA DE DEPLOY - CRM PRO

## 📊 ESTADO ACTUAL

✅ **Base de datos**: Limpia (sin datos de prueba)  
✅ **Configuración**: Configurada para crmp.ss-group.cloud  
✅ **DNS**: Configurado correctamente  
✅ **Build**: Generado y listo  

## 📦 ARCHIVO PARA SUBIR

**USAR ESTE ARCHIVO:**
- `crmp-deploy-20251014_1349.zip` (535 KB)

**CONTIENE:**
- ✅ Frontend compilado (React + TypeScript)
- ✅ Backend Node.js configurado
- ✅ Archivo .env de producción
- ✅ .htaccess para Apache
- ✅ package.json del servidor

## 🔧 HERRAMIENTAS INCLUIDAS

### 📊 **Sistema de Importación de Datos**
- **Ubicación**: `/import-data` (en la aplicación web)
- **Función**: Importa CSV masivo y genera estructura Cliente → BAN → Subscriber
- **Formatos**: CSV con mapeo automático
- **Genera**: 4 archivos separados listos para importar

### 📈 **Sistema de Exportación**
- **Ubicación**: Botón "Exportar" en páginas principales
- **Formatos**: PDF, Excel, CSV
- **Reportes**: Por vendedor, metas, análisis completo

## 🌐 CONFIGURACIÓN ACTUAL

```
Subdominio: crmp.ss-group.cloud
IP Server: 142.93.176.195
Base de datos: crm_pro
Usuario BD: crm_user
NODE_ENV: production
```

## 📋 PASOS PARA DEPLOY

### 1. SUBIR ARCHIVOS
- Descomprimir `crmp-deploy-20251014_1349.zip`
- Subir todo el contenido a la raíz de tu hosting

### 2. CONFIGURAR NODE.JS
```bash
npm install
npm start
```

### 3. CONFIGURAR SERVIDOR WEB
- Asegurar que nginx/Apache redirija a Node.js puerto 3001
- Configurar SSL para HTTPS

### 4. VERIFICAR
- Acceder: https://crmp.ss-group.cloud
- Login con usuarios existentes
- Probar importación de datos

## 👥 USUARIOS DISPONIBLES

- **admin** - Admin Principal
- **gabriel** - Gabriel Rodríguez (admin)  
- **maria** - María González (vendedor)
- **juan** - Juan Pérez (vendedor)

**⚠️ CAMBIAR CONTRASEÑAS** antes del primer uso.

## 📊 ESTRUCTURA DE DATOS

### Cliente → BAN → Subscriber
```
CLIENTE (Empresa)
├── BAN (Cuenta corporativa)
    ├── SUBSCRIBER (787-111-1111)
    ├── SUBSCRIBER (787-222-2222)
    └── SUBSCRIBER (787-333-3333)
```

### CSV para Importación
```csv
CLIENTE_nombre,BAN,SUSCRIBER,STATUS,PLAN,CREDIT_CLASS,venc_fijo,pagos_hechos,meses_vendidos,equipo,ITEM_LDESC,EMAIL,CONTACTO
```

## 🛠️ COMANDOS ÚTILES

```bash
# Generar nuevo build
npm run build:hostinger

# Iniciar servidor
npm start

# Ver logs
pm2 logs (si usas PM2)
```

## 📞 SOPORTE

Sistema completamente configurado y listo para producción.
Base de datos limpia, sin datos de prueba.
Herramientas de importación/exportación incluidas.