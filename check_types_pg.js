
import { query } from './src/backend/database/db.js';

async function checkTypes() {
    try {
        console.log("Checking types...");

        const q1 = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscribers' AND column_name = 'phone_number'
        `);
        console.log("Subscribers phone_number type:", JSON.stringify(q1, null, 2));

        const q2 = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bans' AND column_name = 'number'
        `);
        console.log("Bans number type:", JSON.stringify(q2, null, 2));

    } catch (e) { console.error(e); }
}
checkTypes();
