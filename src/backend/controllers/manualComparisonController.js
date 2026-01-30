
import pg from 'pg';
const { Pool } = pg;
import { query as localQuery } from '../database/db.js';
import { success, serverError } from '../utils/responses.js';

// Pool remoto para Auditoría Pro
const remotePool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    connectionTimeoutMillis: 10000
});

/**
 * Compara datos de un Excel contra la base de datos (Local o Remota)
 */
export const compareExcelAgainstDB = async (req, res) => {
    try {
        const { data, mode = 'local' } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: 'No se enviaron datos para comparar' });
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
                // --- COMPARACIÓN CONTRA SERVIDOR REMOTO (PRODUCCIÓN) ---
                try {
                    const remoteRes = await remotePool.query(`
                        SELECT 
                            fechaactivacion as fecha,
                            ban,
                            numerocelularactivado as suscriber,
                            nombre,
                            codigovoz as codigo_voz,
                            valor,
                            imsi as simcard,
                            emai as imei,
                            producttype as seguro,
                            pricecode as price_code
                        FROM venta
                        WHERE numerocelularactivado = $1 OR ban = $2
                        LIMIT 1
                    `, [phone, banNumber]);

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
                    continue; // Saltar si hay error de red/acceso
                }
            } else {
                // --- COMPARACIÓN CONTRA BASE DE DATOS LOCAL ---
                const localRes = await localQuery(`
                    SELECT 
                        s.phone, s.plan, s.monthly_value, s.status as status_activation, s.imei,
                        b.ban_number, b.account_type,
                        c.name as client_name
                    FROM subscribers s
                    JOIN bans b ON s.ban_id = b.id
                    JOIN clients c ON b.client_id = c.id
                    WHERE s.phone = $1
                `, [phone]);

                if (localRes.length === 0) {
                    discrepancies.push({
                        phone,
                        type: 'MISSING_IN_LOCAL',
                        severity: 'high',
                        details: 'Suscriptor no existe en la base de datos local',
                        excelData: row
                    });
                    continue;
                }
                dbData = localRes[0];
            }

            const rowDiffs = [];

            if (mode === 'remote') {
                // Comparación específica para Remoto (Tabla Venta)

                // 1. BAN
                if (banNumber && String(dbData.ban).trim() !== banNumber) {
                    rowDiffs.push({ field: 'BAN', excel: banNumber, db: dbData.ban });
                }

                // 2. IMEI
                const excelImei = String(excelSub.imei || '').trim();
                const dbImei = String(dbData.imei || '').trim();
                if (excelImei && dbImei && excelImei !== dbImei) {
                    rowDiffs.push({ field: 'IMEI', excel: excelImei, db: dbImei });
                }

                // 3. Price Code
                const excelPriceCode = String(excelSub.price_code || '').trim();
                const dbPriceCode = String(dbData.price_code || '').trim();
                if (excelPriceCode && dbPriceCode && excelPriceCode !== dbPriceCode) {
                    rowDiffs.push({ field: 'Price Code', excel: excelPriceCode, db: dbPriceCode });
                }

                // 4. Fecha Activación (Normalizando para comparar solo fecha)
                const excelDate = excelSub.init_activation_date ? new Date(excelSub.init_activation_date).toISOString().split('T')[0] : null;
                const dbDate = dbData.activation_date ? new Date(dbData.activation_date).toISOString().split('T')[0] : null;
                if (excelDate && dbDate && excelDate !== dbDate) {
                    rowDiffs.push({ field: 'Fecha Activación', excel: excelDate, db: dbDate });
                }

                // 5. IMSI
                const excelImsi = String(excelSub.imsi || '').trim();
                const dbImsi = String(dbData.imsi || '').trim();
                if (excelImsi && dbImsi && excelImsi !== dbImsi) {
                    rowDiffs.push({ field: 'IMSI', excel: excelImsi, db: dbImsi });
                }

                // 6. Product Type (Seguro)
                const excelProductType = String(excelSub.product_type || excelSub.tipo_celu || '').trim();
                const dbProductType = String(dbData.product_type || '').trim();
                if (excelProductType && dbProductType && excelProductType !== dbProductType) {
                    rowDiffs.push({ field: 'Tipo Seguro', excel: excelProductType, db: dbProductType });
                }

            } else {
                // Comparación específica para Local (Nuestra App)

                if (banNumber && dbData.ban_number !== banNumber) {
                    rowDiffs.push({ field: 'BAN', excel: banNumber, db: dbData.ban_number });
                }

                const excelRate = parseFloat(String(excelSub.monthly_value || 0).replace(/[^0-9.]/g, ''));
                const dbRate = parseFloat(dbData.monthly_value || 0);
                if (Math.abs(excelRate - dbRate) > 0.01) {
                    rowDiffs.push({ field: 'Renta Mensual', excel: excelRate, db: dbRate });
                }

                const excelPlan = String(excelSub.plan || '').trim().toUpperCase();
                const dbPlan = String(dbData.plan || '').trim().toUpperCase();
                if (excelPlan && dbPlan && !dbPlan.includes(excelPlan) && !excelPlan.includes(dbPlan)) {
                    rowDiffs.push({ field: 'Plan', excel: excelPlan, db: dbPlan });
                }

                const excelImei = String(excelSub.imei || '').trim();
                const dbImei = String(dbData.imei || '').trim();
                if (excelImei && dbImei && excelImei !== dbImei) {
                    rowDiffs.push({ field: 'IMEI', excel: excelImei, db: dbImei });
                }
            }

            if (rowDiffs.length > 0 || mode === 'remote') {
                discrepancies.push({
                    phone,
                    client: dbData.client_name || dbData.phone,
                    type: rowDiffs.length > 0 ? 'VALUE_MISMATCH' : 'MATCH',
                    severity: rowDiffs.length > 0 ? 'medium' : 'low',
                    differences: rowDiffs,
                    excelData: row,
                    dbData: dbData // Devolvemos todo lo que está en DB para el panel izquierdo
                });
            }
        }

        return success(res, {
            totalAnalyzed: data.length,
            totalDiscrepancies: discrepancies.length,
            discrepancies,
            mode
        }, 'Comparación completada exitosamente');

    } catch (error) {
        console.error('Error en manual comparison:', error);
        return serverError(res, error, 'Error al procesar la comparación manual');
    }
};

