
import { query } from './src/backend/database/db.js';

async function auditSchema() {
    try {
        console.log("🔍 AUDITORIA DE SCHEMA DE PRECISIÓN ABSOLUTA");

        const tables = ['bans', 'subscribers'];
        for (const table of tables) {
            console.log(`\n📋 Tabla: ${table}`);
            const res = await query(`
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns 
                WHERE table_name = '${table}'
                ORDER BY column_name
            `);
            res.forEach(r => {
                console.log(`   - ${r.column_name.padEnd(20)} | ${r.data_type} (${r.udt_name})`);
            });
        }
    } catch (e) { console.error(e); }
}

auditSchema();
