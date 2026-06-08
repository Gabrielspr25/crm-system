// ARCHIVO DESACTIVADO — conexión directa a BD legacy de Tango.
// El sistema usa exclusivamente la Tango API V2 (TANGO_API_BASE_URL + TANGO_API_KEY).
// Estas funciones lanzan error si se invocan accidentalmente.
// No eliminar el archivo para conservar historial; no agregar nuevos usos.

const DISABLED_MSG =
  '[externalPools] Conexión directa a BD legacy desactivada. ' +
  'El sistema usa únicamente Tango API V2. ' +
  'Ver TANGO_API_BASE_URL / TANGO_API_KEY en .env.';

export function getTangoPool() {
  throw new Error(DISABLED_MSG);
}

export function getPosPool() {
  throw new Error(DISABLED_MSG);
}

export function getDiscrepanciasPool() {
  throw new Error(DISABLED_MSG);
}

export async function closeExternalPools() {
  // Sin pools activos — no-op.
}
