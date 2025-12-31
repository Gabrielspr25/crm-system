import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD,
});

async function checkData() {
  try {
    console.log('--- BUSCANDO CLIENTE "TECH WEB..." ---');
    const clientRes = await pool.query(`
      SELECT id, name, business_name, created_at 
      FROM clients 
      WHERE business_name ILIKE '%TECH WEB%' OR name ILIKE '%TECH WEB%'
    `);
    
    if (clientRes.rows.length > 0) {
      console.log('✅ Clientes encontrados:');
      console.table(clientRes.rows);
    } else {
      console.log('❌ No se encontró el cliente "TECH WEB..."');
    }

    console.log('\n--- BUSCANDO BAN "841786385" ---');
    const banRes = await pool.query(`
      SELECT id, ban_number, client_id, status 
      FROM bans 
      WHERE ban_number = '841786385'
    `);

    if (banRes.rows.length > 0) {
      console.log('✅ BAN encontrado:');
      console.table(banRes.rows);
    } else {
      console.log('❌ No se encontró el BAN "841786385"');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkData();