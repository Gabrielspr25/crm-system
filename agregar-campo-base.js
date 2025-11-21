const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function agregarCampoBase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Agregando campo "base" a la tabla clients...\n');
    
    // 1. Agregar la columna
    await client.query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS base VARCHAR(100) DEFAULT 'BD propia'
    `);
    
    console.log('✅ Campo "base" agregado correctamente\n');
    
    // 2. Actualizar todos los registros existentes
    console.log('📝 Actualizando todos los clientes existentes con "BD propia"...\n');
    
    const result = await client.query(`
      UPDATE clients 
      SET base = 'BD propia' 
      WHERE base IS NULL OR base = ''
    `);
    
    console.log(`✅ ${result.rowCount} clientes actualizados\n`);
    
    // 3. Verificar
    const count = await client.query(`
      SELECT COUNT(*) as total, base 
      FROM clients 
      GROUP BY base
    `);
    
    console.log('📊 Estado actual:');
    count.rows.forEach(row => {
      console.log(`   - Base "${row.base}": ${row.total} clientes`);
    });
    
    console.log('\n🎉 PROCESO COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
agregarCampoBase();
