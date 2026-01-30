
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
    database: 'crm_pro'
});

async function updateSchema() {
    try {
        console.log('--- Iniciando Actualización de Schema para Formato Completo ---');

        // BANS
        const banCols = [
            { name: 'account_type', type: 'VARCHAR(100)' },
            { name: 'ban_start_service', type: 'DATE' },
            { name: 'tipo_factura', type: 'VARCHAR(100)' }
        ];

        for (const col of banCols) {
            await pool.query(`ALTER TABLE bans ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            console.log(`Bans: Columna ${col.name} asegurada.`);
        }

        // SUBSCRIBERS
        const subCols = [
            { name: 'plan', type: 'VARCHAR(255)' }, // Renombramos internamente o aseguramos
            { name: 'monthly_value', type: 'NUMERIC(10,2)' },
            { name: 'issue_date', type: 'DATE' },
            { name: 'product_type', type: 'VARCHAR(100)' },
            { name: 'product_class', type: 'VARCHAR(100)' },
            { name: 'bl_complt_date', type: 'DATE' },
            { name: 'def_credit_amt', type: 'NUMERIC(10,2)' },
            { name: 'port_ind', type: 'VARCHAR(10)' },
            { name: 'data_soc', type: 'VARCHAR(100)' },
            { name: 'imsi', type: 'VARCHAR(50)' },
            { name: 'tipo_celuseguro', type: 'VARCHAR(100)' },
            { name: 'operator_id', type: 'VARCHAR(100)' },
            { name: 'operator_name', type: 'VARCHAR(255)' },
            { name: 'item_id', type: 'VARCHAR(100)' },
            { name: 'item_description', type: 'TEXT' },
            { name: 'precio', type: 'NUMERIC(10,2)' }
        ];

        for (const col of subCols) {
            await pool.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            console.log(`Subscribers: Columna ${col.name} asegurada.`);
        }

        console.log('✅ SCHEMA ACTUALIZADO EXITOSAMENTE');
        await pool.end();
    } catch (err) {
        console.error('❌ ERROR AL ACTUALIZAR:', err.message);
        process.exit(1);
    }
}

updateSchema();
