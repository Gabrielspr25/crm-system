# Patrón SQL para Reporte de Detalle de Ventas

**Regla principal:**
Todas las filas de ventas deben provenir de la tabla `sales_history`, mostrando explícitamente los campos materializados de producto.

## SQL Base para Detalle

```sql
SELECT
  sh.sale_date,
  sh.company_name,
  sh.vendor_id,
  sh.salesperson_id,
  sh.fijo_ren,
  sh.fijo_new,
  sh.movil_nueva,
  sh.movil_renovacion,
  sh.claro_tv,
  sh.cloud,
  sh.mpls,
  sh.total_amount,
  sh.monthly_value,
  sh.notes
FROM sales_history sh
WHERE sh.client_id = $1
ORDER BY sh.sale_date DESC, sh.created_at DESC;
```

## Lógica de Frontend
- Para cada fila, mostrar solo los productos cuyo valor sea >0.
- Si una fila tiene varios productos, mostrar todos los que correspondan.
- El monto de cada producto es el valor de la columna correspondiente.

## Ejemplo de Desglose
| Fecha      | Cliente      | Producto         | Monto   |
|------------|--------------|------------------|---------|
| 2026-02-16 | PRECAST      | Movil Nueva      | $104.99 |
| 2026-02-16 | PRECAST      | Movil Renovación | $346.47 |
| 2026-02-16 | ABIEZER ORTIZ| Movil Nueva      | $50.00  |
| 2026-02-16 | ABIEZER ORTIZ| Movil Renovación | $220.00 |
| 2026-02-16 | ABIEZER ORTIZ| Cloud            | $66.00  |

## Reglas de Consistencia
- No usar JOIN con `venta_tipos` ni contar filas.
- Solo sumar y mostrar columnas materializadas.
- Si el valor es 0, no mostrar ese producto en el desglose.

## Validación
- Si una venta aparece en el header, debe aparecer en el grid y en el historial.
- Si una fila no muestra productos, revisar el mapeo en el backend (salesHistoryController.js).

---
**Este patrón garantiza que todas las ventas se vean con su detalle, sin duplicados ni inflaciones.**
