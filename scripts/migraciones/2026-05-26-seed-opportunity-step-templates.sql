-- Oportunidades V2 - seed minimo de templates reales
-- Solo inserta en opportunity_step_templates.
-- No toca category_steps, tablas legacy, clientes, BANs, subscribers ni oportunidades.

BEGIN;

WITH seed_templates (
  opportunity_type,
  step_order,
  name,
  description,
  default_due_days,
  is_required,
  is_active
) AS (
  VALUES
    -- renovacion
    ('renovacion', 1, 'Confirmar intencion de renovacion', 'Validar si el cliente quiere renovar las lineas actuales.', 0, TRUE, TRUE),
    ('renovacion', 2, 'Revisar lineas y planes actuales', 'Confirmar lineas incluidas, planes vigentes y condiciones actuales.', 1, TRUE, TRUE),
    ('renovacion', 3, 'Preparar propuesta de renovacion', 'Definir oferta, precio, termino y beneficios de renovacion.', 2, TRUE, TRUE),
    ('renovacion', 4, 'Enviar contrato o aceptacion', 'Enviar documento o confirmacion requerida para procesar la renovacion.', 3, TRUE, TRUE),
    ('renovacion', 5, 'Confirmar cierre en comisiones', 'Validar que la venta cerrada aparezca correctamente en comisiones.', 7, TRUE, TRUE),

    -- nueva_linea
    ('nueva_linea', 1, 'Confirmar cantidad de lineas nuevas', 'Validar cuantas lineas nuevas necesita el cliente y para que uso.', 0, TRUE, TRUE),
    ('nueva_linea', 2, 'Solicitar datos de activacion', 'Recopilar informacion necesaria para activar las lineas nuevas.', 1, TRUE, TRUE),
    ('nueva_linea', 3, 'Preparar propuesta de lineas nuevas', 'Definir plan, precio, equipo si aplica y condiciones comerciales.', 2, TRUE, TRUE),
    ('nueva_linea', 4, 'Enviar contrato o autorizacion', 'Enviar documento requerido para aprobar las lineas nuevas.', 3, TRUE, TRUE),
    ('nueva_linea', 5, 'Confirmar numeros y registrar suscriptores', 'Cuando existan numeros, agregarlos a BANs y Suscriptores.', 5, TRUE, TRUE),
    ('nueva_linea', 6, 'Confirmar cierre en comisiones', 'Validar que la venta aparezca correctamente en comisiones.', 7, TRUE, TRUE),

    -- internet
    ('internet', 1, 'Confirmar necesidad de internet', 'Validar direccion, uso esperado y urgencia del servicio.', 0, TRUE, TRUE),
    ('internet', 2, 'Validar disponibilidad del servicio', 'Confirmar cobertura, tecnologia disponible y restricciones.', 1, TRUE, TRUE),
    ('internet', 3, 'Preparar propuesta de internet', 'Definir velocidad, precio, instalacion y condiciones.', 2, TRUE, TRUE),
    ('internet', 4, 'Solicitar documentos o autorizacion', 'Recopilar documentos necesarios para procesar la orden.', 3, TRUE, TRUE),
    ('internet', 5, 'Programar instalacion o activacion', 'Coordinar fecha de instalacion o activacion con el cliente.', 5, TRUE, TRUE),
    ('internet', 6, 'Confirmar cierre en comisiones', 'Validar que la venta aparezca correctamente en comisiones.', 7, TRUE, TRUE)
)
INSERT INTO opportunity_step_templates (
  category_id,
  product_id,
  opportunity_type,
  step_order,
  name,
  description,
  default_due_days,
  is_required,
  is_active
)
SELECT
  NULL,
  NULL,
  s.opportunity_type,
  s.step_order,
  s.name,
  s.description,
  s.default_due_days,
  s.is_required,
  s.is_active
FROM seed_templates s
WHERE NOT EXISTS (
  SELECT 1
  FROM opportunity_step_templates existing
  WHERE existing.category_id IS NULL
    AND existing.product_id IS NULL
    AND existing.opportunity_type = s.opportunity_type
    AND existing.step_order = s.step_order
    AND existing.name = s.name
);

COMMIT;
