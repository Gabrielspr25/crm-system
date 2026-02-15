// test-legacy-client-types.js
import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function testClientTypes() {
  try {
    // 1. Ver estructura de tablas para identificar campos de tipo
    console.log('\n=== COLUMNAS DE clientecredito ===');
    const cols1 = await legacyPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clientecredito'
      ORDER BY ordinal_position
    `);
    console.log(cols1.rows);

    console.log('\n=== COLUMNAS DE crmcliente ===');
    const cols2 = await legacyPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'crmcliente'
      ORDER BY ordinal_position
    `);
    console.log(cols2.rows);

    // 2. Buscar tipos de cliente (PYMES, prepago, etc.)
    console.log('\n=== TIPOS DE CLIENTE (valores únicos en crmcliente) ===');
    const tipos = await legacyPool.query(`
      SELECT DISTINCT tipo_cliente, COUNT(*) as cantidad
      FROM crmcliente 
      WHERE tipo_cliente IS NOT NULL
      GROUP BY tipo_cliente
      ORDER BY cantidad DESC
    `);
    console.log('Tipos encontrados:');
    tipos.rows.forEach(row => {
      console.log(`  - ${row.tipo_cliente}: ${row.cantidad} registros`);
    });

    // 3. Buscar campos que identifiquen REN/NEW
    console.log('\n=== BUSCANDO CAMPOS REN/NEW ===');
    const sample = await legacyPool.query(`
      SELECT * 
      FROM crmcliente 
      LIMIT 3
    `);
    console.log('Muestra de registros completos:');
    console.log(JSON.stringify(sample.rows, null, 2));

    // 4. Clientes PYMES específicamente
    console.log('\n=== CLIENTES PYMES (5 ejemplos) ===');
    const pymes = await legacyPool.query(`
      SELECT * 
      FROM crmcliente 
      WHERE tipo_cliente ILIKE '%pymes%' 
      LIMIT 5
    `);
    console.log(JSON.stringify(pymes.rows, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await legacyPool.end();
  }
}

testClientTypes();
