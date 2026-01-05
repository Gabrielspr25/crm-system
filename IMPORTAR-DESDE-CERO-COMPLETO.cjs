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

async function importarTodoDesdeExcel() {
  console.log('\n🔄 IMPORTACIÓN COMPLETA DESDE EXCEL');
  console.log('=====================================\n');

  // Leer Excel
  console.log('📂 Leyendo: elementos_extra/excels/final UNIFICADO_CLIENTES_HERNAN.xlsx');
  const workbook = XLSX.readFile('elementos_extra/excels/final UNIFICADO_CLIENTES_HERNAN.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`✅ Total filas en Excel: ${data.length}\n`);

  // Estructura: BAN, SUB, STATUS, plan, BASE, Razon Social, Email
  const bansMap = new Map(); // key: BAN, value: { status, subscribers: [], razonSocial, email }

  data.forEach((row, idx) => {
    const ban = String(row['BAN'] || '').trim();
    const sub = String(row['SUB'] || '').trim();
    const status = String(row['STATUS'] || 'A').trim().toUpperCase();
    const plan = String(row['plan'] || '').trim();
    const base = String(row['BASE'] || '').trim();
    const razonSocial = String(row['Razon Social'] || '').trim();
    const email = String(row['Email'] || '').trim();

    if (!ban || ban.length !== 9 || !/^\d{9}$/.test(ban)) {
      // Ignorar filas sin BAN válido
      return;
    }

    if (!bansMap.has(ban)) {
      bansMap.set(ban, {
        status,
        razonSocial,
        email,
        subscribers: []
      });
    }

    // Agregar suscriptor si existe SUB válido (10 dígitos)
    if (sub && sub.length === 10 && /^\d{10}$/.test(sub)) {
      bansMap.get(ban).subscribers.push({
        phone: sub,
        status,
        plan,
        base
      });
    }
  });

  console.log(`📊 Estadísticas Detalladas:`);
  console.log(`   - BANs únicos válidos: ${bansMap.size}`);
  
  // Clasificación detallada
  const activosConDatos = Array.from(bansMap.values()).filter(b => 
    b.status === 'A' && b.razonSocial && b.razonSocial.length > 0
  ).length;
  
  const activosSinDatos = Array.from(bansMap.values()).filter(b => 
    b.status === 'A' && (!b.razonSocial || b.razonSocial.length === 0)
  ).length;
  
  const canceladosConDatos = Array.from(bansMap.values()).filter(b => 
    b.status === 'C' && b.razonSocial && b.razonSocial.length > 0
  ).length;
  
  const canceladosSinDatos = Array.from(bansMap.values()).filter(b => 
    b.status === 'C' && (!b.razonSocial || b.razonSocial.length === 0)
  ).length;
  
  console.log(`\n   🟢 ACTIVOS (STATUS='A'):`);
  console.log(`      ✅ Con nombre/empresa: ${activosConDatos}`);
  console.log(`      ⚠️  Sin nombre/empresa (incompletos): ${activosSinDatos}`);
  console.log(`      📊 Total activos: ${activosConDatos + activosSinDatos}`);
  
  console.log(`\n   🔴 CANCELADOS (STATUS='C'):`);
  console.log(`      ✅ Con nombre/empresa: ${canceladosConDatos}`);
  console.log(`      ⚠️  Sin nombre/empresa: ${canceladosSinDatos}`);
  console.log(`      📊 Total cancelados: ${canceladosConDatos + canceladosSinDatos}`);
  
  let totalSubs = 0;
  bansMap.forEach(b => totalSubs += b.subscribers.length);
  console.log(`\n   📱 Total suscriptores: ${totalSubs}\n`);

  // Iniciar transacción
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('⏳ Transacción iniciada...\n');

    let clientsInserted = 0;
    let bansInserted = 0;
    let subsInserted = 0;

    for (const [banNumber, banData] of bansMap.entries()) {
      // 1. Insertar cliente
      const clientName = banData.razonSocial || `Cliente BAN ${banNumber}`;
      const clientResult = await client.query(
        `INSERT INTO clients (name, email, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [clientName, banData.email || null]
      );
      const clientId = clientResult.rows[0].id;
      clientsInserted++;

      // 2. Insertar BAN
      const banStatus = banData.status === 'A' ? 'activo' : 'inactivo';
      const banResult = await client.query(
        `INSERT INTO bans (client_id, number, status, created_at, last_updated)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [clientId, banNumber, banStatus]
      );
      const banId = banResult.rows[0].id;
      bansInserted++;

      // 3. Insertar suscriptores
      for (const sub of banData.subscribers) {
        const subStatus = sub.status === 'A' ? 'activo' : 'cancelado';
        await client.query(
          `INSERT INTO subscribers (ban_id, phone_number, status, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [banId, sub.phone, subStatus, `Plan: ${sub.plan} | Base: ${sub.base}`]
        );
        subsInserted++;
      }

      // Progress
      if (clientsInserted % 100 === 0) {
        process.stdout.write(`\r📈 Procesando: ${clientsInserted}/${bansMap.size} BANs...`);
      }
    }

    await client.query('COMMIT');
    console.log(`\n\n✅ IMPORTACIÓN COMPLETADA!\n`);
    console.log(`📊 Resultados:`);
    console.log(`   - Clientes creados: ${clientsInserted}`);
    console.log(`   - BANs insertados: ${bansInserted}`);
    console.log(`   - Suscriptores insertados: ${subsInserted}\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR durante importación:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // Verificación final
  console.log('🔍 Verificando importación...\n');
  const verification = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM clients) as clients,
      (SELECT COUNT(*) FROM bans) as bans,
      (SELECT COUNT(*) FROM bans WHERE status='activo') as bans_activos,
      (SELECT COUNT(*) FROM bans WHERE status='inactivo') as bans_cancelados,
      (SELECT COUNT(*) FROM subscribers) as subscribers,
      (SELECT COUNT(*) FROM subscribers WHERE status='activo') as subs_activos,
      (SELECT COUNT(*) FROM subscribers WHERE status='cancelado') as subs_cancelados
  `);

  const stats = verification.rows[0];
  console.log(`✅ VERIFICACIÓN FINAL:`);
  console.log(`   Clientes: ${stats.clients}`);
  console.log(`   BANs: ${stats.bans} (${stats.bans_activos} activos, ${stats.bans_cancelados} cancelados)`);
  console.log(`   Suscriptores: ${stats.subscribers} (${stats.subs_activos} activos, ${stats.subs_cancelados} cancelados)\n`);

  await pool.end();
}

importarTodoDesdeExcel().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
