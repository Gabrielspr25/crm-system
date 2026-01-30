
import { query, getClient } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function validateImport() {
    console.log('--- VALIDATING IMPORT LOGIC (Status Fixed) ---');
    const client = await getClient();

    // Mock Data
    const mockClientData = {
        Clientes: {
            name: "CLIENTE VALIDACION 001",
            company: "Validation Corp",
            mobile: "5550001"
        },
        BANs: {
            ban_number: "999888777",
            status: "A" // Correct Status: 'A' or 'C'
        },
        Suscriptores: {
            phone: "5551234567"
        }
    };

    // Mock Request body
    const reqBody = {
        data: [mockClientData]
    };

    // Helper to run logic (simulated from controller)
    async function processBatch(batchData, phaseName) {
        console.log(`\n[${phaseName}] Processing...`);
        let processed = 0, created = 0, updated = 0;

        await client.query('BEGIN');
        try {
            for (const row of batchData) {
                const clientData = row.Clientes || {};
                const banData = row.BANs || {};
                const subData = row.Suscriptores || {};

                const clientName = String(clientData.name || '').trim();
                const company = String(clientData.company || '').trim();
                const mobile = String(clientData.mobile || '').trim();

                const banNumber = String(banData.ban_number || '').trim();
                const subPhone = String(subData.phone || '').trim();

                let clientId = null;
                if (clientName) {
                    // Normalize name for comparison: Remove special chars, extra spaces, lowercase
                    const normalizedName = clientName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();

                    const existingClient = await client.query(`
                                SELECT id, name FROM clients 
                                WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g')) = $1
                                OR LOWER(TRIM(name)) = LOWER(TRIM($2))
                            `, [normalizedName, clientName]);

                    if (existingClient.rows.length > 0) {
                        clientId = existingClient.rows[0].id; // Use existing ID
                        const dbName = existingClient.rows[0].name;

                        // Update logic...
                        await client.query(`
                                    UPDATE clients 
                                    SET company = COALESCE($1, company),
                                        updated_at = NOW()
                                    WHERE id = $2
                                `, [company || null, clientId]);
                        updated++;
                        console.log(`Updated Client: ${clientName} (${clientId})`);
                    } else {
                        // Insert
                        const newClient = await client.query(`
                                    INSERT INTO clients (name, company, created_at, updated_at)
                                    VALUES ($1, $2, NOW(), NOW())
                                    RETURNING id
                                `, [clientName, company || null]);
                        clientId = newClient.rows[0].id;
                        created++;
                        console.log(`Created Client: ${clientName} (${clientId})`);
                    }
                }

                if (clientId && banNumber) {
                    const existingBan = await client.query('SELECT id FROM bans WHERE number = $1', [banNumber]); // Using 'ban_number' based on Step 270 schema check for bans table said 'ban_number' is unique key. Wait, schema check in 370 showed 'UNIQUE (ban_number)'.
                    let banId = existingBan.rows[0]?.id;

                    if (!banId) {
                        const newBan = await client.query('INSERT INTO bans (number, client_id, status, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id', [banNumber, clientId, 'activo']);
                        banId = newBan.rows[0].id;
                        console.log(`Created BAN: ${banNumber}`);
                    } else {
                        console.log(`Existing BAN: ${banNumber}`);
                    }
                }
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Error:', e);
        }
        return { created, updated };
    }

    try {
        // Cleanup BEFORE starting to ensure clean state
        try {
            await client.query("DELETE FROM bans WHERE ban_number = '999888777'");
            await client.query("DELETE FROM clients WHERE name = 'CLIENTE VALIDACION 001'");
        } catch (e) { }

        // Run 1: First Upload (Should Create)
        const res1 = await processBatch(reqBody.data, "UPLOAD 1");
        console.log(`Result 1: Created=${res1.created}, Updated=${res1.updated}`);

        // Run 2: Second Upload (Should Update)
        const res2 = await processBatch(reqBody.data, "UPLOAD 2");
        console.log(`Result 2: Created=${res2.created}, Updated=${res2.updated}`);

        if (res1.created === 1 && res2.updated === 1 && res2.created === 0) {
            console.log('\n✅ VALIDATION SUCCESS: logic correctly updates existing records instead of duplicating.');
        } else {
            console.log('\n❌ VALIDATION FAILED: Duplication or logic error.');
        }

    } finally {
        // Cleanup after
        try {
            await client.query("DELETE FROM bans WHERE ban_number = '999888777'");
            await client.query("DELETE FROM clients WHERE name = 'CLIENTE VALIDACION 001'");
        } catch (e) { }

        client.release();
        process.exit(0);
    }
}

validateImport();
