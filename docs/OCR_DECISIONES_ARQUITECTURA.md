# OCR — Decisiones de arquitectura

**Estado:** aprobado · **Fecha:** 2026-05-13 · **Owner:** Gabriel Sánchez (SS Group)
**Aplica a:** VentasProui CRM (Claro PR)

Este documento fija la separación funcional entre los dos flujos OCR del CRM. Cualquier
cambio que afecte estas reglas debe actualizar este archivo en el mismo PR.

---

## 1. Regla aprobada

El CRM tiene **dos flujos OCR**, con objetivos distintos, ubicaciones distintas y
endpoints de escritura distintos. **No se mezclan.**

### 1.1 OCR para cliente nuevo

- **Ubicación:** Clientes → "Cliente nuevo".
- **Objetivo:**
  - Crear el **cliente**.
  - Crear el **BAN** asociado.
  - Crear los **suscriptores** del BAN.
  - Aceptar **imagen y/o PDF** como entrada (PDF queda como capacidad futura).
  - Siempre mostrar **preview editable** antes de escribir.
- **Restricción:** No depende de un BAN ya existente. La operación de escritura
  crea registros nuevos en `clients`, `bans` y `subscribers`.

### 1.2 OCR para cliente existente

- **Ubicación:** Modal **BAN/Suscriptores** dentro de la ficha del cliente
  (componente actual `BanPasteSubscribersModal`).
- **Objetivo:**
  - **Actualizar el estado** de suscriptores existentes (status, plan, valor).
  - **Comparar** la imagen contra lo guardado en CRM.
  - Mostrar **preview** y exigir **Confirmar sync** antes de escribir.
- **Restricción:** Requiere un `ban_id` / `ban_number` ya abierto. Solo opera sobre
  registros existentes en `subscribers` del BAN seleccionado.

---

## 2. Regla crítica

> **Nuevo cliente = módulo Cliente nuevo.**
> **Cliente existente = modal BAN/Suscriptores.**
> **No mezclar endpoints de escritura.**
> **No reutilizar `paste-sync` para crear clientes nuevos.**

### Por qué

`paste-sync` está diseñado para una máquina de estados de suscriptores existentes
(Activo→Cancelled→Reactivar, Suspended no toca CRM, conflictos cross-BAN, lookup de
tarifas). Reusarlo para creación introduce ramas condicionales que rompen su
contrato actual y abren la puerta a creaciones accidentales desde el flujo de sync.

---

## 3. Mapa de endpoints

| Flujo | Endpoint OCR (lectura) | Endpoint escritura | Tabla afectada |
|---|---|---|---|
| **Cliente nuevo** | `POST /api/ocr/preview` *(Fase 1)* | `POST /api/ocr/import` *(Fase 3, futuro)* | `clients`, `bans`, `subscribers` (INSERT) |
| **Cliente existente** | `POST /api/subscribers/extract-image` | `POST /api/subscribers/paste-sync` | `subscribers` (UPDATE/INSERT acotado al BAN) |
| **Legacy Python** | `POST /api/ocr/process` | — | (no escribe; queda como fallback histórico hasta migrar `subscriberImageExtractor.ts`) |

**Reglas operativas:**

1. `/api/ocr/preview` **nunca** escribe en DB.
2. `/api/ocr/import` (Fase 3) **solo** se puede llamar desde el módulo "Cliente nuevo".
3. `/api/subscribers/paste-sync` **solo** se puede llamar desde el modal BAN/Suscriptores
   y siempre con un `ban_id` válido.
4. Ningún endpoint nuevo debe escribir en `subscribers` saltándose estas dos rutas.

---

## 4. Qué se comparte y qué no

### 4.1 Se puede compartir (con cuidado)

- **Motor OCR** (`tesseract.js`) vía `src/backend/services/ocrTextService.js` con
  opciones de pasadas/idioma/preprocesamiento.
- **Normalización de teléfono PR a 10 dígitos.** Hoy hay 3 implementaciones
  (subscriberController, ocrParserService, frontend). Es el único dedupe con
  riesgo ~0 y vale la pena cuando haya margen.
