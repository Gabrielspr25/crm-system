# Documentación Técnica: App de Referidos y Clientes

## Stack Tecnológico
- **Frontend:** React + Vite
- **Estilos:** Tailwind CSS (con soporte Dark Mode nativo)
- **Iconos:** Lucide React

## Estructura del Proyecto
El proyecto es una SPA (Single Page Application) que actualmente maneja el estado de forma local.

## Instrucciones para Despliegue en Digital Ocean

### 1. Base de Datos (PostgreSQL)
Ejecutar el script `schema.sql` adjunto en la base de datos de producción. Esto creará la tabla `referidos` con los índices necesarios para las búsquedas.

### 2. Integración (Backend)
Actualmente el frontend usa un array `initialData` en `src/App.jsx`. Para conectarlo a PostgreSQL:
1.  Crear endpoints API (Node/Express/Python/etc):
    - `GET /api/referidos`: Retorna los registros.
    - `POST /api/referidos`: Inserta nuevos registros.
    - `PUT /api/referidos/:id`: Actualiza estado/notas.
2.  En `App.jsx`, reemplazar el estado inicial con un `useEffect` que haga fetch a estos endpoints.

### 3. Build para Producción
Para generar los archivos estáticos optimizados:
```bash
npm install
npm run build
```
Esto generará una carpeta `/dist`. El contenido de esta carpeta es lo que debe ser servido por Nginx/Apache.

## Notas Adicionales
- La app incluye un modo oscuro automático basado en clases (`class="dark"` en `<html>`).
- El formulario valida campos básicos (HTML5 validation).
- Se ha incluido una lógica de "Segmento" (Masivo/Negocio) visualmente distintiva.
