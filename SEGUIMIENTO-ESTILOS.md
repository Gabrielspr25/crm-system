# Briefing — Estilos Página de Seguimiento

## Archivo principal

```
src/react-app/pages/SeguimientoOperativo.tsx
```

Un solo archivo. Todo el JSX, lógica y estilos están ahí.

## Stack de estilos

- **Tailwind CSS** — clases utilitarias directamente en el JSX. No hay archivos `.css` separados para este componente.
- **Lucide React** — iconos (ya importados).
- El tema base es **oscuro** (`dark:` variants activas). El fondo global lo define `Layout.tsx` con un gradiente `from-slate-900 to-slate-800`.

## Cómo ver cambios en vivo

```bash
npm run dev
```

Abrir `http://localhost:5173/seguimiento` (o el puerto que indique la terminal).

> Si solo vas a cambiar estilos, no hace falta reiniciar — Tailwind/Vite recarga en caliente.

## Estructura visual de la página

```
┌─────────────────────────────────────────────┐
│  Header + filtros (búsqueda, vendedor, mes) │
├─────────────────────────────────────────────┤
│  Métricas cards (4 tarjetas de resumen)     │
├─────────────────────────────────────────────┤
│  Tabla principal — filas = oportunidades    │
│  columnas = productos (Fijo Ren, Fijo New,  │
│  Móvil Ren, Móvil New, Claro TV, Cloud,     │
│  MPLS)                                      │
├─────────────────────────────────────────────┤
│  Panel lateral / modales (steps, notas)     │
└─────────────────────────────────────────────┘
```

## Colores de acento por producto

Cada columna de producto tiene su propio color. Están definidos en el objeto `PRODUCT_ACCENTS` cerca de la línea 195:

| Producto   | Color base  |
|------------|-------------|
| fijo_ren   | cyan        |
| fijo_new   | blue        |
| movil_ren  | emerald     |
| movil_new  | violet      |
| claro_tv   | amber       |
| cloud      | pink        |
| mpls       | orange      |

Cada entrada tiene 4 variantes: `border`, `soft` (fondo suave), `text`, `ring` (focus). Si quieres cambiar el esquema de colores, edita ese objeto.

## Componentes / secciones clave a buscar

Busca estos comentarios o nombres de función en el archivo para orientarte:

- **Métricas cards** → busca `MetricCard` o `meta_money`
- **Tabla / cabecera de columnas** → busca `PRODUCT_ORDER`
- **Fila de oportunidad** → busca `Sov2Opportunity` o el bloque `map(opp =>`
- **Celda de producto** → busca `Sov2ProductCell`
- **Modal de steps** → busca `StepModalContext` o `stepModal`
- **Panel de notas** → busca `noteDrawer` o `NoteTab`
- **Botón nueva oportunidad** → busca `NewOpportunityDraft`

## Notas importantes

- **No eliminar clases funcionales** — muchas clases de Tailwind controlan visibilidad condicional (`hidden`, `flex`, `opacity-0`). Cambiar colores y espaciados es seguro; eliminar clases de display o posición puede romper la lógica.
- **Estados de celda** — las celdas cambian estilos según el paso activo del producto (`current_step`). Los estados son: sin datos, en progreso, completado, bloqueado. Revisar antes de tocar colores de borde de celda.
- **Responsive** — la tabla usa scroll horizontal en móvil. No fijar anchos de columna sin probar en pantalla pequeña.
- **Build para producción** → `npm run build` genera el dist en `dist/client/`. El diseñador no necesita hacer deploy — eso lo maneja el equipo de backend.

## Contacto sobre la lógica

Cualquier duda sobre qué hace un bloque de código o por qué un elemento se comporta de cierta forma, preguntar antes de modificar — la página tiene lógica de permisos por rol (`admin`, `supervisor`, `vendedor`) que afecta qué columnas y acciones se muestran.
