const { Pool } = require('pg');
async function main() {
  const crm = new Pool({ host: '143.244.191.139', port: 5432, user: 'crm_user', password: 'CRM_Seguro_2025!', database: 'crm_pro' });
  const tango = new Pool({ host: '167.99.12.125', port: 5432, user: 'postgres', password: 'fF00JIRFXc', database: 'claropr' });

  const ban = '784175066';

  const crmRes = await crm.query(`
    SELECT s.phone, s.line_type, s.status, s.created_at, b.activation_date, b.account_type, c.name as cliente
    FROM subscribers s
    JOIN bans b ON b.id = s.ban_id
    JOIN clients c ON c.id = b.client_id
    WHERE b.ban_number = $1
    ORDER BY s.created_at
  `, [ban]);
  console.log('CRM Subscribers (BAN ' + ban + '):');
  console.table(crmRes.rows);

  const tangoRes = await tango.query(`
    SELECT v.ventaid, v.ban, v.status as linea, v.fechaactivacion, v.activo, vt.nombre as tipo,
           COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
           COALESCE(vd.nombre, 'SIN VENDEDOR') as vendedor,
           COALESCE(v.nota, '') as notas
    FROM venta v
    JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
    LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
    LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
    WHERE v.ban = $1
    ORDER BY v.fechaactivacion
  `, [ban]);
  console.log('\nTango Ventas (BAN ' + ban + '):');
  console.table(tangoRes.rows);

  await crm.end(); await tango.end();
}
main().catch(e => { console.error(e); process.exit(1); });
