# Constructor de Ofertas — Portal ofertas.ss-group.cloud

Plan y documentación del módulo de subida de documentos + actualización automática de ofertas.
Creado: 2026-06-10.

## Arquitectura actual (ya construido)

- **BD:** tabla `planes_modulos` (PostgreSQL). Campos: `pagina` (fijos|moviles|inalambrico), `seccion_key`, `titulo`, `subtitulo`, `descripcion`, `orden`, `activo`, `tipo`, `contenido` (JSON: `{columnas, filas}` o `{secciones}`), `vigencia_desde/hasta`, `boletin_ref`, `updated_by/at`.
- **Backend:** `server-FINAL.js` monta `src/backend/routes/planesModulosRoutes.js` → `src/backend/controllers/planesModulosController.js`.
- **Admin UI:** `public/admin-planes.html` (menú lateral CRM crmp.ss-group.cloud). Botón "Subir PDF" por módulo.
- **Frontend público:** `Planes para web/` desplegado en ofertas.ss-group.cloud (nginx proxy → :3001).
  - `index.html` → página `fijos`
  - `movil.html` → página `moviles`
  - `banda-ancha.html` → página `inalambrico`
  - `equipos.html` → endpoint aparte `/api/equipos-lista`
- **Parser existente:** `scripts/parse_equipos_pdf.py` (pdfplumber) — SOLO entiende el boletín de equipos Inalámbrico/Claro Hogar (Claro Oficina, MiFi/Internet On The Go, financiamientos).
- **Protección anti-clobber:** si el parser no extrae tablas, el contenido del módulo NO se modifica (HTTP 422).

## Rutas existentes

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| GET | `/api/planes-modulos/:pagina` | Público | Módulos activos de una página (fijos\|moviles\|inalambrico) |
| GET | `/api/planes-modulos/admin/all` | Admin/Supervisor | Todos los módulos, todas las páginas |
| POST | `/api/planes-modulos` | Admin | Crear módulo |
| PUT | `/api/planes-modulos/:id` | Admin | Actualizar módulo |
| DELETE | `/api/planes-modulos/:id` | Admin | Soft-delete (activo=false) |
| POST | `/api/planes-modulos/:id/upload-pdf` | Admin | Sube PDF, parsea con `parse_equipos_pdf.py`, reemplaza contenido |
| GET | `/api/equipos-lista` | Público | Lista de equipos (página equipos.html) |

Uploads se guardan en `/opt/crmp/uploads/pdf-planes` (máx. 20MB, solo PDF).

## Documentos fuente a soportar

| # | Documento | Formato | Página destino | Parser | Estado |
|---|---|---|---|---|---|
| 1 | Listado Estructura Planes PYMES/Negocios (fijos) | PDF (3 págs, 13 categorías) | `fijos` | `parse_planes_fijos_pdf.py` | ✅ v1 (96 filas validadas con v15) |
| 2 | Lista de Precios Móviles (4 tabs/pestañas) | Excel | `moviles` | `parse_precios_moviles_xlsx.py` | **POR CREAR** |
| 3 | Boletín Internet On The Go / Inalámbrico | PDF | `inalambrico` | `parse_equipos_pdf.py` | ✅ Existe (v2) |
| 4 | Ofertas futuras | PDF/Excel | según corresponda | extensible | Pendiente definir |

### Estructura fija del Listado de Planes Fijos (doc #1)

Encabezados que nunca cambian: Código, Planes (categoría), Precio, Alfa Code, Tecnología
(subbloques COBRE/VRAD y GPON), Minuto Adicional, Instalación (0/12/24 meses; RCF: 0/3/6),
Activación Jack (0/12/24; RCF: 0/3/6), Penalidad.

Categorías fijas (orden del documento):
1. Planes Medidos - Telefonía
2. Planes Ilimitado PR - Telefonía
3. Planes Tele Entry Service Ilimitado - Telefonía
4. Remote Call Forward PR Ilimitado (términos 0/3/6)
5. Remote Call Forward US Ilimitado (términos 0/3/6)
6. PQT Ilimitado PR/US - Telefonía
7. Ilimitado PR/US + Internet - 2 PLAY
8. Líneas Adicionales para Bundles (COBRE/VRAD y GPON)
9. Televisión - 1 PLAY (Clarotv+ Negocios) — usa Equipo-Compra NRC en vez de Act. Jack
10. Complementos Televisión - 1 PLAY
11. Equipos/Decodificadores STB — columnas propias: Price Code SIF, SAP ID, Mensual Financiado
12. Valores Agregados - Telefonía
13. Códigos de Emisión de Órdenes (verticales) + Términos de Contrato OSADIA

Particularidades que el parser debe manejar:
- Clave única real = `codigo + alfa_code` (ej. A878 aparece 2 veces: plan y bundle).
- Filas resaltadas (amarillo) = cambios/novedades de la revisión.
- Paralelo COBRE↔GPON: mismo plan, códigos distintos.
- Revisión del documento en encabezado: "REV. MM.DD.AAAA" + número de versión "(NN)".

