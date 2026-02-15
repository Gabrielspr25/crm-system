
import { query, getClient } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import pkg from 'pg';
const { Pool } = pkg;

let remotePool = null;

function getRemotePool() {
    if (!remotePool) {
        console.log('🔍 [REMOTE POOL] Creando nuevo pool de conexión a 159.203.70.5:5432...');
        remotePool = new Pool({
            host: '159.203.70.5',
            port: 5432,
            user: 'postgres',
            password: 'p0stmu7t1',
            database: 'claropr',
            connectionTimeoutMillis: 15000,
            query_timeout: 30000,
            statement_timeout: 30000,
            ssl: false,
            max: 5,
            idleTimeoutMillis: 30000
        });

        remotePool.on('error', (err) => {
            console.error('🔍 [REMOTE POOL] Error en pool:', err);
        });
    }
    return remotePool;
}

export const getDiscrepancias = async (req, res) => {
    try {
        console.log('🔍 [DISCREPANCIAS] Iniciando análisis de discrepancias...');
        const poolRemoto = getRemotePool();
        console.log('🔍 [DISCREPANCIAS] Pool remoto obtenido');

        // 1. Obtener datos locales (ejemplo con clientes)
        console.log('🔍 [DISCREPANCIAS] Obteniendo datos locales...');
        const localClients = await query('SELECT id, name, tax_id, email FROM clients WHERE is_active = 1');
        console.log(`🔍 [DISCREPANCIAS] ${localClients.length} clientes locales obtenidos`);

        // 2. Obtener datos remotos
        console.log('🔍 [DISCREPANCIAS] Conectando a BD remota 159.203.70.5:5432...');
        const startTime = Date.now();
        const remoteRes = await poolRemoto.query('SELECT clientecreditoid, nombre, segurosocial, email FROM clientecredito LIMIT 1000');
        const queryTime = Date.now() - startTime;
        console.log(`🔍 [DISCREPANCIAS] Query remota completada en ${queryTime}ms, ${remoteRes.rows.length} registros obtenidos`);
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
        // Extraer el ID de cliente del formato "field-id"
        const clientId = id.split('-').pop();

        if (action === 'remote_to_local') {
            // Actualizar base de datos local con valor remoto
            await query(
                `UPDATE clients SET ${field} = $1 WHERE id = $2`,
                [value, clientId]
            );

            res.json({
                success: true,
                message: `Cliente ${clientId} actualizado localmente`
            });
        } else if (action === 'local_to_remote') {
            // Actualizar base de datos remota
            const poolRemoto = getRemotePool();
            await poolRemoto.query(
                `UPDATE clientecredito SET ${field} = $1 WHERE clientecreditoid = $2`,
                [value, clientId]
            );

            res.json({
                success: true,
                message: `Cliente ${clientId} actualizado remotamente`
            });
        } else {
            return badRequest(res, 'Acción no válida');
        }
    } catch (error) {
        serverError(res, error, 'Error al sincronizar discrepancia');
    }
};

