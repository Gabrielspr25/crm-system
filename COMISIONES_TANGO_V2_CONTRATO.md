# COMISIONES_TANGO_V2_CONTRATO.md

## Objetivo

Definir el contrato oficial para que el modulo de Comisiones consuma correctamente Tango API V2 sin perder ventas reales por reglas locales hardcodeadas.

Este contrato aplica a:
- pantalla `/comisiones` / `/reportes`
- sync Tango -> CRM
- `subscriber_reports`
- metricas que consumen comisiones
- Panel Director cuando use vendido / ganancia / comisiones

---

## 1. Fuente Oficial

La fuente oficial de ventas y comisiones es Tango API V2.

Endpoints oficiales:

```http
GET /api/external/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/external/comisiones?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
```

### Tango V2 Ventas

Tango V2 ventas define:
- que venta existe
- `ventaid`
- fecha de activacion
- BAN
- cliente
- vendedor Tango
- telefono / suscriptor cuando aplique
- plan
- mensualidad
- tipo de venta

Campo clave:

```text
ventatipo.id
ventatipo.nombre
```

### Tango V2 Comisiones

Tango V2 comisiones define:
- si una venta genero dinero real para SS-Group
- monto de comision
- desglose de componentes de comision

Campos clave:

```text
comisiones.comisionclaro
comisiones.features
comisiones.bonoportabilidad
comisiones.bonoretencion
comisiones.bonovolumen
comisiones.comisionextra
comisiones.comisionpapper
comisiones.total
desglose[]
```

Regla de monto:

```text
company_earnings = comisiones.total si existe y es > 0
```

Fallback:

```text
si comisiones.total no existe:
company_earnings = suma de componentes positivos del desglose / comisiones
```

---

## 2. Regla De Entrada

Regla oficial vigente:

```text
Solo ventas Tango V2 de negocio PYMES entran a Comisiones.
Ademas deben traer comision real > 0.
```

Tipos fuera de PYMES no deben:
- crear cliente
- crear BAN
- crear suscriptor
- crear `subscriber_reports`
- quedar activos en `tango_commission_pending_sales`

Tipos fuera de PYMES se ignoran con motivo auditable `tipo_no_pymes` cuando ya existan como pendientes.

---

## 3. Configuracion CRM Requerida

El CRM debe tener una configuracion auditable de tipos Tango.

Campos requeridos:

| Campo | Descripcion |
|---|---|
| `ventatipo_id` | ID oficial de Tango `ventatipo.id` |
| `nombre` | Nombre oficial Tango `ventatipo.nombre` |
| `include_in_commissions` | Si el CRM incluye este tipo en Comisiones |
| `categoria_crm` | Categoria interna CRM: movil, fijo, tv, cloud, mpls, banda_ancha, accesorio, prepago, otro |
| `motivo_exclusion` | Obligatorio si `include_in_commissions = false` |
| `updated_at` | Fecha de ultima actualizacion |

Reglas:
- `include_in_commissions` no debe vivir hardcodeado en codigo.
- Un tipo con comision real > 0 debe entrar por defecto salvo exclusion explicita.
- Toda exclusion debe tener motivo.
- Todo tipo nuevo con comision real debe aparecer en auditoria/configuracion.

---

## 4. Tipos PYMES Permitidos

Estos son los unicos tipos permitidos para Comisiones/Tango V2:

| Nombre Tango | Clasificacion CRM | Negocio |
|---|---|---|
| BA CORP NEW | Movil Nueva | PYMES |
| BA CORP REN | Movil Renovacion | PYMES |
| Cloud Negocios | Cloud | PYMES |
| Corp Update New | Movil Nueva | PYMES |
| Corp Update Ren | Movil Renovacion | PYMES |
| Office 365 Negocios | Cloud | PYMES |
| PYMES Fijo NEW | Fijo Nueva | PYMES |
| PYMES Fijo REN | Fijo Renovacion | PYMES |
| PYMES Update NEW | Movil Nueva | PYMES |
| PYMES Update REN | Movil Renovacion | PYMES |
| Telemetria NEW | Movil Nueva | PYMES |
| Telemetria REN | Movil Renovacion | PYMES |

