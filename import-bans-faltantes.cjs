#!/usr/bin/env node

const XLSX = require('xlsx');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'crm_pro',
  port: process.env.DB_PORT || 5432,
});

async function importBANsFaltantes() {
  console.log('🔄 Leyendo Excel con datos completos...');
  
  const workbook = XLSX.readFile('elementos_extra/excels/final UNIFICADO_CLIENTES_HERNAN.xlsx');
  console.log(`📊 Hojas disponibles:`, workbook.SheetNames);
  
  // Intentar leer la primera hoja
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📈 Total de filas en Excel: ${data.length}`);
  console.log(`📋 Primeras columnas:`, Object.keys(data[0] || {}));

  // Extraer BANs únicos con STATUS
  const bansMap = new Map();
  
  data.forEach(row => {
    const banNumber = row['BAN'] || row['ban'] || row['Ban'] || row['BAN_NUMBER'] || row['numero_ban'];
    const status = row['STATUS'] || row['status'] || row['Status'] || 'A';
    const nombre = row['NOMBRE'] || row['nombre'] || row['Nombre'] || '';
    const apellido = row['APELLIDO'] || row['apellido'] || row['Apellido'] || '';
    const empresa = row['EMPRESA'] || row['empresa'] || row['Empresa'] || '';

    if (banNumber) {
      const key = String(banNumber).trim();
      if (!bansMap.has(key)) {
        bansMap.set(key, {
          ban_number: key,
          status: String(status || 'A').toUpperCase(),
          nombre: String(nombre || '').trim(),
          apellido: String(apellido || '').trim(),
          empresa: String(empresa || '').trim(),
        });
      }
    }
  });

  console.log(`\n✅ BANs únicos en Excel: ${bansMap.size}`);
  console.log(`   - Activos (A): ${Array.from(bansMap.values()).filter(b => b.status === 'A').length}`);
  console.log(`   - Cancelados (C): ${Array.from(bansMap.values()).filter(b => b.status === 'C').length}`);

  // Obtener BANs ya en BD
  console.log('\n🔍 Consultando BANs existentes en BD...');
  const existingResult = await pool.query('SELECT ban_number FROM bans');
  const existingBans = new Set(existingResult.rows.map(r => String(r.ban_number).trim()));

  console.log(`✅ BANs existentes en BD: ${existingBans.size}`);

  // Identificar faltantes
  const bansToInsert = Array.from(bansMap.values()).filter(
    b => !existingBans.has(b.ban_number)
  );

  console.log(`\n📥 BANs a importar: ${bansToInsert.length}`);
  if (bansToInsert.length === 0) {
    console.log('✅ No hay BANs nuevos para importar.');
    await pool.end();
    return;
  }

  // Insertar BANs faltantes
  console.log('\n⏳ Iniciando importación...');
  let inserted = 0;
  let skipped = 0;

  for (const ban of bansToInsert) {
    try {
      await pool.query(
        `INSERT INTO bans (ban_number, is_active, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (ban_number) DO NOTHING`,
        [ban.ban_number, ban.status === 'A' ? 1 : 0]
      );
      inserted++;
      if (inserted % 100 === 0) process.stdout.write(`\r📊 Importados: ${inserted}/${bansToInsert.length}`);
    } catch (err) {
      console.error(`❌ Error insertando BAN ${ban.ban_number}:`, err.message);
      skipped++;
    }
  }

  console.log(`\n✅ Importación completada!`);
  console.log(`   - Insertados: ${inserted}`);
  console.log(`   - Errores/Saltados: ${skipped}`);

  // Verificar total
  const finalResult = await pool.query('SELECT COUNT(*) as total FROM bans');
  console.log(`\n📈 Total BANs en BD ahora: ${finalResult.rows[0].total}`);
  console.log(`   - Esperado según Excel: 3,636`);

  await pool.end();
}

importBANsFaltantes().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
