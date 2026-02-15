import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function verificarJohannaMota() {
    try {
        console.log('\n🔍 ANÁLISIS: JOHANNA MOTA DESPUÉS DE FUSIÓN\n');
        console.log('=' .repeat(80));

        // Buscar el cliente JOHANNA MOTA
        const clientResult = await pool.query(`
            SELECT id, name, created_at, salesperson_id
            FROM clients
            WHERE UPPER(TRIM(name)) = 'JOHANNA MOTA'
        `);

        if (clientResult.rows.length === 0) {
            console.log('❌ No se encontró cliente JOHANNA MOTA');
            return;
        }

        const client = clientResult.rows[0];
        console.log(`📋 Cliente: ${client.name}`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Creado: ${new Date(client.created_at).toLocaleString()}`);
        console.log(`   Vendedor: ${client.salesperson_id || 'SIN ASIGNAR'}`);

        // Obtener todos los BANs de JOHANNA MOTA
        const bansResult = await pool.query(`
            SELECT 
                b.id as ban_id,
                b.ban_number,
                b.status,
                b.created_at,
                (SELECT COUNT(*) FROM subscribers s WHERE s.ban_id = b.id) as subscriber_count
            FROM bans b
            WHERE b.client_id = $1
            ORDER BY b.ban_number
        `, [client.id]);

        console.log(`\n📞 BANs: ${bansResult.rows.length} total\n`);

        let activos = 0;
        let cancelados = 0;
        let sinEstado = 0;

        for (const ban of bansResult.rows) {
            const status = ban.status ? ban.status.toUpperCase() : null;
            let statusLabel = 'SIN ESTADO';
            
            if (status === 'A' || status === 'ACTIVO') {
                statusLabel = '✅ ACTIVO';
                activos++;
            } else if (status === 'C' || status === 'CANCELADO' || status === 'INACTIVO') {
                statusLabel = '❌ CANCELADO';
                cancelados++;
            } else {
                sinEstado++;
            }

            console.log(`   BAN ${ban.ban_number} | ${statusLabel}`);
            console.log(`      Suscriptores: ${ban.subscriber_count}`);
            console.log(`      Creado: ${new Date(ban.created_at).toLocaleString()}`);

            // Ver suscriptores de este BAN
            const subsResult = await pool.query(`
                SELECT phone, monthly_value
                FROM subscribers
                WHERE ban_id = $1
                ORDER BY phone
            `, [ban.ban_id]);

            if (subsResult.rows.length > 0) {
                for (const sub of subsResult.rows) {
                    console.log(`         📱 ${sub.phone} | $${sub.monthly_value || 0}/mes`);
                }
            }
            console.log('');
        }

        console.log('=' .repeat(80));
        console.log('📊 RESUMEN DE BANs:');
        console.log(`   ✅ Activos:    ${activos}`);
        console.log(`   ❌ Cancelados: ${cancelados}`);
        console.log(`   ⚪ Sin estado: ${sinEstado}`);
        console.log('=' .repeat(80));

        if (activos > 0 && cancelados > 0) {
            console.log('\n⚠️  PROBLEMA DETECTADO:');
            console.log('   Este cliente tiene BANs ACTIVOS Y CANCELADOS mezclados.');
            console.log('   Esto puede causar problemas en la lógica de negocio que separa');
            console.log('   clientes activos vs cancelados en tabs diferentes.\n');
            console.log('💡 OPCIONES:');
            console.log('   1. Mantener así (un cliente puede tener ambos estados)');
            console.log('   2. Separar BANs cancelados en otro cliente');
            console.log('   3. Cambiar lógica de tabs para filtrar por BANs no por clientes\n');
        } else {
            console.log('\n✅ Este cliente tiene solo BANs de un tipo (todo activo o todo cancelado).\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

verificarJohannaMota();
