# 🏢 CRM System

Sistema de gestión de relaciones con clientes (CRM) completo y escalable construido con tecnologías modernas.

## ✨ Características Principales

### 🔐 Sistema de Autenticación y Permisos
- Autenticación con JWT
- Roles de usuario (Admin, Manager, Sales, Support, User)
- Permisos granulares por área y acción
- Control de acceso personalizado por usuario

### 📊 Módulos del CRM
- **Contactos**: Gestión completa de contactos con información detallada
- **Leads**: Seguimiento de prospectos y oportunidades potenciales
- **Oportunidades**: Gestión del pipeline de ventas con probabilidades
- **Actividades**: Tareas, llamadas, reuniones y seguimientos
- **Productos**: Catálogo de productos y servicios

### 🛠️ Características Avanzadas
- **Campos Dinámicos**: Los usuarios pueden crear campos personalizados en tiempo real
- **Exportación**: Exportar datos a CSV y XLSX con filtros aplicados
- **Búsqueda y Filtros**: Búsqueda avanzada en todos los módulos
- **Paginación**: Manejo eficiente de grandes volúmenes de datos
- **Auditoría**: Registro de todas las acciones del sistema

## 🚀 Tecnologías Utilizadas

### Frontend
- **Next.js 15** - Framework React con SSR/SSG
- **TypeScript** - Tipado estático para mayor robustez
- **Tailwind CSS** - Framework CSS utilitario
- **Modo Oscuro** - Interfaz optimizada con `bg-gray-800` y placeholders grises

### Backend
- **Next.js API Routes** - API REST integrada
- **Prisma ORM** - ORM moderno con tipado automático
- **PostgreSQL** - Base de datos robusta y escalable
- **JWT** - Autenticación stateless
- **Bcrypt** - Hash seguro de contraseñas

### DevOps & Deploy
- **Docker** - Contenedorización para despliegue
- **DigitalOcean** - Hosting en servidor propio
- **Nginx** - Reverse proxy (opcional)

## 🛠️ Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- PostgreSQL 15+
- Docker (para despliegue)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Configura las variables en `.env`:
```env
DATABASE_URL="postgresql://postgres:Gaby0824@a@138.197.66.85:5432/bs_postgres"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
JWT_SECRET="your-jwt-secret-here-change-in-production"
```

### 3. Configurar base de datos
```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones (cuando la BD esté disponible)
npm run db:migrate

# Poblar con datos iniciales
npm run db:seed
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 👥 Usuarios por Defecto

Después del seeding, tendrás estos usuarios disponibles:

| Email | Contraseña | Rol | Permisos |
|-------|------------|-----|----------|
| admin@crm.com | admin123 | ADMIN | Todos los permisos |
| ventas@crm.com | sales123 | SALES | Permisos básicos de ventas |

## 🚀 Despliegue en DigitalOcean

### Script Automático
```bash
# Hacer ejecutable el script
chmod +x deploy.sh

# Ejecutar despliegue
./deploy.sh
```

### Manual con Docker
```bash
# Construir imagen
docker build -t crm-system .

# Ejecutar en producción
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Credenciales de Acceso

**Servidor:** 138.197.66.85  
**Usuario:** root  
**Contraseña:** CL@70049ro  
**Base de datos:** bs postgres con usuario postgres y contraseña Gaby0824@a

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run dev                 # Ejecutar en desarrollo
npm run build              # Construir para producción
npm run start              # Ejecutar en producción

# Base de datos
npm run db:generate        # Generar cliente Prisma
npm run db:migrate         # Ejecutar migraciones en dev
npm run db:deploy          # Ejecutar migraciones en prod
npm run db:seed            # Poblar datos iniciales
npm run db:reset           # Resetear base de datos
npm run db:studio          # Abrir Prisma Studio

# Docker
docker-compose up -d       # Ejecutar con Docker
docker-compose down        # Detener servicios
docker-compose logs -f     # Ver logs en tiempo real
```

## 📋 Estado del Proyecto

### ✅ Completado
- [x] Estructura base del proyecto Next.js + TypeScript
- [x] Base de datos PostgreSQL con Prisma ORM
- [x] Modelos completos (Users, Contacts, Leads, Opportunities, Activities, Products)
- [x] Sistema de autenticación JWT con roles y permisos
- [x] APIs REST completas para todos los módulos
- [x] Sistema de campos dinámicos/personalizados
- [x] UI con React + Tailwind CSS (modo oscuro)
- [x] Sistema de exportación CSV/XLSX
- [x] Configuración Docker y despliegue
- [x] Scripts de seeding con datos iniciales

### 🚧 Próximas Características
- [ ] Páginas completas del frontend para cada módulo
- [ ] Dashboard con gráficos y métricas
- [ ] Integración con WhatsApp/Email
- [ ] Notificaciones en tiempo real
- [ ] Reportes avanzados

---

**Versión:** 1.0.0  
**Última actualización:** Septiembre 2025
