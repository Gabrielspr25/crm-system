
import pg from 'pg';
const { Pool } = pg;

// Usando las nuevas credenciales de administrador proporcionadas
const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    database: 'postgres', // Base de datos por defecto para el usuario postgres
    user: 'postgres',
    password: 'p0stmu7t1',
    ssl: false
});

async function migrateSchema() {
    const client = await pool.connect();
    try {
        // Primero, verificar si la base de datos crm_pro existe o si trabajamos sobre postgres
        const dbRes = await client.query("SELECT datname FROM pg_database WHERE datname = 'crm_pro'");

        if (dbRes.rows.length > 0) {
            console.log('📡 Base de datos crm_pro encontrada. Reconectando...');
            await client.release();
            await pool.end();

            const crmPool = new Pool({
                host: '159.203.70.5',
                port: 5432,
                database: 'crm_pro',
                user: 'postgres',
                password: 'p0stmu7t1',
                ssl: false
            });

            const crmClient = await crmPool.connect();
            try {
                await crmClient.query('BEGIN');

                console.log('🧱 Actualizando schema en crm_pro...');

                await crmClient.query(`
          ALTER TABLE subscribers 
          ADD COLUMN IF NOT EXISTS imei VARCHAR(50),
          ADD COLUMN IF NOT EXISTS init_activation_date DATE,
          ADD COLUMN IF NOT EXISTS effective_date DATE,
          ADD COLUMN IF NOT EXISTS subscriber_name_remote VARCHAR(255),
          ADD COLUMN IF NOT EXISTS activity_code VARCHAR(50);
        `);

                await crmClient.query(`
          ALTER TABLE bans 
          ADD COLUMN IF NOT EXISTS dealer_code VARCHAR(50),
          ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(255),
          ADD COLUMN IF NOT EXISTS reason_desc TEXT,
          ADD COLUMN IF NOT EXISTS sub_status_report VARCHAR(100);
        `);

                await crmClient.query('COMMIT');
                console.log('✅ Migración remota completada con ÉXITO (Admin).');
            } finally {
                crmClient.release();
                await crmPool.end();
            }
        } else {
            console.log('⚠️ La base de datos crm_pro no existe en este host. Verificando tablas en base actual...');
            // Listar tablas para entender el contexto
            const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log('Tablas encontradas:', tables.rows.map(r => r.table_name).join(', '));
        }
    } catch (error) {
        console.error('❌ Error crítico en la migración:', error);
    } finally {
        // Asegurarse de cerrar todo si no se cerró antes
        try { client.release(); } catch (e) { }
        try { await pool.end(); } catch (e) { }
    }
}

migrateSchema();
