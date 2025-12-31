# 🔴 PROBLEMA: El Sistema No Actualiza Versiones Correctamente

## Resumen Ejecutivo
El sistema CRM tiene un problema de **caché del navegador** que impide que los usuarios vean las nuevas versiones después de un deploy. La versión actual en el servidor es **5.2.13-AGENTE**, pero los navegadores siguen mostrando **5.2.11-BANDA-ANCHA**.

---

## 📊 Estado Actual de los Datos (Base de Datos)
| Tabla | Registros |
|-------|-----------|
| Clientes | 3,289 |
| BANs | 3,487 |
| Suscriptores | 6,716 |
| Seguimientos | 19 |

**Los datos están seguros en la base de datos.** El problema es solo de visualización por caché.

---

## 🔧 Arquitectura del Sistema

```
[Usuario] → [Navegador con Caché] → [Nginx] → [PM2/Node.js] → [PostgreSQL]
                  ↑
            AQUÍ ESTÁ EL PROBLEMA
```

### Servidor de Producción
- **IP**: 143.244.191.139
- **Ruta del proyecto**: `/opt/crmp/`
- **Base de datos**: PostgreSQL (crm_pro)
- **Process Manager**: PM2 (proceso: crmp-api)

---

## 🐛 Causa del Problema

1. **Vite genera archivos con hash** (ej: `index-1767102283000-DM12JhAR.js`)
2. **Nginx no invalida caché** al subir nuevos archivos
3. **El navegador cachea** el `index.html` y no pide los nuevos assets
4. **Service Worker** (sw.js) puede estar cacheando también

---

## ✅ Soluciones Posibles

### Opción 1: Configurar Nginx (RECOMENDADO)
Agregar headers de no-caché para index.html en `/etc/nginx/sites-available/default`:

```nginx
location / {
    root /opt/crmp/dist/client;
    try_files $uri $uri/ /index.html;
    
    # NO cachear index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
```

### Opción 2: Forzar recarga en cada deploy
Crear script de deploy que:
1. Limpie caché de Nginx: `nginx -s reload`
2. Cambie nombre del archivo HTML
3. Agregue query string con timestamp

### Opción 3: Versión visible al usuario
Ya implementado: El sistema muestra la versión en la barra lateral (ej: v5.2.13-AGENTE)

---

## 📁 Archivos Relevantes para Revisión

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| `server-FINAL.js` | `/opt/crmp/` | Servidor Node.js principal |
| `package.json` | `/opt/crmp/` | Define la versión del sistema |
| `.env` | `/opt/crmp/` | Configuración de BD y JWT |
| `dist/client/` | `/opt/crmp/` | Frontend compilado |
| `nginx.conf` | `/etc/nginx/` | Configuración del proxy |

---

## 🚀 Comando de Deploy Actual

```powershell
# 1. Cambiar versión en package.json
# 2. Build
npm run build

# 3. Subir archivos
scp -r dist/client/* root@143.244.191.139:/opt/crmp/dist/client/
scp server-FINAL.js package.json root@143.244.191.139:/opt/crmp/

# 4. Reiniciar servidor
ssh root@143.244.191.139 "pm2 restart crmp-api"
```

---

## 🆘 Solución Temporal para Usuarios

Indicar a los usuarios que:
1. Presionen **Ctrl+Shift+Delete** → Borrar caché
2. Presionen **Ctrl+F5** → Recarga forzada
3. O abran en **ventana incógnito**

---

## 📞 Información de Acceso

- **SSH**: `ssh root@143.244.191.139`
- **PostgreSQL**: 
  - Host: localhost (desde el servidor)
  - DB: crm_pro
  - User: crm_user
  - Password: (ver archivo .env en servidor)

---

## Contacto Técnico
Este documento fue generado el 30 de Diciembre de 2025.
Versión del sistema: 5.2.13-AGENTE
