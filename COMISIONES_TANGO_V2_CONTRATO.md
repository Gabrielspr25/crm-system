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

Regla oficial:

```text
Si Tango V2 trae comision real > 0, la venta entra por defecto a Comisiones.
```

Una venta no debe perderse por:
- no estar en una allowlist local
- no ser de un tipo conocido previamente
- no existir en reglas viejas del CRM
- no aparecer en legacy/POS
- no tener categoria CRM configurada todavia

Si el tipo de venta es nuevo:
- entra como venta Tango detectada
- queda marcado para clasificacion CRM
- no se descarta silenciosamente

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

## 4. Tipos Ya Confirmados

Estos tipos ya fueron confirmados como comisionables para SS-Group:

| ventatipo_id | Nombre | Estado |
|---:|---|---|
| 8 | BA CORP NEW | Incluir |
| 25 | Claro Update NEW | Incluir |
| 26 | Claro Update REN | Incluir |
| 121 | 2 Play | Incluir |
| 138 | PYMES Update REN | Incluir |
| 139 | PYMES Update NEW | Incluir |
| 140 | PYMES Fijo REN | Incluir |
| 141 | PYMES Fijo NEW | Incluir |
| 142 | Claro TV | Incluir |

---

## 5. Tipos Pendientes

Estos tipos requieren decision de negocio antes de entrar automaticamente como confirmados:

| Tipo | Estado |
|---|---|
| BYOP | Pendiente de clasificacion |
| Accesorios | Pendiente de clasificacion |
| Futuros tipos Tango | Pendiente de clasificacion si no tienen configuracion CRM |

Regla para pendientes:
- Si Tango trae comision real > 0, no se pierde.
- Puede entrar como `needs_review_tipo` o equivalente.
- Debe aparecer en auditoria para decision de negocio.
- No debe descartarse sin trazabilidad.

---

## 6. Casos Centinela

Estos ventaid deben usarse para validar el contrato:

| ventaid | Tipo esperado | Regla |
|---:|---|---|
| 80099 | 26 Claro Update REN | Debe entrar, usar `comisiones.total` |
| 80087 | 25 Claro Update NEW | Debe entrar |
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

## 7. Regla Prohibida

Queda prohibido:

```text
Usar allowlists hardcodeadas para decidir que ventas existen o entran al flujo.
```

No se permite decidir entrada con reglas como:

```js
const MOBILE_TIPOS = [138, 139];
const FIJO_TIPOS = [140, 141];
```

El codigo puede usar mapeos tecnicos para clasificar visualmente, pero no para excluir ventas reales de Tango.

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

## 8. Contrato Final

```text
Tango V2 decide que ventas existen.
Tango V2 decide si hay comision real.
CRM decide como clasificar y si excluir, pero solo mediante configuracion auditable.
El sync no debe perder ventas comisionables por allowlists hardcodeadas.
Comisiones debe mostrar lo que Tango V2 confirma, con revision solo cuando falten datos operativos.
```
