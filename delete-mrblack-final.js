import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || '143.244.191.139',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'crm_pro',
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD
});

async function deleteMrBlackSale() {
    const client = await pool.connect();
    try {
        console.log('🗑️  Eliminando venta de prueba de MR BLACK INC...\n');

        // Buscar el cliente
        const clientResult = await client.query(
            "SELECT id, name FROM clients WHERE LOWER(name) LIKE '%mr black%' OR LOWER(name) LIKE '%mrblack%'"
        );

        if (clientResult.rows.length === 0) {
            console.log('❌ No se encontró el cliente MR BLACK INC');
            return;
        }

        const clientId = clientResult.rows[0].id;
        const clientName = clientResult.rows[0].name;

        console.log(`✅ Cliente encontrado: ${clientName} (ID: ${clientId})\n`);

        // Eliminar de follow_up_prospects
        const deleteProspects = await client.query(
            'DELETE FROM follow_up_prospects WHERE client_id = $1 RETURNING id',
            [clientId]
        );

        console.log(`🗑️  Eliminados ${deleteProspects.rowCount} registros de follow_up_prospects`);

        // Eliminar BANs asociados
        const deleteBans = await client.query(
            'DELETE FROM bans WHERE client_id = $1 RETURNING id',
            [clientId]
        );

        console.log(`🗑️  Eliminados ${deleteBans.rowCount} BANs`);

        // Eliminar subscribers asociados
        const deleteSubs = await client.query(
            'DELETE FROM subscribers WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1) RETURNING id',
            [clientId]
        );

        console.log(`🗑️  Eliminados ${deleteSubs.rowCount} subscribers`);

        console.log('\n✅ Venta de prueba eliminada correctamente');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteMrBlackSale();
