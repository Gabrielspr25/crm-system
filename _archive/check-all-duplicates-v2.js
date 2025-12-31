
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: 'localhost',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function checkDuplicates() {
  console.log('🔍 Checking for duplicates in follow_up_prospects...');

  try {
    // 1. Get all completed prospects
    const res = await pool.query(`
      SELECT id, company_name, client_id, created_at, total_amount 
      FROM follow_up_prospects 
      WHERE is_completed = true
    `);
    
    const prospects = res.rows;
    console.log(`📊 Total completed prospects: ${prospects.length}`);

    // 2. Find duplicates by company_name
    const nameMap = {};
    const idMap = {};
    const duplicates = [];

    prospects.forEach(p => {
      // Check Name
      const name = p.company_name?.trim().toLowerCase();
      if (name) {
        if (nameMap[name]) {
          duplicates.push({ type: 'NAME', original: nameMap[name], duplicate: p });
        } else {
          nameMap[name] = p;
        }
      }

      // Check Client ID
      const clientId = p.client_id;
      if (clientId) {
        if (idMap[clientId]) {
           // Avoid double reporting if name matched too
           if (!duplicates.find(d => d.duplicate.id === p.id && d.type === 'NAME')) {
             duplicates.push({ type: 'CLIENT_ID', original: idMap[clientId], duplicate: p });
           }
        } else {
          idMap[clientId] = p;
        }
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found by company_name or client_id.');
    } else {
      console.log(`⚠️ Found ${duplicates.length} duplicates!`);
      duplicates.forEach((d, index) => {
        console.log(`\nDuplicate #${index + 1} [${d.type}]: "${d.original.company_name}" vs "${d.duplicate.company_name}"`);
        console.log(`   Original (ID: ${d.original.id}): ClientID: ${d.original.client_id}`);
        console.log(`   Duplicate (ID: ${d.duplicate.id}): ClientID: ${d.duplicate.client_id}`);
      });
    }
  } catch (err) {
    console.error('❌ Error executing query', err);
  } finally {
    await pool.end();
  }
}

checkDuplicates();
