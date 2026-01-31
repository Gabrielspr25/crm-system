
import { query } from './src/backend/database/db.js';

async function logBansColumns() {
    try {
        const result = await query("SELECT * FROM bans LIMIT 1");
        if (result.length > 0) {
            console.log("Coludmns in bans:", Object.keys(result[0]));
        } else {
            console.log("No rows in bans, checking schema...");
            const schema = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bans'");
            console.log(schema.map(r => r.column_name));
        }
    } catch (e) { console.error(e); }
}
logBansColumns();
