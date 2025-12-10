
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://crm_user:CRM_Seguro_2025!@localhost:5432/crm_pro',
});

async function checkPhone() {
  const phone = '699805535';
  console.log(`Checking phone: ${phone}`);

  try {
    // Check subscribers
    const subRes = await pool.query(`
      SELECT s.*, b.ban_number, c.name as client_name, c.id as client_id
      FROM subscribers s
      LEFT JOIN bans b ON s.ban_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE s.phone LIKE $1
    `, [`%${phone}%`]);

    console.log('--- Subscribers found ---');
    if (subRes.rows.length === 0) {
        console.log('No subscriber found with this phone.');
    } else {
        subRes.rows.forEach(row => {
            console.log(JSON.stringify(row, null, 2));
        });
    }

    // Check if it exists in any other way (maybe in client phone?)
    const clientRes = await pool.query(`
        SELECT * FROM clients WHERE phone LIKE $1 OR mobile_phone LIKE $1 OR secondary_phone LIKE $1
    `, [`%${phone}%`]);

    console.log('--- Clients found with this phone ---');
    if (clientRes.rows.length === 0) {
        console.log('No client found with this phone as contact.');
    } else {
        clientRes.rows.forEach(row => {
            console.log(JSON.stringify(row, null, 2));
        });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPhone();
