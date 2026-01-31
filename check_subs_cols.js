
import { query } from './src/backend/database/db.js';

async function checkSubsCols() {
    try {
        console.log("Checking subscribers table columns...");
        const result = await query("SELECT * FROM subscribers LIMIT 1");
        if (result.length > 0) {
            console.log("Columns:", Object.keys(result[0]));
        } else {
            console.log("No rows, checking schema...");
            const schema = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'");
            console.log(schema.map(r => r.column_name));
        }
    } catch (e) { console.error(e); }
}
checkSubsCols();
