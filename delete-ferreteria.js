import pkg from 'pg';
const { Pool } = pkg;

// Conexión DIRECTA al servidor de producción
const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!'
});

async function deleteFerreteria() {
    const client = await pool.connect();
    try {
        console.log('🗑️  Conectando a servidor de producción...\n');

        // Buscar el cliente
        const clientResult = await client.query(
            "SELECT id, name FROM clients WHERE LOWER(name) LIKE '%ferreteria%comercial%' OR LOWER(name) LIKE '%ferreteria comercial%'"
        );

        if (clientResult.rows.length === 0) {
            console.log('❌ No se encontró FERRETERIA COMERCIAL en producción');
            return;
        }

        const clientId = clientResult.rows[0].id;
        const clientName = clientResult.rows[0].name;

        console.log(`✅ Cliente encontrado: ${clientName} (ID: ${clientId})\n`);

        // Primero eliminar subscribers (tienen FK a bans)
        const deleteSubs = await client.query(
            'DELETE FROM subscribers WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1) RETURNING id',
            [clientId]
        );
        console.log(`🗑️  Eliminados ${deleteSubs.rowCount} subscribers`);

        // Luego eliminar BANs
        const deleteBans = await client.query(
            'DELETE FROM bans WHERE client_id = $1 RETURNING id',
            [clientId]
        );
        console.log(`🗑️  Eliminados ${deleteBans.rowCount} BANs`);

        // Eliminar de follow_up_prospects
        const deleteProspects = await client.query(
            'DELETE FROM follow_up_prospects WHERE client_id = $1 RETURNING id',
            [clientId]
        );
        console.log(`🗑️  Eliminados ${deleteProspects.rowCount} registros de follow_up_prospects`);

        // Finalmente eliminar el cliente
        const deleteClient = await client.query(
            'DELETE FROM clients WHERE id = $1 RETURNING name',
            [clientId]
        );
        console.log(`🗑️  Eliminado cliente: ${deleteClient.rows[0].name}`);

        console.log('\n✅ FERRETERIA COMERCIAL eliminada completamente');
        console.log('📋 Ahora puedes cargar el Excel de nuevo para probar la actualización');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteFerreteria();
