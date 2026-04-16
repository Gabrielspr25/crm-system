
import { query } from '../database/db.js';
import { serverError, badRequest } from '../middlewares/errorHandler.js';
import { getDiscrepanciasPool } from '../database/externalPools.js';

const LOCAL_FIELD_MAP = Object.freeze({
    name: 'name',
    email: 'email',
    tax_id: 'tax_id',
    owner_name: 'owner_name',
    contact_person: 'contact_person',
    phone: 'phone',
    cellular: 'cellular',
    additional_phone: 'additional_phone',
    address: 'address',
    city: 'city',
    sector: 'sector',
    zip_code: 'zip_code',
    business_name: 'business_name'
});

const REMOTE_FIELD_MAP = Object.freeze({
    name: 'nombre',
    email: 'email',
    tax_id: 'segurosocial',
    phone: 'telefonocontacto',
    cellular: 'telefonotrabajo',
    additional_phone: 'telefonoresidencia',
    address: 'direccionpostal',
    business_name: 'nombre'
});

const normalizeComparableText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\.\,\|\;\:\-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

const normalizeNameComparable = (value) =>
    normalizeComparableText(value)
        .replace(/\b(MR|MRS|MS|MISS|DR|SR|SRA|SRTA|DRA)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const nameTokens = (value) =>
    normalizeNameComparable(value)
        .split(' ')
        .filter(Boolean);

const areNamesEquivalent = (a, b) => {
    const ta = nameTokens(a);
    const tb = nameTokens(b);
    if (!ta.length || !tb.length) return true;
    if (ta.join(' ') === tb.join(' ')) return true;
    const shorter = ta.length <= tb.length ? ta : tb;
    const longer = ta.length <= tb.length ? tb : ta;
    return shorter.every((token) => longer.includes(token));
};

const normalizeYesNo = (value, kind = 'generic') => {
    const normalized = normalizeComparableText(value);
    if (!normalized) return '';

    if (
        normalized === 'NONE' ||
        normalized === 'NULL' ||
        normalized === 'N/A' ||
        normalized === 'VACIO' ||
        normalized === '(VACIO)'
    ) {
        return kind === 'seguro' ? 'NO' : '';
    }

    if (kind === 'paper') {
        if (
            normalized === 'NO' ||
            normalized.includes('NO PAPER') ||
            normalized.includes('NOPAPER') ||
            normalized.includes('EBILL')
        ) {
            return 'NO';
        }
        if (normalized === 'SI' || normalized === 'YES' || normalized.includes('PAPER')) {
            return 'SI';
        }
        return normalized;
    }

    if (
        normalized === 'NO' ||
        normalized === 'FALSE' ||
        normalized === '0' ||
        normalized.includes('SIN SEGURO')
    ) {
        return 'NO';
    }
    if (
        normalized === 'SI' ||
        normalized === 'YES' ||
        normalized === 'TRUE' ||
        normalized === '1' ||
        normalized.includes('CON SEGURO')
    ) {
        return 'SI';
    }
    return normalized;
};

const normalizePersonFullName = (value) =>
    String(value || '')
        .replace(/^(MR|MRS|MS|MISS|DR|SR|SRA|SRTA|DRA)\.?\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

const splitPersonName = (value) => {
    const full = normalizePersonFullName(value);
    if (!full) return { full: '', nombre: '', apellido: '' };
    const parts = full.split(' ').filter(Boolean);
    if (parts.length === 1) return { full, nombre: parts[0], apellido: '' };
    return { full, nombre: parts[0], apellido: parts.slice(1).join(' ') };
};

export const getDiscrepancias = async (req, res) => {
    try {
        console.log('🔍 [DISCREPANCIAS] Iniciando análisis de discrepancias...');
        const poolRemoto = getDiscrepanciasPool();
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
        const clientIdRaw = id.split('-').pop();
        const clientId = Number.parseInt(String(clientIdRaw), 10);
        if (!Number.isFinite(clientId)) {
            return badRequest(res, 'ID de cliente inválido');
        }

        const normalizedField = String(field || '').trim().toLowerCase();

        if (action === 'remote_to_local') {
            const localField = LOCAL_FIELD_MAP[normalizedField];
            if (!localField) {
                return badRequest(res, `Campo no permitido para sync local: ${field}`);
            }

            // Actualizar base de datos local con valor remoto
            await query(
                `UPDATE clients SET ${localField} = $1 WHERE id = $2`,
                [value, clientId]
            );

            res.json({
                success: true,
                message: `Cliente ${clientId} actualizado localmente`
            });
        } else if (action === 'local_to_remote') {
            const remoteField = REMOTE_FIELD_MAP[normalizedField];
            if (!remoteField) {
                return badRequest(res, `Campo no permitido para sync remoto: ${field}`);
            }

            // Actualizar base de datos remota
            const poolRemoto = getDiscrepanciasPool();
            await poolRemoto.query(
                `UPDATE clientecredito SET ${remoteField} = $1 WHERE clientecreditoid = $2`,
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
        console.log('🔍 [COMPARE-EXCEL] Iniciando comparacion...');
        const { data } = req.body;

        if (!data || !Array.isArray(data)) {
            return badRequest(res, 'Datos invalidos');
        }

        console.log(`🔍 [COMPARE-EXCEL] Comparando ${data.length} registros con BD multicellular`);

        const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
        const normalizePhone10 = (value) => {
            const digits = normalizeDigits(value);
            if (!digits) return '';
            if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
            if (digits.length >= 10) return digits.slice(-10);
            return '';
        };

        const poolRemoto = getDiscrepanciasPool();
        const discrepancies = [];

        const phoneCandidates = new Set();
        const banCandidates = new Set();

        for (const row of data) {
            const phoneClean = normalizePhone10(row.Suscriptores?.phone);
            const banClean = normalizeDigits(row.BANs?.ban_number);

            if (phoneClean) {
                phoneCandidates.add(phoneClean);
                phoneCandidates.add(`1${phoneClean}`);
            }
            if (banClean) {
                banCandidates.add(banClean);
            }
        }

        if (phoneCandidates.size === 0 && banCandidates.size === 0) {
            return res.json({ success: true, data: { discrepancies: [], total: 0, analyzed: 0 } });
        }

        const candidatePhones = Array.from(phoneCandidates)
            .map((v) => Number(v))
            .filter(Number.isFinite);
        const candidateBans = Array.from(banCandidates);

        console.log(`🔍 [COMPARE-EXCEL] Buscando ${candidatePhones.length} telefonos y ${candidateBans.length} BANs...`);

        const hasPhoneCandidates = candidatePhones.length > 0;
        const hasBanCandidates = candidateBans.length > 0;

        const remoteQuery = `
            SELECT
                v.ventaid,
                v.fechaactivacion as fecha,
                v.ban,
                CAST(v.numerocelularactivado AS text) as suscriber,
                TRIM(CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, ''))) as nombre,
                v.simcard,
                v.emai as imei,
                CASE WHEN v.papper THEN 'NO' ELSE 'SI' END as paper,
                CASE WHEN v.celuseguroexistente THEN 'SI' ELSE 'NO' END as seguro,
                v.pricecode as price_code,
                v.codigovoz as price_plan
            FROM venta v
            LEFT JOIN clientecredito c ON v.clientecreditoid = c.clientecreditoid
            WHERE
                (($3::boolean) AND v.numerocelularactivado = ANY($1::bigint[]))
                OR
                (($4::boolean) AND regexp_replace(COALESCE(v.ban::text, ''), '\\D', '', 'g') = ANY($2::text[]))
            ORDER BY v.fechaactivacion DESC NULLS LAST, v.ventaid DESC
            LIMIT 5000
        `;

        const remoteRes = await poolRemoto.query(remoteQuery, [
            candidatePhones,
            candidateBans,
            hasPhoneCandidates,
            hasBanCandidates
        ]);
        const dbResults = remoteRes.rows;

        for (const row of data) {
            const phone = row.Suscriptores?.phone;
            const ban = row.BANs?.ban_number;
            const phoneClean = normalizePhone10(phone);
            const banClean = normalizeDigits(ban);

            if (!phoneClean && !banClean) continue;

            let dbData = dbResults.find((dbRow) => {
                const dbPhoneClean = normalizePhone10(dbRow.suscriber);
                return phoneClean && dbPhoneClean === phoneClean;
            });

            if (!dbData && banClean) {
                dbData = dbResults.find((dbRow) => normalizeDigits(dbRow.ban) === banClean);
            }

            if (!dbData) {
                discrepancies.push({
                    phone: phone,
                    type: 'MISSING_IN_REMOTE',
                    dbData: null
                });
                continue;
            }

            const differences = [];
            const excelData = {
                ban: ban || '',
                imei: row.Suscriptores?.imei || '',
                price_code: row.Suscriptores?.price_code || '',
                imsi: row.Suscriptores?.imsi || '',
                nombre: row.Suscriptores?.nombre || '',
                tipo_factura: row.Suscriptores?.tipo_factura || '',
                tipo_celuseguro: row.Suscriptores?.tipo_celuseguro || '',
                price_plan: row.Suscriptores?.price_plan || ''
            };

            if (
                excelData.ban &&
                dbData.ban &&
                normalizeDigits(excelData.ban) !== normalizeDigits(dbData.ban)
            ) {
                differences.push({ field: 'BAN', excel: excelData.ban, db: dbData.ban });
            }
            if (excelData.imei && dbData.imei && excelData.imei !== String(dbData.imei)) {
                differences.push({ field: 'IMEI', excel: excelData.imei, db: dbData.imei });
            }
            if (excelData.price_code && dbData.price_code && excelData.price_code !== String(dbData.price_code)) {
                differences.push({ field: 'PRICE_CODE', excel: excelData.price_code, db: dbData.price_code });
            }
            if (
                excelData.nombre &&
                dbData.nombre &&
                !areNamesEquivalent(excelData.nombre, dbData.nombre)
            ) {
                differences.push({ field: 'NOMBRE', excel: excelData.nombre, db: dbData.nombre });
            }
            if (excelData.tipo_factura && dbData.paper) {
                const excelPaper = normalizeYesNo(excelData.tipo_factura, 'paper');
                const dbPaper = normalizeYesNo(dbData.paper, 'paper');
                if (excelPaper && dbPaper && excelPaper !== dbPaper) {
                    differences.push({ field: 'PAPER', excel: excelData.tipo_factura, db: dbData.paper });
                }
            }
            if (excelData.tipo_celuseguro && dbData.seguro) {
                const excelSeguro = normalizeYesNo(excelData.tipo_celuseguro, 'seguro');
                const dbSeguro = normalizeYesNo(dbData.seguro, 'seguro');
                if (excelSeguro && dbSeguro && excelSeguro !== dbSeguro) {
                    differences.push({ field: 'SEGURO', excel: excelData.tipo_celuseguro, db: dbData.seguro });
                }
            }
            if (excelData.price_plan && dbData.price_plan && excelData.price_plan !== String(dbData.price_plan)) {
                differences.push({ field: 'PRICE_PLAN', excel: excelData.price_plan, db: dbData.price_plan });
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

        console.log(`🔍 [COMPARE-EXCEL] Comparacion completada. ${discrepancies.length} resultados`);

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
        const { phone, ban, ventaid, data } = req.body;

        if (!data) {
            return badRequest(res, 'Faltan parametros');
        }

        console.log(`🔍 [UPDATE-ROW] Actualizando registro. phone=${phone || ''} ban=${ban || ''} ventaid=${ventaid || ''}`);

        const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
        const normalizePhone10 = (value) => {
            const digits = normalizeDigits(value);
            if (!digits) return '';
            if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
            if (digits.length >= 10) return digits.slice(-10);
            return '';
        };

        const poolRemoto = getDiscrepanciasPool();
        const phoneClean = normalizePhone10(phone);
        const banClean = normalizeDigits(ban);

        const updates = [];
        const values = [];
        let paramIndex = 1;
        let personNameToUpdate = null;

        const fieldMapping = {
            'fecha': 'fechaactivacion',
            'ban': 'ban',
            'simcard': 'simcard',
            'imei': 'emai',
            'price_code': 'pricecode',
            'paper': 'papper',
            'seguro': 'celuseguroexistente',
            'price_plan': 'codigovoz'
        };

        for (const [key, value] of Object.entries(data)) {
            if (key === 'nombre') {
                const splitName = splitPersonName(value);
                if (splitName.full) {
                    personNameToUpdate = splitName;
                }
                continue;
            }
            const dbColumn = fieldMapping[key];
            if (dbColumn && value !== undefined && value !== 'Cargando...') {
                let finalValue = value;
                if (key === 'paper') {
                    // papper=true significa "NO PAPER"
                    finalValue = normalizeYesNo(value, 'paper') === 'NO';
                } else if (key === 'seguro') {
                    finalValue = normalizeYesNo(value, 'seguro') === 'SI';
                }
                updates.push(`${dbColumn} = $${paramIndex}`);
                values.push(finalValue);
                paramIndex++;
            }
        }

        if (updates.length === 0 && !personNameToUpdate) {
            return badRequest(res, 'No hay campos para actualizar');
        }

        let whereClause = '';
        if (ventaid) {
            whereClause = `ventaid = $${paramIndex}`;
            values.push(Number(ventaid));
            paramIndex++;
        } else if (phoneClean) {
            whereClause = `regexp_replace(CAST(numerocelularactivado AS text), '\\D', '', 'g') LIKE '%' || $${paramIndex}`;
            values.push(phoneClean);
            paramIndex++;
        } else if (banClean) {
            whereClause = `regexp_replace(COALESCE(ban::text, ''), '\\D', '', 'g') = $${paramIndex}`;
            values.push(banClean);
            paramIndex++;
        } else {
            return badRequest(res, 'Debe enviar phone, ban o ventaid para identificar el registro');
        }

        const identifierValue = values[values.length - 1];

        let ventaRowsAffected = 0;
        if (updates.length > 0) {
            const updateQuery = `
                UPDATE venta
                SET ${updates.join(', ')}
                WHERE ${whereClause}
            `;
            const result = await poolRemoto.query(updateQuery, values);
            ventaRowsAffected = result.rowCount || 0;
            console.log(`🔍 [UPDATE-ROW] Filas actualizadas en venta: ${ventaRowsAffected}`);
        }

        let clienteRowsAffected = 0;
        let clientecreditoid = null;
        if (personNameToUpdate) {
            const whereClauseLookup = whereClause.replace(/\$\d+/g, '$1');
            const findClientQuery = `
                SELECT clientecreditoid
                FROM venta
                WHERE ${whereClauseLookup}
                  AND clientecreditoid IS NOT NULL
                ORDER BY fechaactivacion DESC NULLS LAST, ventaid DESC
                LIMIT 1
            `;
            const clientRef = await poolRemoto.query(findClientQuery, [identifierValue]);
            if (clientRef.rows.length > 0) {
                clientecreditoid = clientRef.rows[0].clientecreditoid;
                const updateClientQuery = `
                    UPDATE clientecredito
                    SET nombre = $1,
                        apellido = $2
                    WHERE clientecreditoid = $3
                `;
                const clientResult = await poolRemoto.query(updateClientQuery, [
                    personNameToUpdate.nombre,
                    personNameToUpdate.apellido || null,
                    clientecreditoid
                ]);
                clienteRowsAffected = clientResult.rowCount || 0;
                console.log(`🔍 [UPDATE-ROW] Filas actualizadas en clientecredito: ${clienteRowsAffected}`);
            }
        }

        res.json({
            success: true,
            message: `Registro actualizado (venta: ${ventaRowsAffected}, cliente: ${clienteRowsAffected})`,
            rowsAffected: ventaRowsAffected + clienteRowsAffected,
            details: {
                ventaRowsAffected,
                clienteRowsAffected,
                clientecreditoid,
                nombre: personNameToUpdate?.full || null,
                nombre_part: personNameToUpdate?.nombre || null,
                apellido_part: personNameToUpdate?.apellido || null
            }
        });

    } catch (error) {
        console.error('🔍 [UPDATE-ROW] Error:', error);
        serverError(res, error, 'Error al actualizar registro');
    }
};
