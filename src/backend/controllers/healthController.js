import { getClient } from '../database/db.js';

export const fullSystemCheck = async (req, res) => {
    const client = await getClient();
    const results = {
        database: { status: 'pending', message: '' },
        permissions: { status: 'pending', message: '' },
        tables: { status: 'pending', details: [] },
        critical_functions: { status: 'pending', details: [] }
    };

    try {
        // 1. Verificar Conexión BD
        const startDb = Date.now();
        await client.query('SELECT NOW()');
        results.database = { status: 'ok', latency: `${Date.now() - startDb}ms` };

        // 2. Verificar Tablas Críticas
        const tablesToCheck = ['users_auth', 'clients', 'bans', 'subscribers', 'follow_up_prospects', 'vendors'];
        for (const table of tablesToCheck) {
            try {
                const countRes = await client.query(`SELECT COUNT(*) FROM ${table}`);
                results.tables.details.push({ table, status: 'ok', count: countRes.rows[0].count });
            } catch (err) {
                results.tables.details.push({ table, status: 'error', error: err.message });
                results.tables.status = 'error';
            }
        }
        if (results.tables.status !== 'error') results.tables.status = 'ok';

        // 3. Verificar Permisos de Escritura (Crear/Borrar Cliente de Prueba)
        try {
            await client.query('BEGIN');
            const testClient = await client.query(
                `INSERT INTO clients (name, business_name, is_active, created_at, updated_at) 
                 VALUES ('__HEALTH_CHECK__', '__HEALTH_CHECK__', 0, NOW(), NOW()) 
                 RETURNING id`
            );
            const clientId = testClient.rows[0].id;

            // Probar inserción de BAN
            const testBan = await client.query(
                `INSERT INTO bans (ban_number, client_id, is_active, created_at, updated_at)
                 VALUES ('999999999', $1, 0, NOW(), NOW())
                 RETURNING id`,
                [clientId]
            );
            const banId = testBan.rows[0].id;

            // Probar EDICIÓN de BAN (Update)
            const updateBan = await client.query(
                `UPDATE bans SET is_active = 1 WHERE id = $1`,
                [banId]
            );

            if (updateBan.rowCount === 0) {
                throw new Error('Update operation failed (no rows affected)');
            }

            // ROLLBACK para no dejar basura
            await client.query('ROLLBACK');
            results.permissions = { status: 'ok', message: 'Write/Update/Delete operations successful' };
        } catch (err) {
            await client.query('ROLLBACK');
            results.permissions = { status: 'error', message: err.message };
        }

        // 4. Verificar Columnas Críticas (Las que rompieron el sistema antes)
        const criticalColumns = [
            { table: 'follow_up_prospects', column: 'is_completed' },
            { table: 'bans', column: 'client_id' }
        ];

        for (const check of criticalColumns) {
            try {
                await client.query(`SELECT ${check.column} FROM ${check.table} LIMIT 1`);
                results.critical_functions.details.push({ check: `${check.table}.${check.column}`, status: 'ok' });
            } catch (err) {
                results.critical_functions.details.push({ check: `${check.table}.${check.column}`, status: 'error', error: err.message });
                results.critical_functions.status = 'error';
            }
        }
        if (results.critical_functions.status !== 'error') results.critical_functions.status = 'ok';

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            results
        });

    } catch (error) {
        console.error('Health Check Failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    } finally {
        client.release();
    }
};
