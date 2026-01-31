
import { query } from './src/backend/database/db.js';

async function verifyClientsQuery() {
    try {
        console.log("1. Checking 'clients' columns...");
        const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'");
        const colNames = cols.map(c => c.column_name);
        console.log("Clients columns:", colNames);

        console.log("\n2. Checking 'follow_up_prospects' table...");
        const tableCheck = await query("SELECT to_regclass('public.follow_up_prospects')");
        console.log("Table exists:", tableCheck[0].to_regclass);

        console.log("\n3. Testing FULL getClients Query...");
        // This is the query from clientController.js (v242)
        const sql = `
            SELECT c.*,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND b.status = 'A') as active_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id AND b.status = 'C') as cancelled_ban_count,
            (SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id) as ban_count,
            (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as active_subscriber_count,
            (SELECT COUNT(*) FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as subscriber_count,
            (SELECT string_agg(s.phone_number, ', ') FROM subscribers s JOIN bans b ON s.ban_id = b.id WHERE b.client_id = c.id) as subscriber_phones,
            (
                SELECT json_agg(json_build_object('ban_number', b.number, 'phone', s.phone_number, 'status', s.status))
                FROM bans b
                JOIN subscribers s ON s.ban_id = b.id
                WHERE b.client_id = c.id
            ) as subscribers_detail,
            (SELECT string_agg(CAST(b.number AS text), ', ') FROM bans b WHERE b.client_id = c.id) as ban_numbers,
            (SELECT COUNT(*) > 0 FROM bans b WHERE b.client_id = c.id) as has_bans,
            (SELECT COUNT(*) > 0 FROM bans b WHERE b.client_id = c.id AND b.status = 'C') as has_cancelled_bans
       FROM clients c 
       WHERE EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id AND b.status = 'A')
                            AND (c.name IS NOT NULL AND c.name != '' AND c.name != 'NULL')
       ORDER BY c.created_at DESC
       LIMIT 5
        `;

        const result = await query(sql);
        console.log(`\n✅ Query Success! Retrieved ${result.length} rows.`);
        if (result.length > 0) {
            console.log("Sample Data (Subscribers Detail):");
            console.log(JSON.stringify(result[0].subscribers_detail, null, 2));
        }

    } catch (error) {
        console.error("\n❌ Query Failed:", error.message);
        if (error.detail) console.error("Detail:", error.detail);
        if (error.hint) console.error("Hint:", error.hint);
    }
}

verifyClientsQuery();
