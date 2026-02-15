import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function generateCSV() {
  console.log('Generando CSV de duplicados...\n');

  const duplicates = await pool.query(`
    SELECT 
      UPPER(TRIM(name)) as nombre_normalizado,
      COUNT(*) as cantidad_duplicados,
      array_agg(id::text ORDER BY created_at) as client_ids
    FROM clients
    WHERE name IS NOT NULL AND TRIM(name) != ''
    GROUP BY UPPER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, UPPER(TRIM(name))
  `);

  let csvRows = [];
  csvRows.push('Num,Nombre Cliente,Cantidad Duplicados,Registro,ID,Fecha Creación,Vendedor,BANs,BANs Números,Suscriptores,Valor Mensual,En Seguimiento,Recomendación');

  let num = 1;
  for (const dup of duplicates.rows) {
    const details = await pool.query(`
      SELECT 
        c.id,
        c.name as nombre_original,
        c.created_at,
        c.salesperson_id,
        sp.name as salesperson_name,
        COUNT(DISTINCT b.id) as total_bans,
        array_agg(DISTINCT b.ban_number ORDER BY b.ban_number) FILTER (WHERE b.ban_number IS NOT NULL) as ban_numbers,
        COUNT(DISTINCT s.id) as total_subscribers,
        COALESCE(SUM(s.monthly_value), 0) as total_monthly_value,
        EXISTS(SELECT 1 FROM follow_up_prospects fup WHERE fup.client_id = c.id) as en_seguimiento
      FROM clients c
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN bans b ON b.client_id = c.id
      LEFT JOIN subscribers s ON s.ban_id = b.id
      WHERE c.id = ANY($1::uuid[])
      GROUP BY c.id, c.name, c.created_at, c.salesperson_id, sp.name
      ORDER BY c.created_at
    `, [dup.client_ids]);

    // Análisis
    const todosSinDatos = details.rows.every(r => r.total_bans === 0 && r.total_subscribers === 0);
    const conDatos = details.rows.filter(r => r.total_bans > 0 || r.total_subscribers > 0);
    
    let recomendacion = '';
    if (todosSinDatos) {
      recomendacion = 'ELIMINAR TODOS MENOS EL MÁS ANTIGUO';
    } else if (conDatos.length === 1) {
      recomendacion = `MANTENER ${conDatos[0].id.substring(0, 8)} Y ELIMINAR VACÍOS`;
    } else if (conDatos.length > 1) {
      recomendacion = 'REQUIERE FUSIÓN MANUAL';
    }

    details.rows.forEach((reg, idx) => {
      const row = [
        num,
        `"${dup.nombre_normalizado.replace(/"/g, '""')}"`,
        dup.cantidad_duplicados,
        idx + 1,
        reg.id,
        new Date(reg.created_at).toISOString().split('T')[0],
        `"${(reg.salesperson_name || 'SIN ASIGNAR').replace(/"/g, '""')}"`,
        reg.total_bans,
        `"${reg.ban_numbers?.join('; ') || 'NINGUNO'}"`,
        reg.total_subscribers,
        parseFloat(reg.total_monthly_value).toFixed(2),
        reg.en_seguimiento ? 'SÍ' : 'NO',
        idx === 0 ? `"${recomendacion}"` : ''
      ];
      csvRows.push(row.join(','));
    });

    num++;
  }

  const csvContent = csvRows.join('\n');
  fs.writeFileSync('DUPLICADOS-COMPARACION-2026-02-06.csv', csvContent, 'utf8');
  
  console.log(`✅ CSV generado: DUPLICADOS-COMPARACION-2026-02-06.csv`);
  console.log(`📊 Total de nombres duplicados: ${duplicates.rows.length}`);
  console.log(`📄 Total de filas en CSV: ${csvRows.length - 1}\n`);

  await pool.end();
}

generateCSV();