IDs reales confirmados hasta junio 2026:

La decision se toma por NOMBRE del tipo, no por id. Un mismo id (25/26) puede
llegar como "Corp Update" (entra) o como "Claro Update" (NO entra).

| ventatipo_id | Nombre Tango | Regla |
|---:|---|---|
| 8 | BA CORP NEW | Permitir |
| 25 | Corp Update New | Permitir (NO "Claro Update New") |
| 26 | Corp Update Ren | Permitir (NO "Claro Update Ren") |
| 138 | PYMES Update REN | Permitir |
| 139 | PYMES Update NEW | Permitir |
| 140 | PYMES Fijo REN | Permitir |
| 141 | PYMES Fijo NEW | Permitir |

IMPORTANTE: "Claro Update New" / "Claro Update Ren" NO entran a Comisiones,
aunque traigan comision real. Solo los 12 nombres oficiales de la seccion 4.

---

## 5. Contrato PYMES Tango V2

Regla definitiva de negocio:

```text
Las ventas Tango V2 de negocio PYMES con comision real crean automaticamente la relacion operativa CRM si no existe:

Cliente -> BAN -> Suscriptor -> subscriber_reports
```

Esta regla reemplaza la regla anterior de enviar todo BAN inexistente a pendientes.

### Tipos Tango PYMES

Los siguientes tipos son negocio PYMES y deben entrar al flujo automatico si Tango V2 trae comision real:

| Nombre Tango | Clasificacion CRM | Negocio |
|---|---|---|
| BA CORP NEW | Movil Nueva | PYMES |
| BA CORP REN | Movil Renovacion | PYMES |
| Corp Update New | Movil Nueva | PYMES |
| Corp Update Ren | Movil Renovacion | PYMES |
| PYMES Update NEW | Movil Nueva | PYMES |
| PYMES Update REN | Movil Renovacion | PYMES |
| Telemetria NEW | Movil Nueva | PYMES |
| Telemetria REN | Movil Renovacion | PYMES |
| PYMES Fijo NEW | Fijo Nueva | PYMES |
| PYMES Fijo REN | Fijo Renovacion | PYMES |
| Cloud Negocios | Cloud | PYMES |
| Office 365 Negocios | Cloud | PYMES |

### Regla De Auto-Creacion PYMES

Si una venta Tango V2 cumple:

- es tipo PYMES confirmado;
- trae comision real mayor a cero;
- no existe cliente/BAN/suscriptor en CRM;

entonces el sync debe:

1. Crear cliente con datos de Tango.
2. Crear BAN con el BAN de Tango.
3. Crear suscriptor con telefono/linea de Tango si existe.
4. Guardar fecha de venta/activacion.
5. Crear `subscriber_reports`.
6. Marcar origen como Tango V2.
7. Dejar campos faltantes para completar luego en el modal del cliente.

### Pendientes

`tango_commission_pending_sales` queda solo para:

- ventas ambiguas;
- ventas sin datos minimos para crear relacion CRM;
- excepciones que requieran revision manual.

Una venta PYMES no debe ir a pendientes solo porque el BAN no existe.
Una venta no PYMES no debe quedar activa en pendientes.

---

## 6. Tipos Fuera De PYMES

Estos tipos no entran a Comisiones/Tango V2 y no deben quedar activos en pending:

| Tipo | Estado |
|---|---|
| BYOP / Prepago | Ignorar, motivo `tipo_no_pymes` |
| Accesorios | Ignorar, motivo `tipo_no_pymes` |
| 2 Play | Ignorar, motivo `tipo_no_pymes` |
| Claro TV - Servicio | Ignorar, motivo `tipo_no_pymes` |
| Futuros tipos Tango fuera de PYMES | Ignorar, motivo `tipo_no_pymes` |

Regla:
- No crear datos maestros.
- No crear `subscriber_reports`.
- No mantener `needs_review`.
- Si ya existen en `tango_commission_pending_sales`, marcar `ignored` con motivo `tipo_no_pymes`.

---

## 7. Casos Centinela

Estos ventaid deben usarse para validar el contrato:

