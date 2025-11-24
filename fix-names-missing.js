
import pg from 'pg';
const { Pool } = pg;
import XLSX from 'xlsx';

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
    console.log('Leyendo archivo Excel para identificar los 1340 registros...');
    const filePath = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headers = data[0].map(h => String(h).toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('nombre'));
    const businessIdx = headers.findIndex(h => h.includes('razon social'));
    const banIdx = headers.findIndex(h => h.includes('ban'));

    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = nameIdx >= 0 ? row[nameIdx] : '';
      const business = businessIdx >= 0 ? row[businessIdx] : '';
      const rawBan = banIdx >= 0 ? row[banIdx] : '';

      let normalizedBan = null;
      if (rawBan) {
        normalizedBan = String(rawBan).trim().replace(/[^0-9]/g, '').slice(0, 9);
        if (!normalizedBan || normalizedBan.length === 0) normalizedBan = null;
      }

      if (!normalizedBan) continue;
      if (name || business) continue;

      // Encontramos uno de los 1340.
      // Buscar su ID de cliente
      const res = await client.query(`
        SELECT c.id as client_id
        FROM bans b 
        JOIN clients c ON b.client_id = c.id 
        WHERE b.ban_number = $1
      `, [normalizedBan]);

      if (res.rows.length > 0) {
        const clientId = res.rows[0].client_id;
        // Actualizar nombre al BAN
        await client.query(`
          UPDATE clients 
          SET name = $1, business_name = '', updated_at = NOW()
          WHERE id = $2
        `, [normalizedBan, clientId]);
        updatedCount++;
        if (updatedCount % 100 === 0) process.stdout.write('.');
      }
    }

    console.log(`\nActualizados ${updatedCount} clientes para usar solo el BAN como nombre.`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
