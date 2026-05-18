// Reset password del usuario admin.
// Uso (NO hardcodear nunca la password):
//   NEW_ADMIN_PASS='mi-password' node reset_admin_pass.mjs
//   NEW_ADMIN_PASS='mi-password' ADMIN_USERNAME='gabriel' node reset_admin_pass.mjs
//
// Lee credenciales de BD desde .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
// Falla con mensaje claro si falta NEW_ADMIN_PASS — nunca usa default.

import pg from 'pg';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
config();

const newPassword = process.env.NEW_ADMIN_PASS;
const targetUsername = process.env.ADMIN_USERNAME || 'admin';

if (!newPassword || newPassword.length < 6) {
    console.error('ERROR: variable NEW_ADMIN_PASS requerida (mínimo 6 caracteres).');
    console.error('Uso: NEW_ADMIN_PASS="tu-password" node reset_admin_pass.mjs');
    process.exit(1);
}

if (!process.env.DB_HOST || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('ERROR: faltan variables DB_HOST / DB_PASSWORD / DB_NAME en .env');
    process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 5,
    idleTimeoutMillis: 30000,
    ssl: false,
});

async function resetAdminPassword() {
    const client = await pool.connect();
    try {
        const hashed = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        const result = await client.query(
            `UPDATE users_auth SET password = $1 WHERE username = $2`,
            [hashed, targetUsername]
        );
        if (result.rowCount === 0) {
            console.error(`No se encontró usuario '${targetUsername}' en users_auth`);
            process.exit(2);
        }
        console.log(`Password actualizada para '${targetUsername}' (${result.rowCount} fila).`);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

resetAdminPassword();
