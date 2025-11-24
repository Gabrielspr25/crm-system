
import pg from 'pg';
const { Pool } = pg;
import XLSX from 'xlsx';
import fs from 'fs';

const pool = new Pool({
  user: 'crm_user',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
  ssl: false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Leyendo archivo Excel...');
    const filePath = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headers = data[0].map(h => String(h).toLowerCase());
    
    const nameIdx = headers.findIndex(h => h.includes('nombre'));
    const businessIdx = headers.findIndex(h => h.includes('razon social'));
    const banIdx = headers.findIndex(h => h.includes('ban'));
    const phoneIdx = headers.findIndex(h => h.includes('telefono') || h.includes('celular') || h.includes('movil'));
    const addressIdx = headers.findIndex(h => h.includes('direccion'));
    const cityIdx = headers.findIndex(h => h.includes('ciudad'));
    
    console.log('Indices:', { nameIdx, businessIdx, banIdx, phoneIdx });

    let insertedCount = 0;
    let skippedCount = 0;
    let existingCount = 0;

    console.log(`Procesando ${data.length - 1} filas...`);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = nameIdx >= 0 ? row[nameIdx] : '';
      const business = businessIdx >= 0 ? row[businessIdx] : '';
      const rawBan = banIdx >= 0 ? row[banIdx] : '';
      const phone = phoneIdx >= 0 ? row[phoneIdx] : '';
      const address = addressIdx >= 0 ? row[addressIdx] : '';
      const city = cityIdx >= 0 ? row[cityIdx] : '';

      let normalizedBan = null;
      if (rawBan) {
        normalizedBan = String(rawBan).trim().replace(/[^0-9]/g, '').slice(0, 9);
        if (!normalizedBan || normalizedBan.length === 0) normalizedBan = null;
      }

      // Solo nos interesan los que NO tienen nombre NI empresa, pero SI tienen BAN
      if (!normalizedBan) continue; // Si no hay BAN, no es el caso que buscamos
      if (name || business) {
        // Si tiene nombre o empresa, ya debió ser importado. Lo saltamos.
        continue;
      }

      // Verificar si el BAN ya existe
      const banCheck = await client.query('SELECT id FROM bans WHERE ban_number = $1', [normalizedBan]);
      if (banCheck.rows.length > 0) {
        existingCount++;
        continue;
      }

      // INSERTAR
      try {
        await client.query('BEGIN');

        // 1. Crear Cliente (Usando BAN como nombre)
        const clientName = normalizedBan; // El usuario pidió usar el BAN
        const newClient = await client.query(
          `INSERT INTO clients (name, address, city, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, 1, NOW(), NOW())
           RETURNING id`,
          [clientName, address, city]
        );
        const clientId = newClient.rows[0].id;

        // 2. Crear BAN
        const newBan = await client.query(
          `INSERT INTO bans (client_id, ban_number, status, created_at, updated_at)
           VALUES ($1, $2, 'Activo', NOW(), NOW())
           RETURNING id`,
          [clientId, normalizedBan]
        );
        const banId = newBan.rows[0].id;

        // 3. Crear Suscriptor (si hay teléfono)
        if (phone) {
           let cleanPhone = String(phone).replace(/[^0-9]/g, '');
           if (cleanPhone.length > 0) {
             await client.query(
               `INSERT INTO subscribers (ban_id, phone, is_active, created_at, updated_at)
                VALUES ($1, $2, 1, NOW(), NOW())`,
               [banId, cleanPhone]
             );
           }
        }

        await client.query('COMMIT');
        insertedCount++;
        if (insertedCount % 100 === 0) process.stdout.write('.');

      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error en fila ${i + 1}:`, err.message);
      }
    }

    console.log('\n--- RESUMEN ---');
    console.log(`Insertados (Faltantes): ${insertedCount}`);
    console.log(`Ya existían (BAN): ${existingCount}`);
    console.log('Proceso terminado.');

  } catch (err) {
    console.error('Error global:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
