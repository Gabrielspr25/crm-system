, me ayudas a verlo ?
# Plan de Implementación - Refactorización del Backend y Seguridad

El objetivo es transformar el actual `server-FINAL.js` monolítico en una arquitectura modular y mantenible, además de asegurar la aplicación eliminando secretos "quemados" en el código.

## Revisión del Usuario Requerida
> [!IMPORTANT]
> **Copia de Seguridad Requerida**: Antes de proceder, asegúrate de tener una copia de seguridad de `server-FINAL.js`. Crearé nuevos archivos y eventualmente reemplazaré el punto de entrada.
> **Variables de Entorno**: Haremos obligatorio el uso de un archivo `.env`. La aplicación fallará al iniciar si faltan secretos requeridos, lo cual es una mejor práctica de seguridad.

## Cambios Propuestos

### Refactorización de la Arquitectura del Backend
Pasaremos de un solo archivo a una arquitectura por capas:
`src/backend/`
  ├── `config/` (Configuración y variables de entorno)
  ├── `database/` (Conexión a base de datos y helpers)
  ├── `routes/` (Definición de rutas API)
  ├── `controllers/` (Lógica de manejo de peticiones)
  ├── `middlewares/` (Autenticación, Manejo de errores)
  └── `app.js` (Punto de entrada de la App)

#### [NUEVO] Estructura de Directorios
- Crear `src/backend` y subdirectorios.

#### [NUEVO] Configuración y Base de Datos
- **`src/backend/config/env.js`**: Carga centralizada de variables de entorno con validación.
- **`src/backend/database/db.js`**: Configuración del pool de conexiones a la base de datos.

#### [NUEVO] Middleware
- **`src/backend/middlewares/auth.js`**: Middleware de autenticación JWT (extraído del servidor actual).
- **`src/backend/middlewares/errorHandler.js`**: Manejo de errores estandarizado.

#### [NUEVO] Rutas y Controladores
- **`src/backend/routes/authRoutes.js`** & **`src/backend/controllers/authController.js`**: Login, Refresh Token.
- **`src/backend/routes/userRoutes.js`** & **`src/backend/controllers/userController.js`**: Gestión de usuarios.
- **`src/backend/routes/productRoutes.js`** & **`src/backend/controllers/productController.js`**: Productos y Categorías.
- **`src/backend/routes/vendorRoutes.js`** & **`src/backend/controllers/vendorController.js`**: Vendedores.

#### [MODIFICAR] Punto de Entrada
- **`server-FINAL.js`**: Quedará obsoleto.
- **`package.json`**: Actualizar `scripts` para apuntar al nuevo punto de entrada (ej. `src/backend/app.js`).

## Plan de Verificación

### Pruebas Automatizadas
- Verificaremos que el servidor inicie correctamente con `npm run dev:backend`.
- Probaremos el endpoint `/api/health`.

### Verificación Manual
- **Flujo de Login**: Verificar que el inicio de sesión y la renovación de token sigan funcionando.
- **Acceso a Datos**: Verificar que se puedan listar y modificar productos y categorías.
