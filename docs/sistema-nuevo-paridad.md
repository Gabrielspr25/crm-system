# Paridad sistema nuevo vs viejo — qué falta reconstruir

Actualizado: 2026-06-27.

> El sistema **viejo** (`server-FINAL.js` + `src/react-app/`) tiene TODO. El **nuevo**
> (`sistema-nuevo/`) hoy cubre un subconjunto. Acá queda la lista de lo que falta, con
> dónde está el código viejo de referencia para reconstruirlo. **No se pierde nada** —
> está todo versionado.

## ✅ Ya está en el nuevo

- **Clientes** (lista real + tarjetas + filtros + modal de cliente con 5 tabs).
- **Asana Seg.** (SOV2 real: oportunidades, columnas por producto, caminito de pasos, Al pool).
- **Cliente Voz** (dictado + parser → crea oportunidad).
- **Comisiones** (real, filtros mes/estado, comisión vendedor manual editable).
- **Metas** (negocio + por vendedor de Tango, por producto, con alcance).
- **Configuración** (productos/categorías editables + Configurar pasos).
- **Comparativa** (Plan Actual + Oferta + Excel + Propuesta PDF con diseño Claro).
- **Login Tango V2** + sesión + roles base.

## ⬜ Falta reconstruir en el nuevo (está en el viejo)

| Módulo / función | Dónde está en el viejo (referencia) |
|---|---|
| **OCR — Subir/Pegar** (BAN + suscriptores desde imagen) | `server-FINAL.js` (Vision documentTextDetection inline) + `src/react-app/pages/Clients.tsx` (BanPaste/Subir) |
| **Equipos** (lista de precios PYMES/CORP) | `equiposListaRoutes.js` + `admin-equipos.html` + tablas `equipos_*` |
| **Ofertas Web / Admin Ofertas / Constructor de ofertas** | `ofertasTiendaRoutes.js`, `planesModulosRoutes.js`, `admin-planes.html`, `Planes para web/` |
| **Importador (Import New)** | `src/react-app/pages/` importador + endpoints de carga |
| **Correos** (enviar ofertas/comparativas por email) | `EmailModal.tsx` + endpoint de email |
| **Campañas** (envíos masivos) | módulo campañas del viejo |
| **Vendedores** (admin) | `/api/salespeople` + página Vendedores |
| **Seguridad / Permisos** (por usuario/rol) | `permissionService.js` + páginas Seguridad/Permisos |
| **Pendientes Tango** (detallado) | módulo comisiones/pendientes del viejo |
| **Acciones de escritura del modal cliente** | Editar/Cancelar suscriptor, Nuevo BAN, Agregar suscriptor, Editar/Eliminar cliente, Enviar a POS — `ClientModal.tsx`/`BANModal.tsx`/`SubscriberModal.tsx` |

## Plan recomendado

1. **Deploy del nuevo AL LADO** (puerto 4000, URL propia), sin tocar el viejo (crmp sigue con todo).
2. Usar/ajustar el nuevo en prod (login Tango real).
3. Ir **reconstruyendo** los módulos de la tabla de arriba, uno por uno, en el nuevo.
4. Cuando el nuevo tenga todo → recién ahí se vuelve el principal y se retira el viejo.