export const compareExcel = async (req, res) => {
    try {
        console.log('🔍 [COMPARE-EXCEL] Iniciando comparación...');
        const { data, mode } = req.body;

        if (!data || !Array.isArray(data)) {
            return badRequest(res, 'Datos inválidos');
        }

        console.log(`🔍 [COMPARE-EXCEL] Comparando ${data.length} registros con BD multicellular`);

        const poolRemoto = getRemotePool();
        const discrepancies = [];

        // 1. Extract all phones and generate candidates (10 and 11 digits)
        const phoneMap = new Map(); // Map normalized (10-digit) phone -> original row
        const candidates = new Set();
        const phonesToQuery = []; // Keep for valid check

        for (const row of data) {
            const phone = row.Suscriptores?.phone;
            if (phone) {
                const phoneClean = String(phone).replace(/\D/g, '').slice(-10); // always 10 chars for normalization
                phoneMap.set(phoneClean, row);
                phonesToQuery.push(phoneClean);

                // Add candidates for DB lookup (numeric matching)
                if (phoneClean.length === 10) {
                    candidates.add(phoneClean); // "787..."
                    candidates.add('1' + phoneClean); // "1787..."
                }
            }
        }

        if (candidates.size === 0) {
            return res.json({ success: true, data: { discrepancies: [], total: 0, analyzed: 0 } });
        }

        // 2. Bulk Query using Index (numerocelularactivado is bigint/numeric)
        // We cast the input array to bigint[] to force usage of the index on numerocelularactivado
        const candidateArray = Array.from(candidates);

        console.log(`🔍 [COMPARE-EXCEL] Buscando ${candidateArray.length} candidatos (10 y 11 dígitos) usando índice...`);

        const remoteQuery = `
            SELECT 
                v.fechaactivacion as fecha,
                v.ban,
                CAST(v.numerocelularactivado AS text) as suscriber,
                c.nombre,
                v.simcard,
                v.emai as imei,
                CASE WHEN v.papper THEN 'SI' ELSE 'NO' END as paper,
                CASE WHEN v.celuseguroexistente THEN 'SI' ELSE 'NO' END as seguro,
                v.pricecode as price_code
            FROM venta v
            LEFT JOIN clientecredito c ON v.clientecreditoid = c.clientecreditoid
            WHERE v.numerocelularactivado = ANY($1::bigint[])
            LIMIT 2000
        `;

        const remoteRes = await poolRemoto.query(remoteQuery, [candidateArray]);
        const dbResults = remoteRes.rows;

        // 3. Match results in memory
        for (const row of data) {
            const phone = row.Suscriptores?.phone;
            const ban = row.BANs?.ban_number;

            if (!phone) continue;

            const phoneClean = String(phone).replace(/\D/g, '').slice(-10);

            // Find matching db row
            // We need to be careful with "LIKE" matching. 
            const dbData = dbResults.find(dbRow => {
                if (!dbRow.suscriber) return false;
                return String(dbRow.suscriber).endsWith(phoneClean);
            });

            if (!dbData) {
                discrepancies.push({
                    phone: phone,
                    type: 'MISSING_IN_REMOTE',
                    dbData: null
                });
            } else {
                const differences = [];

                // Comparar TODOS los campos
                const excelData = {
                    ban: ban || '',
                    imei: row.Suscriptores?.imei || '',
                    price_code: row.Suscriptores?.price_code || '',
                    imsi: row.Suscriptores?.imsi || '',
                    nombre: row.Suscriptores?.nombre || '',
                    tipo_factura: row.Suscriptores?.tipo_factura || '',
                    tipo_celuseguro: row.Suscriptores?.tipo_celuseguro || ''
                };

                // Comparar cada campo
                if (excelData.ban && dbData.ban && excelData.ban !== String(dbData.ban)) {
                    differences.push({ field: 'BAN', excel: excelData.ban, db: dbData.ban });
                }
                if (excelData.imei && dbData.imei && excelData.imei !== String(dbData.imei)) {
                    differences.push({ field: 'IMEI', excel: excelData.imei, db: dbData.imei });
                }
                if (excelData.price_code && dbData.price_code && excelData.price_code !== String(dbData.price_code)) {
                    differences.push({ field: 'PRICE_CODE', excel: excelData.price_code, db: dbData.price_code });
                }
                if (excelData.tipo_factura && dbData.paper && excelData.tipo_factura !== String(dbData.paper)) {
                    differences.push({ field: 'PAPER', excel: excelData.tipo_factura, db: dbData.paper });
                }
                if (excelData.tipo_celuseguro && dbData.seguro && excelData.tipo_celuseguro !== String(dbData.seguro)) {
                    differences.push({ field: 'SEGURO', excel: excelData.tipo_celuseguro, db: dbData.seguro });
                }

                if (differences.length > 0) {
                    discrepancies.push({
                        phone: phone,
                        type: 'MISMATCH',
                        differences: differences,
                        dbData: dbData
                    });
                } else {
                    discrepancies.push({
                        phone: phone,
                        type: 'MATCH',
                        dbData: dbData
                    });
                }
            }
        }

        console.log(`🔍 [COMPARE-EXCEL] Comparación completada. ${discrepancies.length} resultados`);

        res.json({
            success: true,
            data: {
                discrepancies: discrepancies,
                total: data.length,
                analyzed: discrepancies.length
            }
        });

    } catch (error) {
        console.error('🔍 [COMPARE-EXCEL] Error:', error);
        serverError(res, error, 'Error al comparar Excel');
    }
};

export const updateRow = async (req, res) => {
    try {
        const { phone, data } = req.body;

        if (!phone || !data) {
            return badRequest(res, 'Faltan parámetros');
        }

        console.log(`🔍 [UPDATE-ROW] Actualizando registro para teléfono: ${phone}`);

        const poolRemoto = getRemotePool();
        const phoneClean = String(phone).replace(/\D/g, '').slice(-10);

        // Construir UPDATE dinámicamente
        const updates = [];
        const values = [];
        let paramIndex = 1;

        const fieldMapping = {
            'fecha': 'fechaactivacion',
            'ban': 'ban',
            'simcard': 'simcard',
            'imei': 'emai',
            'price_code': 'pricecode',
            'paper': 'papper',      // boolean: SI/NO -> true/false
            'seguro': 'celuseguroexistente'  // boolean: SI/NO -> true/false
        };

        for (const [key, value] of Object.entries(data)) {
            const dbColumn = fieldMapping[key];
            if (dbColumn && value !== undefined && value !== 'Cargando...') {
                // Convertir SI/NO a boolean para campos booleanos
                let finalValue = value;
                if (key === 'paper' || key === 'seguro') {
                    finalValue = String(value).toUpperCase() === 'SI';
                }
                updates.push(`${dbColumn} = $${paramIndex}`);
                values.push(finalValue);
                paramIndex++;
            }
        }

        if (updates.length === 0) {
            return badRequest(res, 'No hay campos para actualizar');
        }

        values.push(phoneClean);

        const updateQuery = `
            UPDATE venta 
            SET ${updates.join(', ')}
            WHERE CAST(numerocelularactivado AS text) LIKE '%' || $${paramIndex}
        `;

        console.log(`🔍 [UPDATE-ROW] Query:`, updateQuery);
        console.log(`🔍 [UPDATE-ROW] Values:`, values);

        const result = await poolRemoto.query(updateQuery, values);

        console.log(`🔍 [UPDATE-ROW] Filas actualizadas: ${result.rowCount}`);

        res.json({
            success: true,
            message: `Registro actualizado (${result.rowCount} fila(s))`,
            rowsAffected: result.rowCount
        });

    } catch (error) {
        console.error('🔍 [UPDATE-ROW] Error:', error);
        serverError(res, error, 'Error al actualizar registro');
    }
};

