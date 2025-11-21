import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
});

// Eventos del pool
pool.on('connect', () => {
    // console.log('📦 Base de datos conectada');
});

pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de base de datos:', err);
    process.exit(-1);
});

/**
 * Ejecuta una consulta a la base de datos
 * @param {string} text - Query SQL
 * @param {any[]} params - Parámetros de la query
 * @returns {Promise<any[]>} - Filas resultantes
 */
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Log de queries lentas (> 1s)
        if (duration > 1000) {
            console.warn(`⚠️ Query lenta (${duration}ms): ${text}`);
        }
        return res.rows;
    } catch (error) {
        console.error(`❌ Error en query: ${text}`, error);
        throw error;
    }
};

/**
 * Obtiene un cliente del pool para transacciones
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
    const client = await pool.connect();
    return client;
};

export default pool;
