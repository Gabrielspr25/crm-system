import pkg from 'pg';
const { Pool } = pkg;
import { v4 as uuidv4 } from 'uuid';

// Conexión DIRECTA al servidor de producción
const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!'
});

async function restoreFerreteria() {
    const client = await pool.connect();
    try {
        console.log('🔄 Restaurando FERRETERIA COMERCIAL...\n');

        // Buscar el vendedor GABRIEL
        const vendorResult = await client.query(
            "SELECT id FROM salespeople WHERE LOWER(name) LIKE '%gabriel%' LIMIT 1"
        );

        if (vendorResult.rows.length === 0) {
            console.log('❌ No se encontró el vendedor GABRIEL');
            return;
        }

        const vendorId = vendorResult.rows[0].id;
        console.log(`✅ Vendedor encontrado: ${vendorId}\n`);

        // Crear el cliente
        const clientId = uuidv4();
        await client.query(`
            INSERT INTO clients (id, name, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
        `, [clientId, 'FERRETERIA COMERCIAL']);
        console.log(`✅ Cliente creado: FERRETERIA COMERCIAL (${clientId})`);

        // Crear el BAN
        const banId = uuidv4();
        await client.query(`
            INSERT INTO bans (id, client_id, ban_number, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [banId, clientId, '1234567890', 'A']);
        console.log(`✅ BAN creado: ${banId}`);

        // Crear 1 subscriber (Móvil Renovación)
        const subId = uuidv4();
        await client.query(`
            INSERT INTO subscribers (id, ban_id, phone, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
        `, [subId, banId, '7871234567']);
        console.log(`✅ Subscriber creado: ${subId}`);

        // Buscar el producto "Móvil Renovación"
        const productResult = await client.query(
            "SELECT id FROM products WHERE LOWER(name) LIKE '%movil%ren%' OR LOWER(name) LIKE '%móvil%ren%' LIMIT 1"
        );

        let productId = null;
        if (productResult.rows.length > 0) {
            productId = productResult.rows[0].id;
        }

        // Crear el prospect en follow_up
        const prospectId = uuidv4();
        await client.query(`
            INSERT INTO follow_up_prospects (
                id, client_id, vendor_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, NOW(), NOW())
        `, [prospectId, clientId, vendorId]);
        console.log(`✅ Prospect creado en follow_up: ${prospectId}`);

        console.log('\n✅ FERRETERIA COMERCIAL restaurada exitosamente');
        console.log('📊 Datos: 1 Móvil Renovación');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

restoreFerreteria();
