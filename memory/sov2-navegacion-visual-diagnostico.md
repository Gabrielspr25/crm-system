# Diagnostico SOV2 navegacion y visual

Fecha: 2026-06-03

## Decision

Mi Dia queda legacy/no principal; SOV2/Seguimiento es flujo operativo oficial.

Separar los cambios de navegacion y estilos SOV2 del paquete Tests/QA y de cualquier cambio backend.

## Archivos involucrados

- `src/react-app/App.tsx`
- `src/react-app/components/Layout.tsx`
- `src/react-app/index.css`

## Motivo

Estos archivos no son infraestructura neutral:

- `App.tsx` cambia rutas reales:
  - redirige `/mi-dia` a `/clientes`
  - cambia `/seguimiento` para usar `SeguimientoOperativo`
  - retira imports/rutas de `MyDay` y `MyDayV2`
- `Layout.tsx` cambia navegacion visible:
  - retira `Mi dia`
  - agrega `Seguimiento` apuntando a `/seguimiento`
  - cambia iconos y estilo global claro/oscuro del layout
- `index.css` agrega estilos globales:
  - clases `sov2-*` para Seguimiento Operativo V2
  - se retiran clases `vp-*` de Metas/Director/Gestion para no mezclar visuales descartados

## Regla fijada

No mezclar navegacion, CSS, dependencias y backend `app.js` en un mismo paquete.

## Recomendacion futura

Crear un paquete separado:

1. Mantener Mi Dia fuera del flujo principal.
2. Mantener `/seguimiento` apuntando a SOV2.
3. Conservar estilos `sov2-*` sin reintroducir estilos `vp-*`.
4. Ejecutar `npm run build` y una validacion visual antes de commitear.
