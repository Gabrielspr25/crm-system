# Sistema nuevo — Estado, decisiones y pendientes

Actualizado: 2026-06-27.

## Decisión raíz (Gabriel)

- El **diseño del sistema viejo estaba bien** → se **copia tal cual** (estructura, tarjetas, columnas).
- El problema del viejo era el **código sucio** → eso es lo que NO se repite. **No tolerar ensuciar.**
- El app nuevo lee la **base REAL `crm_pro` schema `public`**, NO la demo (`ventaspro_nuevo`).
  Excepción: catálogo/config (productos, categorías, pasos, metas) vive en `ventaspro_nuevo`
  (es config del sistema nuevo, no data falsa de clientes).
- **Prohibido emparchar** y **commitear el avance seguido** (solo archivos del sistema nuevo;
  nunca `server-FINAL.js` ni `src/react-app/**`, que son del programador).

## Estado por módulo

| Módulo | Estado | Fuente real |
|---|---|---|
| **Clientes** (lista + tarjetas KPI + filtros + paginación) | ✅ REAL | `public.clients/bans/subscribers` (`clientsReal.js`) |
| **Modal de cliente** (datos + BAN y suscriptores) | 🟡 parcial (falta versión 7 tabs) | `GET /api/clients-real/:id` |
| **Comisiones** (tabla por empresa + líneas, filtros mes/estado) | ✅ REAL | `public.subscriber_reports` |
| **Asana Seg.** (lista columnas por producto + detalle + cerrar al pool) | ✅ REAL | `sales_opportunities`+`opportunity_lines`+`opportunity_steps` |
| **Asana · caminito de pasos** | ✅ usa pasos CONFIGURADOS | `ventaspro_nuevo.product_step_templates` |
| **Cliente Voz** (dictado + parser → crea oportunidad) | ✅ HECHO | `POST /api/asana-real/voz` |
| **Configurar pasos** (editor por producto) | ✅ HECHO | `ventaspro_nuevo.product_step_templates` |
| **Configuración** (productos/categorías editables + pasos) | ✅ HECHO | `ventaspro_nuevo` |
| **Metas** (negocio + por vendedor, por producto, con alcance) | ✅ HECHO | `ventaspro_nuevo.goals` + vendedores de Tango |
| **Panel General** | ⬜ DEMO — pasar a real | — |
| **Pendientes Tango / Historial / Comparativa** | ⬜ DEMO — pasar a real | — |

## Decisiones / reglas confirmadas (recientes)

- **Comisión del vendedor = MANUAL.** Tango trae **Empresa$ (Comisión Claro)**, NO la del
  vendedor. El campo arranca en **0** y es **editable** por línea. (Datos locales puestos en 0.)
- **Vendedores vienen de Tango** (regla). La grilla de Metas por vendedor lista los del
  campo vendedor de las comisiones (`GET /api/comisiones`/`/api/vendedores`). Hoy: Dayana,
  Hernán, Gabriel Rodríguez.
- **Caminito de Asana = pasos CONFIGURADOS** (los de "Configurar pasos"), NO los genéricos
  viejos de `crm_workflow_templates`. El detalle borra solo los pasos que no estén en la
  config y siembra los configurados (preserva avance).
- **Pasos copiados de crmproui** (no conectados, copiados a la tabla propia):
  Fijo Ren (5), Fijo New (8), Movil Ren (8), Movil New (9). Claro TV / Cloud / MPLS: **en blanco**.
- **Cliente Voz**: en Asana. Dictado (Chrome) → parser sin IA llena empresa/teléfono/
  producto/cantidad/$ → crea **cliente provisional + oportunidad + línea + nota**.
- **Metas**: alcance por fila (Solo este mes / Hasta diciembre / Todo el año); upsert sin
  duplicar (fix para `salesperson NULL` del negocio).
- **Categorías**: solo lectura, dentro de Configuración (fuera del menú).

## PENDIENTE PRINCIPAL — Modal de cliente completo (7 tabs)

Replicar la **ClientModal real** de crmproui (ej. FARMACIA VARGAS) con estilo de marca:

- Tabs: **Información del Cliente · BANs y Suscriptores · Historial de Gestiones ·
  Comparativas · Ventas · Pendientes · Notas**.
- En **BANs y Suscriptores**: tarjeta por BAN (FIJO/MÓVIL, Activo) con **Subir/Pegar (OCR)**,
  **Editar**, sub-tabs **Activas / No renueva ahora / Canceladas**, filas de suscriptor con
  teléfono, plan, $/mes, vencimiento y acciones **Editar / No renueva ahora / Cancelar**,
  **+ Nuevo BAN** y **+ Agregar Suscriptor**.
- Header con **Enviar a Seguimiento**.
- *Gabriel define el detalle final de los tabs (pendiente que lo pase).*

## Otros pendientes

- **Filtros de Clientes**: Tipo, Vencimiento, Orden, Año, Estado (hoy visuales/placeholder).
- **Panel General / Pendientes Tango / Historial / Comparativa** → pasar a data real.
- **Bitácora de Asana** (llamadas/notas): conectar a su tabla real (`opportunity_notes`).
- **Limpieza**: sacar la data demo de `ventaspro_nuevo` (clientes/oportunidades falsos) una
  vez que todo lee de `public`.

## Aprendizajes técnicos (no repetir)

- **No usar `SET search_path` directo** en una conexión del pool y soltarla: queda
  contaminada y rompe otras pantallas. Usar `BEGIN` + `SET LOCAL search_path TO public` +
  `COMMIT` (se revierte solo). Aplicado en `clientsReal.js` y `asanaReal.js`.
- **Base local = copia PARCIAL**: `account_type`, `line_kind`, `product_key`, `plan`,
  `category_id` casi todos NULL local. Las clasificaciones (móvil/fijo, columnas de producto)
  se ven incompletas local; en **producción** ese dato está lleno y clasifica bien.

## Skill de diseño

- `.claude/skills/ventaspro-diseno/SKILL.md`: paleta dark-first + componentes
  (.kpi/.btn/.pill/.card/.inp/.modal) + regla "reusar clases, nunca inline; traer la
  funcionalidad completa del viejo, nunca a mitad". Leer antes de tocar el frontend.
