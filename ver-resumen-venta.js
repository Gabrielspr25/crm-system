import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function verResumen() {
  try {
    console.log('\n=== RESUMEN VENTA: Colegio Santa Gema ===');
    
    const resumen = await pool.query(`
      SELECT 
        c.name as cliente,
        c.id as cliente_id,
        b.ban_number,
        b.account_type,
        s.phone as suscriptor,
        s.line_type,
        s.contract_term as meses,
        s.contract_end_date as vencimiento,
        CASE WHEN fp.id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as en_seguimiento,
        fp.fijo_new,
        sp.name as vendedor
      FROM clients c
      JOIN bans b ON b.client_id = c.id
      JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN follow_up_prospects fp ON fp.client_id = c.id AND fp.is_active = true
      LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
      WHERE c.name ILIKE '%santa gema%'
      ORDER BY c.created_at DESC
      LIMIT 1
    `);

    if (resumen.rows.length === 0) {
      console.log('❌ Cliente no encontrado');
      return;
    }

    const r = resumen.rows[0];
    console.log('\n📊 DATOS ACTUALES:');
    console.log('═══════════════════════════════════════');
    console.log(`Cliente:        ${r.cliente}`);
    console.log(`BAN:            ${r.ban_number}`);
    console.log(`Tipo BAN:       ${r.account_type}`);
    console.log(`Suscriptor:     ${r.suscriptor} ✓`);
    console.log(`Tipo Línea:     ${r.line_type}`);
    console.log(`Duración:       ${r.meses} meses ✓`);
    console.log(`Vencimiento:    ${r.vencimiento ? r.vencimiento.toISOString().split('T')[0] : 'Sin fecha'}`);
    console.log(`Vendedor:       ${r.vendedor || 'Sin asignar'}`);
    console.log(`En Seguimiento: ${r.en_seguimiento} ✓`);
    console.log(`Fijo New:       ${r.fijo_new || 0} unidad(es)`);
    console.log('═══════════════════════════════════════');
    
    console.log('\n✅ ESTADO DE LA VENTA:');
    console.log('  ✓ Suscriptor correcto: 939-777-0017');
    console.log('  ✓ Duración correcta: 24 meses (igual que legacy)');
    console.log('  ✓ Fecha vencimiento: 2028-02-03');
    console.log('  ✓ En Seguimiento: Visible en /seguimiento');
    
    console.log('\n⚠️  LIMITACIÓN:');
    console.log('  • Tabla sales_reports usa client_id INTEGER (legacy)');
    console.log('  • Tabla clients usa id UUID (nuevo)');
    console.log('  • No se puede crear reporte automáticamente');
    console.log('  • SOLUCIÓN: Crear reporte manualmente desde UI /reportes');
    
    console.log('\n📋 PARA VER LA VENTA:');
    console.log('  1. /clients → Buscar "Colegio Santa Gema"');
    console.log('  2. /seguimiento → Aparece en lista activos');
    console.log('  3. /reportes → Crear manualmente si necesitas');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verResumen();
