# 🚀 CRM Pro System

> **Estado**: ✅ Producción - Configurado para https://crmp.ss-group.cloud

## 📊 Descripción

Sistema CRM avanzado desarrollado en React + TypeScript + Node.js + PostgreSQL, específicamente diseñado para gestión de clientes, BANs y suscriptores de Claro PR.

## 🌐 Demo en Vivo
**URL**: https://crmp.ss-group.cloud

## 🏗️ Arquitectura

```
CLIENTE (Empresa)
├── BAN (Business Account Number)
    ├── SUBSCRIBER (787-111-1111)
    ├── SUBSCRIBER (787-222-2222)
    └── SUBSCRIBER (787-333-3333)
```

## 🔧 Tecnologías

### Frontend
- ⚛️ React 19 + TypeScript
- 🎨 Tailwind CSS
- 📊 Chart.js para gráficos
- 🔄 Socket.IO para tiempo real
- 📱 Responsive design

### Backend
- 🟢 Node.js + Express
- 🐘 PostgreSQL
- 🔐 JWT Authentication
- 🔒 bcrypt para passwords
- 📡 Socket.IO server

### DevOps
- ⚡ Vite para build
- 📦 npm para dependencias
- 🌐 Configurado para Hostinger
- 🔧 PM2 para producción

## 📦 Deploy Rápido

**Archivo listo para subir**: `crmp-deploy-20251014_1349.zip`

### Pasos:
1. Descomprimir el ZIP en tu servidor
2. `npm install`
3. `npm start`
4. Configurar proxy web a puerto 3001

Ver `DEPLOY-GUIDE.md` para instrucciones completas.

## 🔧 Herramientas Incluidas

### 📊 Sistema de Importación
- **Ubicación**: `/import-data`
- **Función**: Importa CSV masivo
- **Genera**: Estructura Cliente → BAN → Subscriber
- **Formatos**: CSV con mapeo inteligente

### 📈 Sistema de Exportación  
- **Formatos**: PDF, Excel, CSV
- **Reportes**: Vendedores, metas, análisis
- **Personalizable**: Filtros por fecha y vendedor

## 👥 Usuarios del Sistema

- **admin** - Administrador principal
- **gabriel** - Gabriel Rodríguez (admin)
- **maria** - María González (vendedor)  
- **juan** - Juan Pérez (vendedor)

## 🚀 Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/Gabrielspr25/crm-system.git

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollar (frontend + backend)
npm run dev

# Build para producción
npm run build:hostinger
```

## 📊 Base de Datos

### Tablas Principales:
- `clients` - Empresas clientes
- `bans` - Business Account Numbers
- `subscribers` - Líneas telefónicas individuales
- `salespeople` - Vendedores y admins
- `users_auth` - Sistema de autenticación
- `metas` - Sistema de metas y objetivos
- `incomes` / `expenses` - Sistema financiero
- `products` / `categories` - Catálogo de productos

### Estado Actual:
✅ **Base de datos limpia** - Sin datos de prueba
✅ **Estructura completa** - Todas las tablas configuradas  
✅ **Usuarios reales** - Listos para cambiar contraseñas

## 🔐 Seguridad

- 🔐 JWT Authentication
- 🔒 Contraseñas hasheadas con bcrypt
- 🚫 CORS configurado para dominio específico
- ✅ Variables de entorno para credenciales
- 🛡️ Validación de inputs

## 📞 Funcionalidades

### 👥 Gestión de Clientes
- ✅ CRUD completo de empresas
- ✅ Asignación de vendedores
- ✅ Seguimiento de pipeline
- ✅ Sistema de notas

### 📱 Gestión de Suscriptores
- ✅ Administración de líneas telefónicas
- ✅ Seguimiento de vencimientos
- ✅ Alertas automáticas
- ✅ Gestión de equipos

### 📊 Sistema de Metas
- ✅ Metas individuales por vendedor
- ✅ Seguimiento de progreso
- ✅ Reportes de cumplimiento
- ✅ Dashboard motivacional

### 💰 Sistema Financiero
- ✅ Registro de ingresos
- ✅ Control de gastos
- ✅ Reportes financieros
- ✅ Exportación de datos

## 📱 Características Especiales

- 🚨 **Alertas de Vencimiento** - Sistema inteligente de notificaciones
- 📊 **Dashboard Analytics** - KPIs y métricas en tiempo real
- 🎯 **Sistema de Gamificación** - Motivación para vendedores
- 📱 **Diseño Responsive** - Optimizado para móviles
- 🌙 **Modo Oscuro** - Tema personalizable
- 🔄 **Tiempo Real** - Updates instantáneos con Socket.IO

## 🌐 Configuración de Producción

```env
DB_HOST=142.93.176.195
DB_DATABASE=crm_pro
DB_USER=crm_user
NODE_ENV=production
APP_URL=https://crmp.ss-group.cloud
```

## 📄 Licencia

© 2025 Gabriel Rodríguez - Sistema CRM Profesional

---

**🚀 Sistema funcionando en producción**: https://crmp.ss-group.cloud