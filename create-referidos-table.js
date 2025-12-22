import pool from './src/backend/database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createTable = async () => {
    try {
        const schemaPath = path.join(__dirname, 'referidos_app', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Ejecutando script SQL...');
        await pool.query(schemaSql);
        console.log('✅ Tabla referidos creada exitosamente.');
    } catch (error) {
        console.error('❌ Error creando la tabla:', error);
    } finally {
        await pool.end();
    }
};

createTable();
