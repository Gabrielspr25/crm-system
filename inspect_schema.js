
import { query } from './src/backend/database/db.js';

async function inspectSchema() {
    try {
        console.log("Inspecting 'bans' table columns...");
        const result = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bans'
        `);
        console.log(JSON.stringify(result, null, 2));

        console.log("\nInspecting 'subscribers' table columns...");
        const resultSub = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscribers'
        `);
        console.log(JSON.stringify(resultSub, null, 2));

    } catch (error) {
        console.error("Error executing query:", error);
    }
}

inspectSchema();
