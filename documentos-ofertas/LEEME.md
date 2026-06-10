# documentos-ofertas — Archivo oficial de documentos fuente

Esta carpeta es el archivo local de TODOS los documentos (PDF/Excel) que alimentan
el portal ofertas.ss-group.cloud. Regla de oro: **nada se publica que no esté guardado aquí primero.**

## Estructura

- `fijos/`        → Listado Estructura Planes PYMES/Negocios
- `moviles/`      → Lista de Precios Móviles (Excel, 4 tabs)
- `inalambrico/`  → Boletines Internet On The Go / Claro Hogar / equipos inalámbrico
- `otros/`        → Documentos nuevos sin categoría todavía (ver protocolo abajo)

## Reglas

1. **Nunca borrar versiones viejas.** Cada revisión se conserva — son el respaldo del diff.
2. **Nombre del archivo:** conservar el nombre original de Claro (ya trae versión y fecha,
   ej. `...TODOS @2026(15)-260330.pdf`). Si no trae fecha, agregar sufijo ` -AAMMDD`.
3. **La versión más reciente** de cada carpeta es la que se sube por el admin del CRM.
4. No guardar documentos fuente en `Planes para web/` (esa carpeta es el frontend desplegado).

## Protocolo según el caso

### A) Documento que ACTUALIZA un tipo existente (ej. nuevo listado de fijos)
1. Guardar el archivo en su subcarpeta (`fijos/`, `moviles/`, `inalambrico/`).
2. Subirlo por el admin del CRM (Subir PDF / constructor cuando esté listo).
3. Revisar el diff (precios, códigos, nuevos, ausentes) y aprobar.
4. Verificar en ofertas.ss-group.cloud que el cambio se publicó.

### B) Documento de un TIPO NUEVO (oferta que no existe en el portal)
1. Guardarlo en `otros/`.
2. Avisar a Claude en la sesión de trabajo: se analiza la estructura del documento,
   se define la categoría/página destino, el parser y los módulos nuevos.
3. Una vez creado el parser y los módulos, se crea su subcarpeta definitiva
   (ej. `iot/`) y el documento se mueve ahí. Queda registrado en
   `memory/constructor-ofertas.md`.

### C) Documentos históricos (los que ya estaban regados)
Moverlos a la subcarpeta que corresponda. No re-subirlos al admin (ya están publicados
o quedaron obsoletos); solo sirven de respaldo para diffs.

## Estado del archivo

| Carpeta | Última versión esperada | Publicada en portal |
|---|---|---|
| fijos/ | v15 — rev. 03.31.2026 | NO (portal tiene v12 de feb. 2024) |
| moviles/ | pendiente de recibir | — |
| inalambrico/ | pendiente de confirmar | — |

Actualizado: 2026-06-10
