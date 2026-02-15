const { Pool } = require('pg');

// CRM Producción
const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function revisarCRM() {
  try {
    console.log('🔍 REVISANDO CRM - subscriber_reports\n');

    // 1. Total de reportes
    const totalQuery = `
      SELECT 
        COUNT(*) as total_reportes,
        MIN(report_month) as fecha_mas_antigua,
        MAX(report_month) as fecha_mas_reciente,
        SUM(company_earnings) as total_comision_claro,
        SUM(vendor_commission) as total_comision_vendedor
      FROM subscriber_reports
    `;
    const total = await crmPool.query(totalQuery);
    console.log('📊 TOTALES EN subscriber_reports:');
    console.table(total.rows);

    if (parseInt(total.rows[0].total_reportes) === 0) {
      console.log('\n✅ La tabla subscriber_reports está VACÍA. No hay nada que borrar.');
      return;
    }

    // 2. Reportes por mes
    console.log('\n📅 DISTRIBUCIÓN POR MES:');
    const porMesQuery = `
      SELECT 
        TO_CHAR(report_month, 'YYYY-MM') as mes,
        COUNT(*) as reportes,
        SUM(company_earnings) as comision_claro,
        SUM(vendor_commission) as comision_vendedor
      FROM subscriber_reports
      GROUP BY TO_CHAR(report_month, 'YYYY-MM')
      ORDER BY mes DESC
    `;
    const porMes = await crmPool.query(porMesQuery);
    console.table(porMes.rows);

    // 3. Reportes por vendedor
    console.log('\n👤 REPORTES POR VENDEDOR (top 10):');
    const porVendedorQuery = `
      SELECT 
        s.name as vendedor,
        COUNT(sr.id) as reportes,
        SUM(sr.company_earnings) as comision_claro,
        SUM(sr.vendor_commission) as comision_vendedor
      FROM subscriber_reports sr
      JOIN subscribers sub ON sr.subscriber_id = sub.id
      JOIN bans b ON sub.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      JOIN salespeople s ON c.salesperson_id = s.id
      GROUP BY s.id, s.name
      ORDER BY reportes DESC
      LIMIT 10
    `;
    const porVendedor = await crmPool.query(porVendedorQuery);
    console.table(porVendedor.rows);

    // 4. Sample de 5 reportes
    console.log('\n📄 SAMPLE 5 REPORTES MÁS RECIENTES:');
    const sampleQuery = `
      SELECT 
        sr.id,
        sr.report_month,
        s.name as vendedor,
        c.name as cliente,
        sr.company_earnings,
        sr.vendor_commission,
        sr.created_at
      FROM subscriber_reports sr
      JOIN subscribers sub ON sr.subscriber_id = sub.id
      JOIN bans b ON sub.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      JOIN salespeople s ON c.salesperson_id = s.id
      ORDER BY sr.created_at DESC
      LIMIT 5
    `;
    const sample = await crmPool.query(sampleQuery);
    console.table(sample.rows);

    // 5. Ofrecer borrado
    console.log('\n⚠️  OPCIONES DE LIMPIEZA:');
    console.log('   A) Borrar TODO (TRUNCATE subscriber_reports)');
    console.log('   B) Borrar por rango de fechas');
    console.log('   C) Borrar por vendedor específico');
    console.log('\n   Usa script: limpiar-crm-reports.cjs con opción elegida\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await crmPool.end();
  }
}

revisarCRM();
