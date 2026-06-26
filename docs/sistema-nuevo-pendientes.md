# Sistema nuevo — Pendientes y decisión de arquitectura

Actualizado: 2026-06-26.

## Decisión raíz (Gabriel, 2026-06-26)

- El **diseño del sistema viejo estaba bien** → se **copia tal cual** (tarjetas, filtros, columnas).
- El problema del viejo era el **código sucio** → eso es lo que NO repetimos.
- El app nuevo debe leer **la base REAL (`crm_pro`)**, NO la base demo (`ventaspro_nuevo`).
- **Prohibido emparchar:** nada de mezclar data demo con data real.

## Problema actual detectado

- La pantalla **Clientes** del app nuevo muestra solo **4 clientes falsos** (demo) porque
  lee el schema `ventaspro_nuevo`, no `crm_pro`. El sistema real tiene ~1263 clientes
  (2656 líneas activas).
- Solo **Comisiones** está conectada a la data real.
- Las **comisiones de vendedores demo** siguen apareciendo porque salen del schema demo.

## Pantalla Clientes — qué FALTA (copiar del viejo)

1. **Traer los clientes reales** de `crm_pro` (no los 4 demo).
2. **Tarjetas KPI** arriba (como el viejo), cada una con desglose Móvil / Fijo líneas y $$:
   - **Activos** · **Cancelados** · **Seguimiento** · **Incompletos** · Total.
3. **Filtros / botones** (ponerlos todos, aunque algunos se cableen después):
   - Buscar clientes (texto).
   - Tipo (Todos los tipos) · Vencimiento (Todos los vencimientos) · Orden (Orden por defecto)
     · Año (2026) · Estado (Todos).
   - Botones: **Reportes**, **Generar Oferta IA**, **Exportar**, **+ Nuevo Cliente**, **Cliente Voz**.
4. **Columnas de la tabla** (como el viejo): Empresa · Celular · Última actividad · Tipo BAN ·
   Base · Estado · Vendedor asignado · Num BAN · Suscriptor · Fecha vencimiento · Acciones.

## Categorías (Gabriel, 2026-06-26) — ✅ HECHO

- **Categorías NO es editable** y **va DENTRO de Configuración** (sacada del menú lateral).
- Se muestra como referencia (solo lectura).
- ✅ Configuración ahora unifica **Productos + Categorías (solo lectura) + Asana Pasos**
  (como la "Gestión" del sistema viejo). Ítems sueltos Categorías y Asana Pasos
  sacados del menú.

## Aprendizaje técnico (bug evitar repetir)

- **No usar `SET search_path` directo en una conexión del pool** y soltarla: queda
  contaminada y rompe otras pantallas (pasó con Productos/Configuración). Usar
  `BEGIN` + `SET LOCAL search_path` + `COMMIT` (se revierte solo). Ya aplicado en
  `clientsReal.js`.

## Skill de diseño creado

- `.claude/skills/ventaspro-diseno/SKILL.md`: paleta + componentes (.kpi/.btn/.pill/
  .card/.inp) + regla "reusar clases, nunca inline". Leer antes de tocar cualquier
  pantalla del frontend.

## Estado pantalla Clientes (2026-06-26)

- ✅ **Hecho:** lee data REAL de `crm_pro` (endpoint `clients-real.js` reusa la lógica
  probada del viejo). Trae ~1522 clientes. 4 tarjetas (Activos/Cancelados/Seguimiento/
  Incompletos) **clicables para filtrar**, Total, buscador por nombre (Enter),
  paginación 50/pág, y las columnas del viejo (Empresa, Celular, Última actividad,
  Tipo BAN, Base, Estado, Vendedor, Num BAN, Suscriptor, Fecha vencimiento).
- ⚠️ **Limitación de la base LOCAL:** los campos de tipo de línea (`account_type`,
  `line_kind`, `product_type`, `plan`, `category_id`) están **casi todos NULL** en la
  copia local. Por eso las tarjetas muestran casi todo como "Incompletos". En
  **producción** ese dato está lleno → la misma lógica clasifica bien (móvil/fijo).
- ⬜ **Filtros pendientes de cablear:** Tipo, Vencimiento, Orden, Año, Estado (hoy son
  selects visuales deshabilitados). Botones Reportes / Generar Oferta IA / Exportar /
  Cliente Voz → placeholders ("próximamente").

## Demo → REAL por módulo (orden de Gabriel: sacar TODA la demo)

| Módulo | Estado |
|---|---|
| Clientes | ✅ REAL (`public` crm_pro) |
| Comisiones | ✅ REAL (`subscriber_reports`) |
| Asana Seg. (lista + detalle + cerrar al pool) | ✅ REAL (`sales_opportunities`+`opportunity_lines`+`opportunity_steps`) |
| Configuración (productos/categorías/pasos) | config nuevo editable (no es data falsa) |
| **Panel General** | ⬜ DEMO — pasar a real |
| **Metas** | ⬜ DEMO — pasar a real |
| **Pendientes Tango** | ⬜ DEMO — pasar a real |
| **Ficha de cliente** (`viewCliente`/`/api/clients/:id`) | ⬜ DEMO — pasar a real |
| **Historial** | ⬜ DEMO — pasar a real |
| **Comparativa** | ⬜ DEMO — pasar a real |

- Asana detalle: la **bitácora** real (llamadas/notas) queda pendiente de conectar a
  su tabla real (no se usa la demo). Pasos y productos ya son reales.

## Limpieza pendiente

- Sacar la data demo (4 clientes falsos, comisiones demo, oportunidades demo) una vez
  conectado todo a `crm_pro`.
