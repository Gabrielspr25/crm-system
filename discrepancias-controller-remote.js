import { Pool } from 'pg';

// Pool para base de datos remota (legacy)
const remotePool = new Pool({
    host: '167.99.12.125',
    port: 5432,
    user: 'postgres',
    password: 'fF00JIRFXc',
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

// Pool para base de datos local
const localPool = new Pool({
    host: '104.236.211.88',
    port: 5432,
    user: 'postgres',
    password: 'Gaby0824@a',
    database: 'control360',
    connectionTimeoutMillis: 10000,
    ssl: false
});

const success = (res, data = null, message = 'Operación exitosa') => {
    res.status(200).json({
        success: true,
        message,
        data
    });
};

const serverError = (res, error, message = 'Error interno del servidor') => {
    console.error('❌ Server Error:', error);
    res.status(500).json({ 
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
};

const badRequest = (res, message = 'Solicitud incorrecta') => {
    res.status(400).json({
        success: false,
        message
    });
};

export const getDiscrepancias = async (req, res) => {
    try {
        console.log('🔍 [DISCREPANCIAS] Iniciando análisis de discrepancias...');
        
        // Obtener datos locales de clientes
        const localClients = await localPool.query('SELECT id, name, tax_id, email FROM clients WHERE is_active = 1');
        console.log(`🔍 [DISCREPANCIAS] ${localClients.rows.length} clientes locales obtenidos`);

        // Obtener datos remotos
        console.log('🔍 [DISCREPANCIAS] Conectando a BD remota 167.99.12.125:5432...');
        const startTime = Date.now();
        const remoteRes = await remotePool.query('SELECT clientecreditoid, nombre, segurosocial, email FROM clientecredito LIMIT 1000');
        const queryTime = Date.now() - startTime;
        console.log(`🔍 [DISCREPANCIAS] Query remota completada en ${queryTime}ms, ${remoteRes.rows.length} registros obtenidos`);

        const discrepancias = [];
        
        // Comparar por Tax ID / Seguro Social
        for (const local of localClients.rows) {
            if (!local.tax_id) continue;
            
            const remote = remoteRes.rows.find(r => r.segurosocial === local.tax_id);
            
            if (remote) {
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

        success(res, {
            count: discrepancias.length,
            data: discrepancias
        }, 'Análisis completado');
        
    } catch (error) {
        console.error('Error en getDiscrepancias:', error);
        serverError(res, error, 'Error al obtener discrepancias');
    }
};

export const syncDiscrepancia = async (req, res) => {
    const { id, action, entity, field, value } = req.body;
    
    if (!id || !action) {
        return badRequest(res, 'Faltan parámetros requeridos');
    }
    
    try {
        const clientId = id.split('-').pop();
        
        if (action === 'remote_to_local') {
            await localPool.query(
                `UPDATE clients SET ${field} = $1 WHERE id = $2`,
                [value, clientId]
            );
            
            success(res, null, `Cliente ${clientId} actualizado localmente`);
        } else if (action === 'local_to_remote') {
            await remotePool.query(
                `UPDATE clientecredito SET ${field} = $1 WHERE clientecreditoid = $2`,
                [value, clientId]
            );
            
            success(res, null, `Cliente ${clientId} actualizado remotamente`);
        } else {
            return badRequest(res, 'Acción no válida');
        }
    } catch (error) {
        console.error('Error en syncDiscrepancia:', error);
        serverError(res, error, 'Error al sincronizar discrepancia');
    }
};

export const compareExcelAgainstDB = async (req, res) => {
    try {
        const { data, mode = 'remote' } = req.body;
        
        if (!data || !Array.isArray(data)) {
            return badRequest(res, 'No se enviaron datos para comparar');
        }
        
        const discrepancies = [];
        
        for (const row of data) {
            const excelSub = row.Suscriptores || {};
            const excelBan = row.BANs || {};
            const phone = String(excelSub.phone || '').trim();
            const banNumber = String(excelBan.ban_number || '').trim();
            
            if (!phone) continue;
            
            let dbData = null;
            let type = 'VALUE_MISMATCH';
            
            if (mode === 'remote') {
                try {
                    console.log(`🔍 [REMOTE DB] Conectando a 167.99.12.125:5432 para buscar teléfono: ${phone}, BAN: ${banNumber}`);
                    const startTime = Date.now();
                    const remoteRes = await remotePool.query(`
                        SELECT
                        fechaactivacion as fecha,
                            ban,
                            numerocelularactivado as suscriber,
                            NULL as nombre,
                            codigovoz as codigo_voz,
                            NULL as valor,
                            simcard as simcard,
                            emai as imei,
                            NULL as seguro,
                            pricecode as price_code
                            FROM venta
                            WHERE numerocelularactivado = $1 OR ban = $2
                            LIMIT 1
                            `, [phone, banNumber]);
                    
                    const queryTime = Date.now() - startTime;
                    console.log(`🔍 [REMOTE DB] Query completada en ${queryTime}ms, resultados: ${remoteRes.rows.length}`);
                    
                    if (remoteRes.rows.length === 0) {
                        discrepancies.push({
                            phone,
                            type: 'MISSING_IN_REMOTE',
                            severity: 'high',
                            details: 'No se encontró registro en el servidor remoto (venta)',
                            excelData: row
                        });
                        continue;
                    }
                    dbData = remoteRes.rows[0];
                } catch (err) {
                    console.error('Error querying remote DB:', err);
                    continue;
                }
            }
            
            const rowDiffs = [];
            
            if (mode === 'remote' && dbData) {
                // Comparar campos específicos
                if (banNumber && String(dbData.ban).trim() !== banNumber) {
                    rowDiffs.push({ field: 'BAN', excel: banNumber, db: dbData.ban });
                }
                
                const excelImei = String(excelSub.imei || '').trim();
                const dbImei = String(dbData.imei || '').trim();
                if (excelImei && dbImei && excelImei !== dbImei) {
                    rowDiffs.push({ field: 'IMEI', excel: excelImei, db: dbImei });
                }
                
                const excelPriceCode = String(excelSub.price_code || '').trim();
                const dbPriceCode = String(dbData.price_code || '').trim();
                if (excelPriceCode && dbPriceCode && excelPriceCode !== dbPriceCode) {
                    rowDiffs.push({ field: 'Price Code', excel: excelPriceCode, db: dbPriceCode });
                }
            }
            
            if (rowDiffs.length > 0 || mode === 'remote') {
                discrepancies.push({
                    phone,
                    client: dbData?.client_name || dbData?.phone,
                    type: rowDiffs.length > 0 ? 'VALUE_MISMATCH' : 'MATCH',
                    severity: rowDiffs.length > 0 ? 'medium' : 'low',
                    differences: rowDiffs,
                    excelData: row,
                    dbData: dbData
                });
            }
        }
        
        success(res, {
            totalAnalyzed: data.length,
            totalDiscrepancies: discrepancies.length,
            discrepancies,
            mode
        }, 'Comparación completada exitosamente');
        
    } catch (error) {
        console.error('Error en compareExcelAgainstDB:', error);
        serverError(res, error, 'Error al procesar la comparación manual');
    }
};

export const syncRemoteData = async (req, res) => {
    try {
        const { changes } = req.body;
        
        if (!changes || !Array.isArray(changes)) {
            return badRequest(res, 'No se enviaron cambios para sincronizar');
        }
        
        const results = {
            total: changes.length,
            updated: 0,
            failed: 0,
            errors: []
        };
        
        for (const row of changes) {
            try {
                let finalDate = row.activation_date;
                if (finalDate && !isNaN(Date.parse(finalDate))) {
                    finalDate = new Date(finalDate).toISOString().split('T')[0];
                } else {
                    finalDate = null;
                }
                
                const updateRes = await remotePool.query(`
                    UPDATE venta
                    SET
                    ban = $1,
                        emai = $2,
                        pricecode = $3,
                        fechaactivacion = $4,
                        simcard = $5
                    WHERE numerocelularactivado = $6
                        `, [
                    String(row.ban || '').trim(),
                    String(row.imei || '').trim(),
                    String(row.plan || '').trim(),
                    finalDate,
                    String(row.imsi || '').trim(),
                    String(row.phone || '').trim()
                ]);
                
                if (updateRes.rowCount > 0) {
                    results.updated++;
                } else {
                    results.failed++;
                    results.errors.push(`No se encontró registro para el teléfono ${row.phone} en Producción`);
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Error en ${row.phone}: ${err.message}`);
                console.error(`Error syncing ${row.phone} to remote: `, err);
            }
        }
        
        success(res, results, 'Proceso de sincronización remota finalizado');
    } catch (error) {
        console.error('Error general en syncRemoteData:', error);
        serverError(res, error, 'Error crítico al intentar sincronizar con Producción');
    }
};