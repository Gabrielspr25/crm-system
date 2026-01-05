import { query, getClient } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveImportData = async (req, res) => {
    const data = req.body?.data || [];

    console.log(`[SAVE] Recibidas ${data.length} filas para importar`);
    if (data.length > 0 && data.length <= 3) {
        console.log('[SAVE] Muestra de datos:', JSON.stringify(data, null, 2));
    }

    if (!Array.isArray(data) || data.length === 0) {
        return badRequest(res, 'No hay datos para importar');
    }

    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = [];
    let omitted = 0;
    let omittedReasons = [];
    let createdClients = [];
    let clientSalesStats = new Map();

    const client = await getClient();

    try {
        await client.query('BEGIN');

        for (const row of data) {
            processed++;
            try {
                const clientData = row.Clientes || {};
                const banData = row.BANs || {};
                const subData = row.Suscriptores || {};
                
                const clientName = String(clientData.name || '').trim();
                const ownerName = String(clientData.owner_name || '').trim();
                const contactPerson = String(clientData.contact_person || '').trim();
                const vendorName = String(clientData.vendor_id || '').trim();
                const banNumber = String(banData.ban_number || '').trim();
                const accountType = String(banData.account_type || '').trim();
                const phone = String(subData.phone || '').trim();
                const banStatusValue = String(banData.status || '').trim().toUpperCase();
                
                if (!banNumber) {
                    omitted++;
                    omittedReasons.push(`Fila ${processed}: Falta número BAN`);
                    continue;
                }
                
                if (!phone) {
                    omitted++;
                    omittedReasons.push(`Fila ${processed}: Falta teléfono del suscriptor`);
                    continue;
                }

                const banIsActive = banStatusValue === 'C' ? 0 : 1;
                
                let clientId = null;
                let finalVendorId = null;

                const existingBan = await client.query(
                    'SELECT id, client_id FROM bans WHERE ban_number = $1',
                    [banNumber]
                );

                if (existingBan.rows.length > 0) {
                    const banId = existingBan.rows[0].id;
                    clientId = existingBan.rows[0].client_id;
                    
                    if (vendorName) {
                        const vendorRes = await client.query('SELECT id FROM vendors WHERE name ILIKE $1', [vendorName]);
                        if (vendorRes.rows.length > 0) {
                            finalVendorId = vendorRes.rows[0].id;
                        }
                    }
                    
                    const updateFields = [];
                    const updateValues = [];
                    let paramCount = 1;
                    
                    if (clientName) {
                        updateFields.push(`name = $${paramCount++}`);
                        updateValues.push(clientName);
                    }
                    if (ownerName) {
                        updateFields.push(`owner_name = $${paramCount++}`);
                        updateValues.push(ownerName);
                    }
                    if (contactPerson) {
                        updateFields.push(`contact_person = $${paramCount++}`);
                        updateValues.push(contactPerson);
                    }
                    if (clientData.email) {
                        updateFields.push(`email = $${paramCount++}`);
                        updateValues.push(clientData.email);
                    }
                    if (clientData.phone) {
                        updateFields.push(`phone = $${paramCount++}`);
                        updateValues.push(clientData.phone);
                    }
                    if (clientData.additional_phone) {
                        updateFields.push(`additional_phone = $${paramCount++}`);
                        updateValues.push(clientData.additional_phone);
                    }
                    if (clientData.cellular) {
                        updateFields.push(`cellular = $${paramCount++}`);
                        updateValues.push(clientData.cellular);
                    }
                    if (clientData.address) {
                        updateFields.push(`address = $${paramCount++}`);
                        updateValues.push(clientData.address);
                    }
                    if (clientData.city) {
                        updateFields.push(`city = $${paramCount++}`);
                        updateValues.push(clientData.city);
                    }
                    if (clientData.zip_code) {
                        updateFields.push(`zip_code = $${paramCount++}`);
                        updateValues.push(clientData.zip_code);
                    }
                    if (clientData.city) {
                        updateFields.push(`city = $${paramCount++}`);
                        updateValues.push(clientData.city);
                    }
                    if (clientData.phone) {
                        updateFields.push(`phone = $${paramCount++}`);
                        updateValues.push(clientData.phone);
                    }
                    if (finalVendorId) {
                        updateFields.push(`vendor_id = $${paramCount++}`);
                        updateValues.push(finalVendorId);
                    }
                    
                    if (updateFields.length > 0) {
                        updateFields.push(`updated_at = NOW()`);
                        updateValues.push(clientId);
                        await client.query(
                            `UPDATE clients SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
                            updateValues
                        );
                    }
                    
                    await client.query(
                        'UPDATE bans SET is_active = $1, updated_at = NOW() WHERE id = $2',
                        [banIsActive, banId]
                    );
                    
                    updated++;
                } else {
                    if (vendorName) {
                        const vendorRes = await client.query('SELECT id FROM vendors WHERE name ILIKE $1', [vendorName]);
                        if (vendorRes.rows.length > 0) {
                            finalVendorId = vendorRes.rows[0].id;
                        }
                    }
                    
                    if (clientName) {
                        const existingClient = await client.query(
                            'SELECT id FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))',
                            [clientName]
                        );
                        
                        if (existingClient.rows.length > 0) {
                            clientId = existingClient.rows[0].id;
                        } else {
                            const newClient = await client.query(
                                `INSERT INTO clients (name, owner_name, contact_person, email, phone, additional_phone, cellular, address, city, zip_code, salesperson_id, created_at, updated_at)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                                 RETURNING id, name`,
                                [
                                    clientName, 
                                    ownerName || null, 
                                    contactPerson || null,
                                    clientData.email || null, 
                                    clientData.phone || null,
                                    clientData.additional_phone || null,
                                    clientData.cellular || null,
                                    clientData.address || null, 
                                    clientData.city || null,
                                    clientData.zip_code || null,
                                    finalVendorId
                                ]
                            );
                            clientId = newClient.rows[0].id;
                            createdClients.push({
                                id: clientId,
                                name: newClient.rows[0].name,
                                vendor_id: finalVendorId
                            });
                            created++;
                        }
                    } else {
                        const newClient = await client.query(
                            `INSERT INTO clients (name, vendor_id, is_active, base, created_at, updated_at)
                             VALUES ('SIN NOMBRE', $1, 1, 'BD propia', NOW(), NOW())
                             RETURNING id`,
                            [finalVendorId]
                        );
                        clientId = newClient.rows[0].id;
                        created++;
                    }
                    
                    const newBan = await client.query(
                        `INSERT INTO bans (ban_number, client_id, account_type, status, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, NOW(), NOW())
                         RETURNING id`,
                        [banNumber, clientId, accountType || null, banStatusValue || null]
                    );
                }

                if (clientId) {
                    const existingBanQuery = await client.query('SELECT id FROM bans WHERE ban_number = $1', [banNumber]);
                    const banId = existingBanQuery.rows[0]?.id;
                    
                    if (banId) {
                        const existingSub = await client.query('SELECT id FROM subscribers WHERE phone = $1', [phone]);
                    
                        const plan = subData.plan || null;
                        const monthlyValue = subData.monthly_value ? Math.abs(parseFloat(String(subData.monthly_value).replace(/[^0-9.]/g, ''))) : null;
                        const contractTerm = subData.contract_term ? parseInt(String(subData.contract_term).replace(/[^0-9]/g, '')) : null;
                        const remainingPayments = subData.remaining_payments ? parseInt(String(subData.remaining_payments).replace(/[^0-9]/g, '')) : null;
                        const contractEndDate = subData.contract_end_date || null;

                        if (clientId && !clientSalesStats.has(clientId)) {
                            clientSalesStats.set(clientId, {
                                vendor_id: finalVendorId,
                                company_name: clientName,
                                new_lines: 0,
                                renewed_lines: 0,
                                total_amount: 0
                            });
                        }
                        const stats = clientSalesStats.get(clientId);

                        if (existingSub.rows.length > 0) {
                            await client.query(
                                `UPDATE subscribers 
                                 SET ban_id = $1, 
                                     plan = COALESCE($2, plan),
                                     monthly_value = COALESCE($3, monthly_value),
                                     remaining_payments = COALESCE($4, remaining_payments),
                                     contract_term = COALESCE($5, contract_term),
                                     contract_end_date = COALESCE($6, contract_end_date),
                                     updated_at = NOW()
                                 WHERE id = $7`,
                                [banId, plan, monthlyValue, remainingPayments, contractTerm, contractEndDate, existingSub.rows[0].id]
                            );
                            if (stats) {
                                stats.renewed_lines++;
                                stats.total_amount += monthlyValue;
                            }
                        } else {
                            await client.query(
                                `INSERT INTO subscribers (
                                    ban_id, phone, plan, monthly_value, 
                                    remaining_payments, contract_term, contract_end_date,
                                    created_at, updated_at
                                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                                [banId, phone, plan, monthlyValue, remainingPayments, contractTerm, contractEndDate]
                            );
                            if (stats) {
                                stats.new_lines++;
                                stats.total_amount += monthlyValue;
                            }
                        }
                    }
                }

            } catch (err) {
                console.error('Error procesando fila:', err);
                errors.push(`Error en fila ${processed}: ${err.message}`);
            }
        }

        for (const [clientId, stats] of clientSalesStats) {
            if (stats.new_lines > 0 || stats.renewed_lines > 0) {
                const existingSale = await client.query(
                    `SELECT id, movil_nueva, movil_renovacion, total_amount 
                     FROM follow_up_prospects 
                     WHERE client_id = $1 AND is_completed = true AND DATE(completed_date) = CURRENT_DATE`,
                    [clientId]
                );

                if (existingSale.rows.length > 0) {
                    await client.query(
                        `UPDATE follow_up_prospects 
                         SET movil_nueva = movil_nueva + $1,
                             movil_renovacion = movil_renovacion + $2,
                             total_amount = total_amount + $3,
                             updated_at = NOW()
                         WHERE id = $4`,
                        [stats.new_lines, stats.renewed_lines, stats.total_amount, existingSale.rows[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO follow_up_prospects (
                            company_name, client_id, vendor_id, 
                            movil_nueva, movil_renovacion, total_amount,
                            is_completed, completed_date, is_active, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), true, NOW(), NOW())`,
                        [
                            stats.company_name, clientId, stats.vendor_id,
                            stats.new_lines, stats.renewed_lines, stats.total_amount
                        ]
                    );
                }

                await client.query('UPDATE clients SET vendor_id = NULL WHERE id = $1', [clientId]);
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
                omitted,
                omittedReasons: omittedReasons.slice(0, 20),
                errors: errors.length,
                errorList: errors.slice(0, 10),
                createdClients
            },
            created,
            updated,
            errors: errors
        });

    } catch (error) {
        await client.query('ROLLBACK');
        serverError(res, error, 'Error en importación masiva');
    } finally {
        client.release();
    }
};

export const simulateImportData = async (req, res) => {
    const data = req.body?.data || [];

    console.log(`[SIMULATE] Recibidas ${data.length} filas`);
    if (data.length > 0) {
        console.log('[SIMULATE] ESTRUCTURA fila 0:', JSON.stringify(data[0], null, 2));
        console.log('[SIMULATE] KEYS fila 0:', Object.keys(data[0]));
    }

    if (!Array.isArray(data) || data.length === 0) {
        console.log('[SIMULATE] ERROR: No hay datos o no es array');
        return badRequest(res, 'No hay datos para simular');
    }

    let disponibles = 0;
    let incompletos = 0;
    let cancelados = 0;

    const client = await getClient();

    try {
        for (const row of data) {
            const clientData = row.Clientes || {};
            const banData = row.BANs || {};
            const subData = row.Suscriptores || {};

            const clientName = String(clientData.name || '').trim();
            const banStatusValue = String(banData.status || '').trim().toUpperCase();

            if (banStatusValue === 'C') {
                cancelados++;
            } else {
                if (clientName) {
                    disponibles++;
                } else {
                    incompletos++;
                }
            }
        }

        res.json({
            success: true,
            report: {
                disponibles,
                incompletos,
                cancelados,
                total: disponibles + incompletos + cancelados
            }
        });

    } catch (error) {
        serverError(res, error, 'Error en simulación');
    } finally {
        client.release();
    }
};

export const getExcelColumns = async (req, res) => {
    try {
        const excelsDir = path.join(__dirname, '../../..', 'elementos_extra', 'excels');
        const defaultFile = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';

        let excelPath = path.join(excelsDir, defaultFile);
        if (!fs.existsSync(excelPath)) {
            const files = fs.readdirSync(excelsDir).filter(f => f.toLowerCase().endsWith('.xlsx'));
            if (files.length === 0) {
                return res.status(404).json({
                    error: 'No se encontró ningún Excel en la carpeta',
                    path: excelsDir
                });
            }
            excelPath = path.join(excelsDir, files[0]);
        }

        const fileName = path.basename(excelPath);
        const workbook = XLSX.readFile(excelPath);
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const headers = (jsonData[0] || []);

        const sampleRows = jsonData.slice(1, 6).map(row => {
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = row[idx] ?? '';
            });
            return obj;
        });

        res.json({
            success: true,
            fileName,
            columns: headers,
            totalColumns: headers.length,
            sampleRows,
            totalRows: Math.max(jsonData.length - 1, 0)
        });
    } catch (error) {
        console.error('Error leyendo Excel:', error);
        serverError(res, error, 'Error al leer el archivo Excel');
    }
};
