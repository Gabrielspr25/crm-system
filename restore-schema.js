import fs from 'fs';
import pg from 'pg';
import path from 'path';

const config = {
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
    host: 'localhost',
    port: 5432,
    database: 'crm_pro'
};

const schemaPath = path.resolve('elementos_extra/sqls/schema-final.sql');

async function restoreSchema() {
    const pool = new pg.Pool(config);
    try {
        console.log('📖 Leyendo schema-final.sql...');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Ejecutando restauración de schema...');
        await pool.query(sql);

        console.log('✅ Restauración completada exitosamente.');
        console.log('✅ Las tablas clients, bans, subscribers y salespeople han sido creadas.');
    } catch (e) {
        console.error('❌ Error restaurando schema:', e);
    } finally {
        await pool.end();
    }
}

restoreSchema();