/**
 * Sincroniza cambios directamente en el servidor remoto (Producción)
 */
export const syncRemoteData = async (req, res) => {
    try {
        const { changes } = req.body;

        if (!changes || !Array.isArray(changes)) {
            return res.status(400).json({ error: 'No se enviaron cambios para sincronizar' });
        }

        const results = {
            total: changes.length,
            updated: 0,
            failed: 0,
            errors: []
        };

        for (const row of changes) {
            try {
                // Normalizar fecha si existe
                let finalDate = row.activation_date;
                if (finalDate && !isNaN(Date.parse(finalDate))) {
                    finalDate = new Date(finalDate).toISOString().split('T')[0];
                } else {
                    finalDate = null;
                }

                // Ejecutar UPDATE en la tabla venta de claropr remota
                const updateRes = await remotePool.query(`
                    UPDATE venta 
                    SET 
                        ban = $1, 
                        emai = $2, 
                        pricecode = $3, 
                        fechaactivacion = $4,
                        imsi = $5,
                        producttype = $6
                    WHERE numerocelularactivado = $7
                `, [
                    String(row.ban || '').trim(),
                    String(row.imei || '').trim(),
                    String(row.plan || '').trim(),
                    finalDate,
                    String(row.imsi || '').trim(),
                    String(row.product_type || row.tipo_celu || '').trim(),
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
                console.error(`Error syncing ${row.phone} to remote:`, err);
            }
        }

        return success(res, results, 'Proceso de sincronización remota finalizado');
    } catch (error) {
        console.error('Error general en syncRemoteData:', error);
        return serverError(res, error, 'Error crítico al intentar sincronizar con Producción');
    }
};