| ventaid | Tipo esperado | Regla |
|---:|---|---|
| 80099 | 26 Claro Update REN | NO debe entrar (nombre "Claro Update") |
| 80087 | 25 Claro Update NEW | NO debe entrar (nombre "Claro Update") |
| 80124 | 140 PYMES Fijo REN | Debe entrar, usar `comisiones.total` |
| 80071 | 138 PYMES Update REN | Debe seguir entrando |
| 80093 | 139 PYMES Update NEW | Debe seguir entrando |
| 80096 | 140 PYMES Fijo REN | Debe seguir entrando |
| 80079 | 141 PYMES Fijo NEW | Debe seguir entrando |

Validaciones minimas:
- existe en Tango V2 ventas
- existe en Tango V2 comisiones
- conserva `ventaid`
- conserva BAN
- conserva cliente
- conserva vendedor Tango
- calcula `company_earnings`
- inserta o actualiza sin duplicar
- aparece en `/api/subscriber-reports`
- aparece correctamente en pantalla Comisiones

---

## 8. Regla Prohibida

Queda prohibido:

```text
Usar tipos no PYMES para crear comisiones, clientes, BANs, suscriptores o pendientes activos.
```

No se permite decidir entrada con reglas como:

```js
const MOBILE_TIPOS = [138, 139];
const FIJO_TIPOS = [140, 141];
```

El codigo puede usar el contrato PYMES oficial para excluir tipos fuera del negocio.

Permitido:
- configuracion CRM auditable
- exclusion con motivo
- clasificacion pendiente
- auditoria de tipos nuevos

No permitido:
- descartar silenciosamente
- depender de legacy/POS para validar existencia
- ignorar comisiones reales de Tango V2
- perder ventas porque el tipo no existia en codigo

---

## 9. Contrato Final

```text
Tango V2 decide que ventas existen.
Tango V2 decide si hay comision real.
CRM decide como clasificar y si excluir, pero solo mediante configuracion auditable.
Si la venta es PYMES confirmada, el CRM crea la relacion operativa faltante desde Tango V2.
Si la venta no es PYMES o es ambigua, queda en pendientes para revision.
El sync no debe perder ventas comisionables por allowlists hardcodeadas.
Comisiones debe mostrar lo que Tango V2 confirma, con revision solo cuando falten datos operativos.
```

---

## 10. Fix Sync Filtro PYMES (2026-06-16)

### Sintoma
El dashboard de Comisiones mostraba el badge "V2: 0 ventas", "0 reportes" y ~229
alertas tras correr el sync, aunque el API V2 si tenia ventas reales. La tabla
mostraba datos viejos (de syncs previos), no las ventas actuales de Tango.

### Causa raiz
`runTangoSync` mapeaba cada venta con `mapTangoApiV2SaleToSyncRow` y luego filtraba
con `shouldIncludeTangoV2SaleForCommissions(row, row)`. El row mapeado NO incluia
`ventatipo_nombre`, y el filtro PyMES (`isAllowedPymesCommissionVentaTipo`) decide
la inclusion EXCLUSIVAMENTE por nombre. Nombre vacio -> ninguna venta pasaba el
filtro -> 0 ventas / 0 reportes. Las 229 alertas eran el cleanup-desactivado
marcando como obsoletos a los 229 subscribers existentes (no borro nada porque el
cleanup estaba apagado).

### Fix
1. `mapTangoApiV2SaleToSyncRow` ahora incluye `ventatipo_nombre` en el row mapeado,
   para que el filtro reciba el nombre del tipo. (`src/backend/services/tangoV2SyncMapper.js`)
2. Rango del sync cambiado de `2026-01-01` a `2026-05-01`: Comisiones solo trae
   ventas desde mayo 2026. (`src/react-app/pages/Reports.tsx`)
3. Tests de regresion en `tests/vigia/tango-v2-sync-source.test.js` que verifican
   que el row mapeado conserva el nombre y que una tanda de ventas PyMES no se
   vacia al pasar por map + filter.

### Regla de rango
Comisiones se alimenta solo del API Tango V2, desde `2026-05-01` en adelante.
El historico anterior a mayo vive en Tango, no se sincroniza al CRM.