- **Aliases de status EN/ES** comunes (Active, Cancelled, Suspended, Pending),
  si y solo si se decide explícitamente que aplican a ambos flujos.

### 4.2 No se debe compartir nunca

- Endpoint de escritura (ver §3).
- Máquina de estados del sync (`Suspended no cambia CRM`, transiciones
  Activo→Cancelled→Reactivar).
- Lookup de tarifas (`resolveMonthlyValue(plan_code)`).
- Aliases agresivos de plan (`BAHO/BARO/BAH0 → BAHOT40L`) — específicos del sync.
- Detección de conflictos cross-BAN — solo aplica al sync.
- Componentes de UI (el modal y la página son metáforas distintas; no fusionar).

---

## 5. Ubicaciones canónicas en el repo

| Pieza | Ruta |
|---|---|
| Página "Cliente nuevo" (a definir / ampliar) | `src/react-app/pages/ClientsNew.tsx` *(o sección dentro)* |
| Página standalone de preview OCR (transitoria) | `src/react-app/pages/OcrImportPreview.tsx` |
| Modal sync existente | `src/react-app/components/BanPasteSubscribersModal.tsx` |
| Helper cascade legacy | `src/react-app/utils/subscriberImageExtractor.ts` |
| Backend — controller importación | `src/backend/controllers/ocrController.js` (export `previewOCR`) |
| Backend — controller sync | `src/backend/controllers/subscriberController.js` (`extractImageFiltered`, `pasteSync`) |
| Backend — servicios OCR comunes | `src/backend/services/ocrTextService.js`, `ocrParserService.js`, `ocrValidationService.js` |
| Rutas | `src/backend/routes/ocrRoutes.js`, `src/backend/routes/subscriberRoutes.js` |

> **Nota:** `OcrImportPreview.tsx` (`/ocr-preview`) es la pantalla de validación de
> Fase 1+2. Cuando Fase 3 enganche el OCR de creación dentro del módulo Clientes →
> Cliente nuevo, esta página podrá retirarse o quedarse como herramienta interna
> de pruebas.

---

## 6. Roadmap de fases

| Fase | Alcance | Estado |
|---|---|---|
| Fase 1 | Endpoint `POST /api/ocr/preview` con `tesseract.js` directo en Node, sin DB. | Hecho |
| Fase 2 | UI standalone `/ocr-preview` con upload, rawText colapsable, tabla editable y revalidación local. | Hecho |
| Fase 3 | Enganche del preview OCR dentro de **Clientes → Cliente nuevo** + endpoint `POST /api/ocr/import` que cree `client + ban + subscribers` con preview obligatorio. | Pendiente |
| Fase 4 | Soporte de **PDF** como entrada (mismo pipeline, otra extracción de texto). | Pendiente |
| Housekeeping | Centralizar normalización de teléfono PR (3 copias → 1). Migrar `subscriberImageExtractor.ts` y retirar `/api/ocr/process` (Python). | Pendiente |

---

## 7. Riesgos vigentes

1. **Drift de validaciones de status** entre los dos parsers si se agrega un estado
   nuevo y se actualiza solo uno. Mitigación: PR que toque uno debe revisar el otro.
2. **Drift de tolerancia OCR de teléfono.** Hoy el sync acepta `O→0` en teléfonos
   y la importación no. Aceptable mientras los corpus de imágenes sean distintos.
3. **`/api/ocr/process` (Python) sigue vivo** como fallback del helper
   `subscriberImageExtractor.ts`. No retirar sin migrar primero ese helper.
4. **Tentación de reusar `paste-sync` para crear clientes nuevos** porque "ya está
   hecho". Prohibido por §2.

---

## 8. Cambios a este documento

Actualizar este archivo en el mismo PR que cambie cualquiera de los siguientes:

- Endpoints OCR (`/api/ocr/*`, `/api/subscribers/extract-image`, `/api/subscribers/paste-sync`).
- Reglas de la máquina de estados del sync.
- Ubicación de los componentes UI listados en §5.
- Esquema de las tablas `clients`, `bans`, `subscribers` que afecte estos flujos.

---

*Última actualización: 2026-05-13.*
