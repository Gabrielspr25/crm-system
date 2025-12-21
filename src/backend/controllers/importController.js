import { query, getClient } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';

export const saveImportData = async (req, res) => {
    const { data } = req.body || {};

    if (!data || !Array.isArray(data) || data.length === 0) {
        return badRequest(res, 'No hay datos para importar');
    }

    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = [];

    const client = await getClient();

    try {
        await client.query('BEGIN');

        for (const row of data) {
            processed++;
            try {
                // 1. Procesar Cliente
                const clientData = row.Clientes || {};
                let clientId = null;
                
                // Normalizar nombre para búsqueda
                const clientName = (clientData.name || clientData.business_name || '').trim();
                const vendorName = (clientData.vendor_id || '').trim(); // El frontend envía el nombre del vendedor aquí

                if (clientName) {
                    // Buscar vendedor por nombre si viene
                    let vendorId = null;
                    if (vendorName) {
                        const vendorRes = await client.query('SELECT id FROM vendors WHERE name ILIKE $1', [vendorName]);
                        if (vendorRes.rows.length > 0) {
                            vendorId = vendorRes.rows[0].id;
                        }
                    }

                    // Buscar cliente existente
                    const existingClient = await client.query(
                        'SELECT id FROM clients WHERE LOWER(TRIM(business_name)) = LOWER(TRIM($1)) OR LOWER(TRIM(name)) = LOWER(TRIM($1))',
                        [clientName]
                    );

                    if (existingClient.rows.length > 0) {
                        clientId = existingClient.rows[0].id;
                        // Actualizar vendedor si no tiene
                        if (vendorId) {
                            await client.query('UPDATE clients SET vendor_id = COALESCE(vendor_id, $1) WHERE id = $2', [vendorId, clientId]);
                        }
                        updated++;
                    } else {
                        const newClient = await client.query(
                            `INSERT INTO clients (name, business_name, vendor_id, is_active, base, created_at, updated_at)
                             VALUES ($1, $1, $2, 1, 'BD propia', NOW(), NOW())
                             RETURNING id`,
                            [clientName, vendorId]
                        );
                        clientId = newClient.rows[0].id;
                        created++;
                    }
                }

                // 2. Procesar BAN
                const banData = row.BANs || {};
                const banNumber = (banData.ban_number || '').trim();
                const banStatus = (banData.status || 'activo').toLowerCase();
                const banIsActive = banStatus === 'activo' || banStatus === 'active' || banStatus === '1' ? 1 : 0;
                let banId = null;

                if (banNumber && clientId) {
                    const existingBan = await client.query('SELECT id FROM bans WHERE ban_number = $1', [banNumber]);
                    
                    if (existingBan.rows.length > 0) {
                        banId = existingBan.rows[0].id;
                        // Asegurar que el BAN pertenezca al cliente correcto (o actualizarlo)
                        await client.query('UPDATE bans SET client_id = $1, is_active = $3, updated_at = NOW() WHERE id = $2', [clientId, banId, banIsActive]);
                    } else {
                        const newBan = await client.query(
                            `INSERT INTO bans (ban_number, client_id, is_active, created_at, updated_at)
                             VALUES ($1, $2, $3, NOW(), NOW())
                             RETURNING id`,
                            [banNumber, clientId, banIsActive]
                        );
                        banId = newBan.rows[0].id;
                    }
                }

                // 3. Procesar Suscriptor
                const subData = row.Suscriptores || {};
                const phone = (subData.phone || subData.subscriber_number || '').trim();

                if (phone && banId) {
                    // CORRECCIÓN: Usar 'phone' en lugar de 'subscriber_number'
                    const existingSub = await client.query('SELECT id FROM subscribers WHERE phone = $1', [phone]);
                    
                    const serviceType = subData.service_type || null;
                    // Validación robusta de números
                    const monthlyValue = subData.monthly_value ? (parseFloat(String(subData.monthly_value).replace(/[^0-9.]/g, '')) || 0) : 0;
                    const months = subData.months ? (parseInt(String(subData.months).replace(/[^0-9]/g, '')) || 0) : 0;
                    const remainingPayments = subData.remaining_payments ? (parseInt(String(subData.remaining_payments).replace(/[^0-9]/g, '')) || 0) : 0;
                    
                    const notes = subData.notes || null;
                    const status = (subData.status || 'activo').toLowerCase();
                    const isActive = status === 'activo' || status === 'active' || status === '1' ? 1 : 0;
                    const equipment = subData.equipment || null;
                    const city = subData.city || null;
                    
                    // Fechas
                    const contractStartDate = subData.contract_start_date || null;
                    const contractEndDate = subData.contract_end_date || null;

                    if (existingSub.rows.length > 0) {
                        // CORRECCIÓN: Nombres de columnas (monthly_value, phone)
                        await client.query(
                            `UPDATE subscribers 
                             SET ban_id = $1, 
                                 service_type = COALESCE($2, service_type),
                                 monthly_value = COALESCE($3, monthly_value),
                                 remaining_payments = COALESCE($4, remaining_payments),
                                 notes = COALESCE($5, notes),
                                 is_active = $6,
                                 equipment = COALESCE($7, equipment),
                                 city = COALESCE($8, city),
                                 contract_start_date = COALESCE($9, contract_start_date),
                                 contract_end_date = COALESCE($10, contract_end_date),
                                 updated_at = NOW()
                             WHERE id = $11`,
                            [banId, serviceType, monthlyValue, remainingPayments, notes, isActive, equipment, city, contractStartDate, contractEndDate, existingSub.rows[0].id]
                        );
                    } else {
                        // CORRECCIÓN: Nombres de columnas
                        await client.query(
                            `INSERT INTO subscribers (
                                ban_id, phone, service_type, monthly_value, 
                                remaining_payments, months, notes, is_active, 
                                equipment, city, contract_start_date, contract_end_date,
                                created_at, updated_at
                             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
                            [banId, phone, serviceType, monthlyValue, remainingPayments, months, notes, isActive, equipment, city, contractStartDate, contractEndDate]
                        );
                    }
                }

            } catch (err) {
                console.error('Error procesando fila:', err);
                errors.push(`Error en fila ${processed}: ${err.message}`);
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Importación completada',
            details: {
                processed,
                created,
                updated,
                errors: errors.length,
                errorList: errors.slice(0, 10) // Devolver solo los primeros 10 errores
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        serverError(res, error, 'Error en importación masiva');
    } finally {
        client.release();
    }
};

export const simulateImportData = async (req, res) => {
    const { data } = req.body || {};

    if (!data || !Array.isArray(data) || data.length === 0) {
        return badRequest(res, 'No hay datos para simular');
    }

    let newClients = 0;
    let updatedClients = 0;
    let newBans = 0;
    let updatedBans = 0;
    let newSubscribers = 0;
    let updatedSubscribers = 0;
    
    // Detalles fila por fila para el reporte
    let rowDetails = [];

    const client = await getClient();

    try {
        // Optimización: Cargar todos los clientes, BANs y suscriptores existentes en memoria para comparación rápida
        // (Para volúmenes muy grandes esto debería ser paginado o por lotes, pero para <5000 filas está bien)
        
        // Obtener listas de claves existentes
        const existingClientsRes = await client.query('SELECT LOWER(TRIM(name)) as name, id FROM clients');
        const existingClients = new Set(existingClientsRes.rows.map(r => r.name));
        
        const existingBansRes = await client.query('SELECT ban_number FROM bans');
        const existingBans = new Set(existingBansRes.rows.map(r => r.ban_number));

        // CORRECCIÓN: Usar 'phone' en lugar de 'subscriber_number'
        const existingSubsRes = await client.query('SELECT phone FROM subscribers');
        const existingSubs = new Set(existingSubsRes.rows.map(r => r.phone));

        for (const row of data) {
            const clientData = row.Clientes || {};
            const banData = row.BANs || {};
            const subData = row.Suscriptores || {};

            const clientName = (clientData.name || clientData.business_name || '').trim().toLowerCase();
            const banNumber = (banData.ban_number || '').trim();
            const phone = (subData.phone || subData.subscriber_number || '').trim();

            let clientStatus = 'Nuevo';
            let banStatus = 'Nuevo';
            let subStatus = 'Nuevo';

            if (clientName) {
                if (existingClients.has(clientName)) {
                    updatedClients++;
                    clientStatus = 'Existente';
                } else {
                    newClients++;
                    // Agregar al set temporal para no contar duplicados en el mismo archivo como nuevos múltiples veces
                    existingClients.add(clientName);
                }
            } else {
                clientStatus = '-';
            }

            if (banNumber) {
                if (existingBans.has(banNumber)) {
                    updatedBans++;
                    banStatus = 'Existente';
                } else {
                    newBans++;
                    existingBans.add(banNumber);
                }
            } else {
                banStatus = '-';
            }

            if (phone) {
                if (existingSubs.has(phone)) {
                    updatedSubscribers++;
                    subStatus = 'Existente';
                } else {
                    newSubscribers++;
                    existingSubs.add(phone);
                }
            } else {
                subStatus = '-';
            }

            rowDetails.push({
                client: clientData.name || '',
                clientStatus,
                ban: banNumber,
                banStatus,
                phone,
                subStatus,
                plan: subData.service_type || '',
                price: subData.monthly_value || ''
            });
        }

        res.json({
            success: true,
            report: {
                newClients,
                updatedClients,
                newBans,
                updatedBans,
                newSubscribers,
                updatedSubscribers,
                details: rowDetails
            }
        });

    } catch (error) {
        serverError(res, error, 'Error en simulación');
    } finally {
        client.release();
    }
};
