const { Pool } = require('pg');

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

// Mapeo manual entre salespeople names y vendors names
const VENDOR_MAP = {
  'Gabriel Sanchez': 'GABRIEL',
  'ANEUDY': 'ANEUDY',
  'DAYANA': 'DAYANA',
  'HERNAN': 'HERNAN',
  'MAYRA': 'MAYRA',
  'RANDY': 'RANDY',
  'YARITZA': 'YARITZA',
  'maira': 'maira'
};

async function syncAllProspects() {
  try {
    // Get all vendors with id mapping
    const vendorsResult = await pool.query('SELECT id, name FROM vendors');
    const vendorIdMap = {};
    vendorsResult.rows.forEach(v => {
      vendorIdMap[v.name.toUpperCase()] = v.id;
    });
    
    console.log('Vendors disponibles:', vendorIdMap);
    
    // Get all prospects without vendor but with client
    const prospectsResult = await pool.query(`
      SELECT 
        fup.id as prospect_id,
        fup.company_name,
        fup.vendor_id,
        c.name as client_name,
        sp.name as salesperson_name
      FROM follow_up_prospects fup
      INNER JOIN clients c ON fup.client_id = c.id
      INNER JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE fup.vendor_id IS NULL
      ORDER BY fup.id
    `);
    
    console.log(`\n📋 Encontrados ${prospectsResult.rows.length} prospectos sin vendor\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const prospect of prospectsResult.rows) {
      const vendorName = VENDOR_MAP[prospect.salesperson_name];
      
      if (!vendorName) {
        console.log(`⚠️ [ID ${prospect.prospect_id}] ${prospect.company_name} - Salesperson "${prospect.salesperson_name}" no tiene mapeo`);
        skipped++;
        continue;
      }
      
      const vendorId = vendorIdMap[vendorName.toUpperCase()];
      
      if (!vendorId) {
        console.log(`⚠️ [ID ${prospect.prospect_id}] ${prospect.company_name} - Vendor "${vendorName}" no existe en BD`);
        skipped++;
        continue;
      }
      
      // Update prospect
      await pool.query(`
        UPDATE follow_up_prospects 
        SET vendor_id = $1 
        WHERE id = $2
      `, [vendorId, prospect.prospect_id]);
      
      console.log(`✅ [ID ${prospect.prospect_id}] ${prospect.company_name} -> Vendor ${vendorName} (ID ${vendorId})`);
      updated++;
    }
    
    console.log(`\n=== RESUMEN ===`);
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️ Omitidos: ${skipped}`);
    console.log(`📊 Total: ${prospectsResult.rows.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

syncAllProspects();
