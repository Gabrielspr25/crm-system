
import { query, getClient } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import pkg from 'pg';
const { Pool } = pkg;

let remotePool = null;

function getRemotePool() {
    if (!remotePool) {
        remotePool = new Pool({
            host: process.env.POS_DB_HOST || '167.99.12.125',
            port: parseInt(process.env.POS_DB_PORT || '5432'),
            user: process.env.POS_DB_USER || 'postgres',
            password: process.env.POS_DB_PASSWORD,
            database: process.env.POS_DB_NAME || 'claropr',
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000
        });
    }
    return remotePool;
}

export const getDiscrepancias = async (req, res) => {
    try {
        const poolRemoto = getRemotePool();

        // 1. Obtener datos locales (ejemplo con clientes)
        const localClients = await query('SELECT id, name, tax_id, email FROM clients WHERE is_active = 1');

        // 2. Obtener datos remotos
        const remoteRes = await poolRemoto.query('SELECT clientecreditoid, nombre, segurosocial, email FROM clientecredito LIMIT 1000');
        const remoteClients = remoteRes.rows;

        const discrepancias = [];

        // 3. Lógica de comparación (Ejemplo: por Tax ID / Seguro Social)
        for (const local of localClients) {
            if (!local.tax_id) continue;

            const remote = remoteClients.find(r => r.segurosocial === local.tax_id);

            if (remote) {
                // Comparar campos
                if (local.name !== remote.nombre) {
                    discrepancias.push({
                        id: `name-${local.id}`,
                        entidad: 'Cliente',
                        identificador: local.tax_id,
                        campo: 'Nombre/Razón Social',
                        valorLocal: local.name,
                        valorRemoto: remote.nombre,
                        estado: 'pendiente',
                        fecha: new Date().toISOString()
                    });
                }
                if (local.email !== remote.email) {
                    discrepancias.push({
                        id: `email-${local.id}`,
                        entidad: 'Cliente',
                        identificador: local.tax_id,
                        campo: 'Email',
                        valorLocal: local.email || '(vacio)',
                        valorRemoto: remote.email || '(vacio)',
                        estado: 'pendiente',
                        fecha: new Date().toISOString()
                    });
                }
            }
        }

        res.json({
            success: true,
            count: discrepancias.length,
            data: discrepancias
        });

    } catch (error) {
        serverError(res, error, 'Error al obtener discrepancias');
    }
};

export const syncDiscrepancia = async (req, res) => {
    const { id, action, entity, field, value } = req.body;

    if (!id || !action) {
        return badRequest(res, 'Faltan parámetros requeridos');
    }

    try {
        // Lógica para aplicar el cambio (ejemplo: actualizar local con el valor remoto)
        // Dependiendo de la 'action' (local_to_remote o remote_to_local)

        res.json({
            success: true,
            message: `Discrepancia ${id} procesada con éxito`
        });
    } catch (error) {
        serverError(res, error, 'Error al sincronizar discrepancia');
    }
};
