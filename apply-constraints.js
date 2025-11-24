import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'postgres',
  password: 'CRM_Seguro_2025!',
  ssl: false
});

async function applyConstraints() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando limpieza y aplicación de reglas de negocio...');

    await client.query('BEGIN');

    // ========================================================================
    // 1. CLIENTES: Unificar duplicados por business_name
    // ========================================================================
    console.log('\n1️⃣  Procesando duplicados de CLIENTES...');
    
    // Encontrar nombres duplicados
    const duplicateClients = await client.query(`
      SELECT business_name, COUNT(*) 
      FROM clients 
      WHERE business_name IS NOT NULL AND business_name != ''
      GROUP BY business_name 
      HAVING COUNT(*) > 1
    `);

    for (const row of duplicateClients.rows) {
      const name = row.business_name;
      console.log(`   - Fusionando duplicados para: "${name}"`);

      // Obtener todos los IDs con ese nombre, ordenados por antigüedad (el primero es el más viejo)
      const idsRes = await client.query(`SELECT id FROM clients WHERE business_name = $1 ORDER BY id ASC`, [name]);
      const ids = idsRes.rows.map(r => r.id);
      const mainId = ids[0]; // Nos quedamos con el más antiguo
      const duplicateIds = ids.slice(1); // El resto se borra

      // Mover BANs de los duplicados al principal
      for (const dupId of duplicateIds) {
        await client.query(`UPDATE bans SET client_id = $1 WHERE client_id = $2`, [mainId, dupId]);
        await client.query(`UPDATE follow_up_prospects SET client_id = $1 WHERE client_id = $2`, [mainId, dupId]);
        await client.query(`DELETE FROM clients WHERE id = $1`, [dupId]);
      }
    }

    // Aplicar restricción UNIQUE a business_name
    // Primero eliminamos si existe para evitar errores al re-correr el script
    await client.query(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_business_name_key`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS clients_business_name_unique_idx ON clients (business_name) WHERE business_name IS NOT NULL AND business_name != ''`);
    console.log('   ✅ Restricción aplicada: No puede haber dos clientes con el mismo nombre.');


    // ========================================================================
    // 2. SUSCRIPTORES: Unificar duplicados activos por teléfono
    // ========================================================================
    console.log('\n2️⃣  Procesando duplicados de SUSCRIPTORES...');

    // Encontrar teléfonos activos duplicados
    const duplicateSubs = await client.query(`
      SELECT phone, COUNT(*) 
      FROM subscribers 
      WHERE is_active = 1
      GROUP BY phone 
      HAVING COUNT(*) > 1
    `);

    for (const row of duplicateSubs.rows) {
      const phone = row.phone;
      console.log(`   - Resolviendo duplicados activos para teléfono: ${phone}`);

      // Obtener IDs activos, quedarnos con el más reciente (asumiendo que es el válido)
      const idsRes = await client.query(`SELECT id FROM subscribers WHERE phone = $1 AND is_active = 1 ORDER BY created_at DESC`, [phone]);
      const ids = idsRes.rows.map(r => r.id);
      const keepId = ids[0];
      const removeIds = ids.slice(1);

      // Marcar los antiguos como inactivos (o eliminarlos si prefieres, aquí los desactivamos para historial)
      for (const remId of removeIds) {
        await client.query(`UPDATE subscribers SET is_active = 0 WHERE id = $1`, [remId]);
      }
    }

    // Aplicar restricción UNIQUE parcial (solo para activos)
    // Esto permite que el número exista varias veces en el historial (cancelado), pero solo una vez activo.
    await client.query(`DROP INDEX IF EXISTS idx_subscribers_phone_active`);
    await client.query(`CREATE UNIQUE INDEX idx_subscribers_phone_active ON subscribers (phone) WHERE is_active = 1`);
    console.log('   ✅ Restricción aplicada: Un suscriptor no puede estar activo dos veces con el mismo número.');

    await client.query('COMMIT');
    console.log('\n🎉 Todas las reglas de negocio han sido aplicadas exitosamente.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error aplicando reglas:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applyConstraints();