## Rutas nuevas (a construir)

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| POST | `/api/planes-modulos/preview` | Admin | Sube PDF/Excel, autodetecta tipo de documento, parsea y devuelve **diff** vs contenido publicado (sin aplicar nada). Respuesta: `{tipo_detectado, version_doc, cambios: {precios: [], codigos: [], nuevos: [], ausentes: []}, preview_id}` |
| POST | `/api/planes-modulos/apply/:preview_id` | Admin | Aplica los cambios aprobados del preview (transacción atómica). Guarda snapshot previo para rollback |
| GET | `/api/planes-modulos/historial` | Admin | Historial de versiones aplicadas (documento, fecha, usuario, resumen de cambios) |
| POST | `/api/planes-modulos/rollback/:version_id` | Admin | Restaura snapshot anterior |

Detección automática de tipo de documento (en `preview`):
- Texto contiene "LISTADO PLANES ESTRUCTURA DE NEGOCIOS" → parser fijos.
- Excel con 4 pestañas de precios móviles → parser móviles.
- Texto contiene "Claro Oficina"/"Internet On The Go" → parser equipos (existente).
- No reconocido → 422, no se modifica nada.

## Flujo operativo (objetivo)

1. Admin sube el documento en admin-planes (o nueva pantalla "Constructor").
2. Sistema detecta tipo → parsea → calcula diff contra lo publicado.
3. Pantalla de revisión: "X precios cambian, Y códigos nuevos, Z planes nuevos, W ausentes".
   Los ausentes preguntan: ¿desactivar o mantener?
4. Admin aprueba → se aplica en transacción → portal público refleja al instante.
5. Queda versión en historial con rollback disponible.

## Requisito de schema (migración explícita, NO desde endpoints)

Tabla nueva `planes_documentos` (historial/versiones):
`id, tipo_documento, nombre_archivo, version_doc, rev_fecha, pagina, snapshot_antes (JSON),
cambios_resumen (JSON), aplicado_por, aplicado_at`.
→ Crear migración revisable según regla de CLAUDE.md. No ejecutar sin backup y autorización.

## Reglas del proyecto que aplican (CLAUDE.md)

- Endpoints viven inline o se montan en `server-FINAL.js` (verificar antes de tocar).
- Cambios de schema → migraciones explícitas. No backfills sin backup + autorización.
- Validación: `npm run build` para frontend/backend.
- Deploy: build local → scp → reinicio PM2. Sin `git pull` en producción.

## Gestión de documentos fuente

Archivo oficial local: `documentos-ofertas/` (subcarpetas: fijos, moviles, inalambrico, otros).
Protocolo completo en `documentos-ofertas/LEEME.md`. Reglas clave: nunca borrar versiones
viejas; nombre original de Claro; tipos nuevos entran por `otros/` hasta tener parser y
categoría definida; `Planes para web/` NO guarda documentos fuente (es el frontend desplegado).

## Archivos de referencia

- Datos extraídos del listado rev. 03.31.2026 (v15): ver extracción JSON generada en sesión 2026-06-10.
- PDF fuente anterior: `Planes para web/LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)-240226.pdf` (v12 — datos actualmente publicados).
- Diff real detectado v12→v15: A887/A888/A889 → C474/C475/C476 (códigos, alfa codes y precios bajan: $174.99→$134.99, $184.99→$159.99, $199.99→$174.99); nuevos planes Clarotv+ (6 tiers); bundles GPON 2L/3L/4L ausentes en v15 (confirmar si se descontinúan).

## Orden de trabajo propuesto

1. ✅ `parse_planes_fijos_pdf.py` (parser listado fijos). 2026-06-10.
2. ✅ Endpoint `preview` con detección de tipo + diff — `planesPreviewController.js`. 2026-06-10.
3. Pantalla de revisión/aprobación en admin-planes. ← SIGUIENTE
4. ✅ Endpoint `apply` (transacción + snapshot a disco en `/opt/crmp/uploads/pdf-planes/snapshots/`).
   Pendiente: migración `planes_documentos` para historial consultable + rollback por API.
5. `parse_precios_moviles_xlsx.py` (Excel "Lista de Precios 28may-31jul 2026", 4 tabs).
6. ✅ Soporte Excel en multer (ruta `/preview` acepta .pdf/.xlsx; Excel responde 422 hasta tener parser).

## Notas de implementación (preview/apply)

- Previews en memoria del proceso (Map, TTL 30 min) — válido con PM2 en proceso único.
- Detección de tipo: intenta parser fijos → parser equipos → 422 sin tocar nada.
- Match documento↔módulo: por `seccion_key` o título normalizado.
- Diff por clave `codigo|alfa_code`: nuevos / ausentes / modificados (precio, descripcion, tecnologia).
- Apply NO desactiva filas ausentes automáticamente: reemplaza filas del módulo con las del
  documento aprobado (las ausentes desaparecen del portal pero quedan en el snapshot).
