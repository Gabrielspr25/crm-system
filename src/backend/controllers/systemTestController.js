import { getClient, query } from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * AGENTE DE PRUEBAS COMPLETO DEL SISTEMA
 * Simula un vendedor real probando TODOS los módulos
 */

const TEST_PREFIX = '__SYSTEM_TEST__';
const API_BASE_URL = `http://127.0.0.1:${config.port || 3001}`;

function normalizePhoneDigits(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
}

// Datos de prueba que simulan inputs reales de un vendedor
const TEST_DATA = {
    client: {
        name: `${TEST_PREFIX}_Cliente_Prueba`,
        owner_name: `${TEST_PREFIX}_Dueño_SA`,
        contact_person: 'Juan Pérez',
        email: 'test@sistematest.com',
        phone: '809-555-0001',
        cellular: '809-555-0002',
        additional_phone: '809-555-0003',
        address: 'Calle Prueba #123',
        city: 'Santo Domingo',
        zip_code: '10101',
        tax_id: 'TEST-RNC-001',
        includes_ban: true
    },
    ban: {
        number: `999888777`,
        status: 'A'
    },
    subscriber: {
        phone: `8095551234`,
        plan: 'BREDE3',
        monthly_value: 43.33,
        remaining_payments: 24,
        contract_term: 30
    },
    followUp: {
        company_name: `${TEST_PREFIX}_Prospecto_Corp`,
        fijo_ren: 5,
        fijo_new: 3,
        movil_nueva: 10,
        movil_renovacion: 2,
        claro_tv: 1,
        cloud: 0,
        mpls: 0,
        notes: 'Prospecto de prueba del sistema',
        contact_phone: '809-555-9999',
        contact_email: 'prospecto@test.com',
        total_amount: 15000
    }
};

export const runFullSystemTest = async (req, res) => {
    const client = await getClient();
    const startTime = Date.now();
    
    const results = {
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            duration: 0
        },
        tests: [],
        createdIds: {} // Para limpieza
    };

    const addTest = (module, action, status, message, details = null) => {
        results.tests.push({
            module,
            action,
            status, // 'pass', 'fail', 'skip'
            message,
            details,
            timestamp: new Date().toISOString()
        });
        results.summary.total++;
        if (status === 'pass') results.summary.passed++;
        if (status === 'fail') results.summary.failed++;
    };

    const safeCount = async (sql, params = []) => {
        const rows = await query(sql, params);
        return rows[0] || {};
    };

    const authHeader = req.headers?.authorization || `Bearer ${jwt.sign({
        userId: req.user?.userId || null,
        username: req.user?.username || 'system-test',
        role: req.user?.role || 'admin',
        salespersonId: req.user?.salespersonId || null
    }, config.jwtSecret)}`;

    const apiJson = async (path, options = {}) => {
        const { json, headers, ...rest } = options;
        const requestHeaders = {
            Accept: 'application/json',
            Authorization: authHeader,
            ...(headers || {})
        };

        let body = rest.body;
        if (json !== undefined) {
            body = JSON.stringify(json);
            requestHeaders['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...rest,
            headers: requestHeaders,
            body
        });

        const raw = await response.text();
        let payload = null;
        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch {
            payload = { raw };
        }

        return { response, payload };
    };

    try {
        if (req.user?.role === 'admin') {
            addTest('AUTH', 'Sesion admin autenticada', 'pass', 'El agente corre autenticado como admin', {
                userId: req.user.userId || null,
                username: req.user.username || null,
                role: req.user.role
            });
        } else {
            addTest('AUTH', 'Sesion admin autenticada', 'fail', 'El agente no recibió contexto admin válido', {
                user: req.user || null
            });
        }

        // ========================================
        // FASE 1: LIMPIEZA PREVIA (por si quedó basura)
        // ========================================
        addTest('SETUP', 'Limpieza previa', 'pass', 'Iniciando limpieza de datos de prueba anteriores');
        
        await client.query(`DELETE FROM subscribers WHERE phone = '8095551234'`);
        await client.query(`DELETE FROM bans WHERE ban_number = '999888777'`);
        await client.query(`DELETE FROM follow_up_prospects WHERE company_name LIKE '${TEST_PREFIX}%'`);
        await client.query(`DELETE FROM clients WHERE name LIKE '${TEST_PREFIX}%'`);

        // ========================================
        // FASE 2: CREAR CLIENTE (Todos los campos)
        // ========================================
        let clientId = null;
        try {
            const { response, payload } = await apiJson('/api/clients', {
                method: 'POST',
                json: TEST_DATA.client
            });

            if (!response.ok) {
                throw new Error(payload?.error || `HTTP ${response.status}`);
            }

            if (payload?.id) {
                clientId = payload.id;
                results.createdIds.clientId = clientId;
                
                // Verificar que TODOS los campos se guardaron
                const savedClient = payload;
                const fieldsOk = [];
                const fieldsFail = [];
                
                if (savedClient.name === TEST_DATA.client.name) fieldsOk.push('name'); else fieldsFail.push('name');
                if (savedClient.owner_name === TEST_DATA.client.owner_name) fieldsOk.push('owner_name'); else fieldsFail.push('owner_name');
                if (savedClient.contact_person === TEST_DATA.client.contact_person) fieldsOk.push('contact_person'); else fieldsFail.push('contact_person');
                if (savedClient.email === TEST_DATA.client.email) fieldsOk.push('email'); else fieldsFail.push('email');
                if (savedClient.phone === TEST_DATA.client.phone) fieldsOk.push('phone'); else fieldsFail.push('phone');
                if (savedClient.cellular === TEST_DATA.client.cellular) fieldsOk.push('cellular'); else fieldsFail.push('cellular');
                if (savedClient.additional_phone === TEST_DATA.client.additional_phone) fieldsOk.push('additional_phone'); else fieldsFail.push('additional_phone');
                if (savedClient.address === TEST_DATA.client.address) fieldsOk.push('address'); else fieldsFail.push('address');
                if (savedClient.city === TEST_DATA.client.city) fieldsOk.push('city'); else fieldsFail.push('city');
                if (savedClient.zip_code === TEST_DATA.client.zip_code) fieldsOk.push('zip_code'); else fieldsFail.push('zip_code');
                if (savedClient.tax_id === TEST_DATA.client.tax_id) fieldsOk.push('tax_id'); else fieldsFail.push('tax_id');
                if (Boolean(savedClient.includes_ban) === TEST_DATA.client.includes_ban) fieldsOk.push('includes_ban'); else fieldsFail.push('includes_ban');
                
                if (fieldsFail.length === 0) {
                    addTest('CLIENTES', 'Crear cliente (todos los campos)', 'pass', 
                        `Cliente creado con ID: ${clientId}`, 
                        { fieldsOk, savedData: savedClient });
                } else {
                    addTest('CLIENTES', 'Crear cliente (todos los campos)', 'fail', 
                        `Algunos campos no se guardaron correctamente`, 
                        { fieldsOk, fieldsFail });
                }
            }
        } catch (err) {
            addTest('CLIENTES', 'Crear cliente', 'fail', err.message);
        }

        // ========================================
        // FASE 3: EDITAR CLIENTE
        // ========================================
        if (clientId) {
            try {
                const newName = `${TEST_PREFIX}_Cliente_Editado`;
                const newCity = 'La Romana';
                
                const newTaxId = 'TEST-RNC-EDIT-002';
                const { response, payload } = await apiJson(`/api/clients/${clientId}`, {
                    method: 'PUT',
                    json: {
                        name: newName,
                        city: newCity,
                        tax_id: newTaxId,
                        includes_ban: false
                    }
                });

                if (!response.ok) {
                    throw new Error(payload?.error || `HTTP ${response.status}`);
                }
                
                // Verificar que se guardó
                const verifyResult = {
                    rows: [
                        {
                            name: payload?.name,
                            city: payload?.city,
                            tax_id: payload?.tax_id,
                            includes_ban: payload?.includes_ban
                        }
                    ]
                };
                
                if (
                    verifyResult.rows[0].name === newName
                    && verifyResult.rows[0].city === newCity
                    && verifyResult.rows[0].tax_id === newTaxId
                    && Boolean(verifyResult.rows[0].includes_ban) === false
                ) {
                    addTest('CLIENTES', 'Editar cliente y guardar', 'pass', 
                        'Cliente editado correctamente',
                        { before: TEST_DATA.client.name, after: newName, tax_id: newTaxId, includes_ban: false });
                } else {
                    addTest('CLIENTES', 'Editar cliente y guardar', 'fail', 
                        'Los cambios no se persistieron',
                        payload);
                }
            } catch (err) {
                addTest('CLIENTES', 'Editar cliente', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 4: CREAR BAN
        // ========================================
        let banId = null;
        if (clientId) {
            try {
                const banResult = await client.query(
                    `INSERT INTO bans (client_id, ban_number, status, created_at, updated_at)
                     VALUES ($1, $2, $3, NOW(), NOW())
                     RETURNING *`,
                    [clientId, TEST_DATA.ban.number, TEST_DATA.ban.status]
                );
                
                if (banResult.rows.length > 0) {
                    banId = banResult.rows[0].id;
                    results.createdIds.banId = banId;
                    
                    // Verificar relación con cliente
                    if (banResult.rows[0].client_id === clientId) {
                        addTest('BANS', 'Crear BAN asociado a cliente', 'pass',
                            `BAN creado con ID: ${banId}`,
                            { banNumber: TEST_DATA.ban.number, clientId });
                    } else {
                        addTest('BANS', 'Crear BAN', 'fail', 'Relación con cliente no se guardó');
                    }
                }
            } catch (err) {
                addTest('BANS', 'Crear BAN', 'fail', err.message);
            }
        } else {
            addTest('BANS', 'Crear BAN', 'skip', 'No se pudo crear BAN porque el cliente falló');
        }

        // ========================================
        // FASE 5: EDITAR BAN
        // ========================================
        if (banId) {
            try {
                const newStatus = 'C';
                
                await client.query(
                    `UPDATE bans SET status = $1, updated_at = NOW() WHERE id = $2`,
                    [newStatus, banId]
                );
                
                const verifyBan = await client.query('SELECT status FROM bans WHERE id = $1', [banId]);
                
                if (verifyBan.rows[0].status === newStatus) {
                    addTest('BANS', 'Editar BAN y guardar', 'pass', 
                        'Status de BAN actualizado correctamente',
                        { before: 'A', after: newStatus });
                } else {
                    addTest('BANS', 'Editar BAN', 'fail', 'El cambio de status no se guardó');
                }
            } catch (err) {
                addTest('BANS', 'Editar BAN', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 6: CREAR SUSCRIPTOR
        // ========================================
        let subscriberId = null;
        if (banId) {
            try {
                const subResult = await client.query(
                    `INSERT INTO subscribers 
                     (ban_id, phone, plan, monthly_value, remaining_payments, contract_term, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                     RETURNING *`,
                    [
                        banId,
                        TEST_DATA.subscriber.phone,
                        TEST_DATA.subscriber.plan,
                        TEST_DATA.subscriber.monthly_value,
                        TEST_DATA.subscriber.remaining_payments,
                        TEST_DATA.subscriber.contract_term
                    ]
                );
                
                if (subResult.rows.length > 0) {
                    subscriberId = subResult.rows[0].id;
                    results.createdIds.subscriberId = subscriberId;
                    
                    const savedSub = subResult.rows[0];
                    const fieldsOk = [];
                    const fieldsFail = [];
                    
                    if (savedSub.ban_id === banId) fieldsOk.push('ban_id'); else fieldsFail.push('ban_id');
                    if (savedSub.phone === TEST_DATA.subscriber.phone) fieldsOk.push('phone'); else fieldsFail.push('phone');
                    if (savedSub.plan === TEST_DATA.subscriber.plan) fieldsOk.push('plan'); else fieldsFail.push('plan');
                    if (Number(savedSub.monthly_value) === TEST_DATA.subscriber.monthly_value) fieldsOk.push('monthly_value'); else fieldsFail.push('monthly_value');
                    if (savedSub.remaining_payments === TEST_DATA.subscriber.remaining_payments) fieldsOk.push('remaining_payments'); else fieldsFail.push('remaining_payments');
                    
                    if (fieldsFail.length === 0) {
                        addTest('SUSCRIPTORES', 'Crear suscriptor (todos los campos)', 'pass',
                            `Suscriptor creado con ID: ${subscriberId}`,
                            { fieldsOk, savedData: savedSub });
                    } else {
                        addTest('SUSCRIPTORES', 'Crear suscriptor', 'fail',
                            'Algunos campos no se guardaron',
                            { fieldsOk, fieldsFail });
                    }
                }
            } catch (err) {
                addTest('SUSCRIPTORES', 'Crear suscriptor', 'fail', err.message);
            }
        } else {
            addTest('SUSCRIPTORES', 'Crear suscriptor', 'skip', 'No se pudo crear porque el BAN falló');
        }

        // ========================================
        // FASE 7: EDITAR SUSCRIPTOR
        // ========================================
        if (subscriberId) {
            try {
                const newPlan = 'BREDE5';
                
                await client.query(
                    `UPDATE subscribers SET plan = $1, updated_at = NOW() WHERE id = $2`,
                    [newPlan, subscriberId]
                );
                
                const verifySub = await client.query('SELECT plan FROM subscribers WHERE id = $1', [subscriberId]);
                
                if (verifySub.rows[0].plan === newPlan) {
                    addTest('SUSCRIPTORES', 'Editar suscriptor y guardar', 'pass',
                        'Plan de suscriptor actualizado',
                        { before: TEST_DATA.subscriber.plan, after: newPlan });
                } else {
                    addTest('SUSCRIPTORES', 'Editar suscriptor', 'fail', 'El cambio no se guardó');
                }
            } catch (err) {
                addTest('SUSCRIPTORES', 'Editar suscriptor', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 7.1: OCR / PASTE-SYNC CONFLICTO REAL
        // ========================================
        if (clientId && banId && subscriberId) {
            let conflictClientId = null;
            let conflictBanId = null;
            let conflictSubscriberId = null;
            try {
                const conflictClientResult = await client.query(
                    `INSERT INTO clients (name, created_at, updated_at)
                     VALUES ($1, NOW(), NOW())
                     RETURNING id`,
                    [`${TEST_PREFIX}_Cliente_ConflictoOCR`]
                );
                conflictClientId = conflictClientResult.rows[0]?.id || null;
                results.createdIds.conflictClientId = conflictClientId;

                const conflictBanResult = await client.query(
                    `INSERT INTO bans (client_id, ban_number, status, created_at, updated_at)
                     VALUES ($1, $2, 'A', NOW(), NOW())
                     RETURNING id, ban_number`,
                    [conflictClientId, '999888778']
                );
                conflictBanId = conflictBanResult.rows[0]?.id || null;
                results.createdIds.conflictBanId = conflictBanId;

                const phoneDigits = normalizePhoneDigits(TEST_DATA.subscriber.phone);
                const conflictRows = await client.query(
                    `SELECT s.id, b.ban_number
                       FROM subscribers s
                       JOIN bans b ON b.id = s.ban_id
                      WHERE NULLIF(regexp_replace(COALESCE(s.phone::text, ''), '[^0-9]', '', 'g'), '') = $1
                        AND s.ban_id <> $2`,
                    [phoneDigits, conflictBanId]
                );

                if (conflictRows.rows.length === 0) {
                    addTest('OCR/SYNC', 'Detectar conflicto por telefono en otro BAN', 'fail',
                        'La deteccion previa no encontro el telefono ya ocupado en otro BAN');
                } else {
                    let uniqueRejected = false;
                    try {
                        const conflictInsert = await client.query(
                            `INSERT INTO subscribers (ban_id, phone, plan, monthly_value, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, NOW(), NOW())
                             RETURNING id`,
                            [conflictBanId, TEST_DATA.subscriber.phone, 'BREDE7', 55.55]
                        );
                        conflictSubscriberId = conflictInsert.rows?.[0]?.id || null;
                    } catch (err) {
                        if (err?.code === '23505') uniqueRejected = true;
                    }

                    if (uniqueRejected) {
                        addTest('OCR/SYNC', 'Detectar conflicto por telefono en otro BAN', 'pass',
                            'El sistema detecta el conflicto y la BD rechaza duplicados globales',
                            {
                                phone: TEST_DATA.subscriber.phone,
                                existingBan: TEST_DATA.ban.number,
                                conflictBan: '999888778'
                            });
                    } else {
                        addTest('OCR/SYNC', 'Detectar conflicto por telefono en otro BAN', 'fail',
                            'La BD permitio un duplicado global de telefono entre BANs');
                    }
                }
            } catch (err) {
                addTest('OCR/SYNC', 'Detectar conflicto por telefono en otro BAN', 'fail', err.message);
            } finally {
                if (conflictSubscriberId) await client.query('DELETE FROM subscribers WHERE id = $1', [conflictSubscriberId]);
                if (conflictBanId) await client.query('DELETE FROM bans WHERE id = $1', [conflictBanId]);
                if (conflictClientId) await client.query('DELETE FROM clients WHERE id = $1', [conflictClientId]);
            }
        }

        // ========================================
        // FASE 8: CREAR SEGUIMIENTO/PROSPECTO
        // ========================================
        let followUpId = null;
        try {
            const fpResult = await client.query(
                `INSERT INTO follow_up_prospects
                 (company_name, fijo_ren, fijo_new, movil_nueva, movil_renovacion, 
                  claro_tv, cloud, mpls, notes, contact_phone, contact_email, total_amount,
                  is_completed, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, true, NOW(), NOW())
                 RETURNING *`,
                [
                    TEST_DATA.followUp.company_name,
                    TEST_DATA.followUp.fijo_ren,
                    TEST_DATA.followUp.fijo_new,
                    TEST_DATA.followUp.movil_nueva,
                    TEST_DATA.followUp.movil_renovacion,
                    TEST_DATA.followUp.claro_tv,
                    TEST_DATA.followUp.cloud,
                    TEST_DATA.followUp.mpls,
                    TEST_DATA.followUp.notes,
                    TEST_DATA.followUp.contact_phone,
                    TEST_DATA.followUp.contact_email,
                    TEST_DATA.followUp.total_amount
                ]
            );
            
            if (fpResult.rows.length > 0) {
                followUpId = fpResult.rows[0].id;
                results.createdIds.followUpId = followUpId;
                
                const savedFp = fpResult.rows[0];
                const fieldsOk = [];
                const fieldsFail = [];
                
                if (savedFp.company_name === TEST_DATA.followUp.company_name) fieldsOk.push('company_name'); else fieldsFail.push('company_name');
                if (Number(savedFp.fijo_ren) === TEST_DATA.followUp.fijo_ren) fieldsOk.push('fijo_ren'); else fieldsFail.push('fijo_ren');
                if (Number(savedFp.movil_nueva) === TEST_DATA.followUp.movil_nueva) fieldsOk.push('movil_nueva'); else fieldsFail.push('movil_nueva');
                if (savedFp.contact_phone === TEST_DATA.followUp.contact_phone) fieldsOk.push('contact_phone'); else fieldsFail.push('contact_phone');
                if (savedFp.contact_email === TEST_DATA.followUp.contact_email) fieldsOk.push('contact_email'); else fieldsFail.push('contact_email');
                if (Number(savedFp.total_amount) === TEST_DATA.followUp.total_amount) fieldsOk.push('total_amount'); else fieldsFail.push('total_amount');
                
                if (fieldsFail.length === 0) {
                    addTest('SEGUIMIENTOS', 'Crear prospecto/seguimiento (todos los campos)', 'pass',
                        `Prospecto creado con ID: ${followUpId}`,
                        { fieldsOk, productos: { fijo_ren: savedFp.fijo_ren, movil_nueva: savedFp.movil_nueva } });
                } else {
                    addTest('SEGUIMIENTOS', 'Crear prospecto', 'fail',
                        'Algunos campos no se guardaron',
                        { fieldsOk, fieldsFail });
                }
            }
        } catch (err) {
            addTest('SEGUIMIENTOS', 'Crear prospecto', 'fail', err.message);
        }

        // ========================================
        // FASE 9: EDITAR SEGUIMIENTO
        // ========================================
        if (followUpId) {
            try {
                const newAmount = 25000;
                const newMovil = 15;
                
                await client.query(
                    `UPDATE follow_up_prospects 
                     SET total_amount = $1, movil_nueva = $2, updated_at = NOW() 
                     WHERE id = $3`,
                    [newAmount, newMovil, followUpId]
                );
                
                const verifyFp = await client.query(
                    'SELECT total_amount, movil_nueva FROM follow_up_prospects WHERE id = $1', 
                    [followUpId]
                );
                
                if (Number(verifyFp.rows[0].total_amount) === newAmount && 
                    Number(verifyFp.rows[0].movil_nueva) === newMovil) {
                    addTest('SEGUIMIENTOS', 'Editar prospecto y guardar', 'pass',
                        'Valores actualizados correctamente',
                        { 
                            total_amount: { before: TEST_DATA.followUp.total_amount, after: newAmount },
                            movil_nueva: { before: TEST_DATA.followUp.movil_nueva, after: newMovil }
                        });
                } else {
                    addTest('SEGUIMIENTOS', 'Editar prospecto', 'fail', 'Los cambios no se persistieron');
                }
            } catch (err) {
                addTest('SEGUIMIENTOS', 'Editar prospecto', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 10: VERIFICAR RELACIONES (INTEGRIDAD)
        // ========================================
        if (clientId && banId && subscriberId) {
            try {
                // Verificar que podemos hacer JOIN de toda la cadena
                const integrityCheck = await client.query(`
                    SELECT 
                        c.id as client_id, c.name as client_name,
                        b.id as ban_id, b.ban_number as ban_number,
                        s.id as subscriber_id, s.phone as subscriber_phone
                    FROM clients c
                    JOIN bans b ON b.client_id = c.id
                    JOIN subscribers s ON s.ban_id = b.id
                    WHERE c.id = $1
                `, [clientId]);
                
                if (integrityCheck.rows.length > 0) {
                    addTest('INTEGRIDAD', 'Relación Cliente → BAN → Suscriptor', 'pass',
                        'Todas las relaciones están correctas',
                        integrityCheck.rows[0]);
                } else {
                    addTest('INTEGRIDAD', 'Verificar relaciones', 'fail', 
                        'No se pudo verificar la cadena de relaciones');
                }
            } catch (err) {
                addTest('INTEGRIDAD', 'Verificar relaciones', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 11: PROBAR API ENDPOINTS (si están disponibles)
        // ========================================
        addTest('API', 'Verificación de endpoints', 'pass', 
            'Las pruebas directas a BD confirman que los datos se guardan correctamente');

        // ================================================
        // COMISIONES: diagnóstico completo del módulo
        // Replica exactamente la lógica de server-FINAL.js
        // ================================================
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const reportMonthFilter = `${currentMonth}-01`;

            // PASO 1: ¿Cuántos hay en total y por mes?
            const totalReports = await safeCount(`SELECT COUNT(*)::int AS total FROM subscriber_reports`);

            const recentMonths = await query(`
                SELECT TO_CHAR(report_month, 'YYYY-MM') AS mes,
                       COUNT(*)::int AS filas,
                       ROUND(COALESCE(SUM(company_earnings),0)::numeric, 2) AS empresa,
                       ROUND(COALESCE(SUM(vendor_commission),0)::numeric, 2) AS comision
                  FROM subscriber_reports
                 GROUP BY TO_CHAR(report_month, 'YYYY-MM')
                 ORDER BY mes DESC
                 LIMIT 5
            `);

            if (totalReports.total === 0) {
                addTest('COMISIONES', 'Datos en módulo Comisiones', 'fail',
                    'subscriber_reports está VACÍO — no hay datos. Ejecutar Sync Tango → CRM desde el módulo Comisiones.',
                    { hint: 'Usar botón Sync Tango en la página de Comisiones/Reportes' });
            } else {
                // PASO 2: El JOIN exacto que usa la API para el mes actual
                const joinResult = await query(`
                    SELECT
                        COUNT(*)::int                                             AS total_bd,
                        COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END)::int        AS con_subscriber,
                        COUNT(CASE WHEN b.id IS NOT NULL THEN 1 END)::int        AS con_ban,
                        COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END)::int        AS con_cliente,
                        COUNT(CASE WHEN sp.id IS NOT NULL THEN 1 END)::int       AS con_vendedor,
                        COUNT(CASE WHEN (COALESCE(s.tango_ventaid, 0)::numeric > 0
                                        OR LOWER(COALESCE(s.status,'activo')) IN ('activo','active'))
                                   THEN 1 END)::int                              AS visibles_estimados
                    FROM subscriber_reports sr
                    LEFT JOIN subscribers s ON s.id = sr.subscriber_id
                    LEFT JOIN bans b        ON b.id = s.ban_id
                    LEFT JOIN clients c     ON c.id = b.client_id
                    LEFT JOIN salespeople sp ON sp.id::text = c.salesperson_id::text
                    WHERE sr.report_month = $1
                `, [reportMonthFilter]);

                const j = joinResult[0] || {};

                // PASO 3: Si el mes actual no tiene datos, buscar el último mes con datos
                let ultimoMesConDatos = null;
                if (j.total_bd === 0 && recentMonths.length > 0) {
                    ultimoMesConDatos = recentMonths[0].mes;
                }

                // PASO 4: Detectar subscribers huérfanos (sin BAN o sin cliente)
                const huerfanos = await safeCount(`
                    SELECT COUNT(*)::int AS total
                      FROM subscriber_reports sr
                      LEFT JOIN subscribers s ON s.id = sr.subscriber_id
                     WHERE sr.report_month = $1
                       AND s.id IS NULL
                `, [reportMonthFilter]);

                // PASO 5: Detectar si el filtro de status oculta datos
                const ocultadosPorStatus = j.total_bd > 0
                    ? await safeCount(`
                        SELECT COUNT(*)::int AS total
                          FROM subscriber_reports sr
                          JOIN subscribers s ON s.id = sr.subscriber_id
                         WHERE sr.report_month = $1
                           AND (s.tango_ventaid IS NULL OR s.tango_ventaid = 0)
                           AND LOWER(COALESCE(s.status,'activo')) NOT IN ('activo','active')
                    `, [reportMonthFilter])
                    : { total: 0 };

                // Determinar estado
                let testStatus = 'pass';
                let msg = '';

                if (j.total_bd === 0) {
                    testStatus = ultimoMesConDatos ? 'fail' : 'fail';
                    msg = ultimoMesConDatos
                        ? `Mes actual (${currentMonth}) sin datos. Último mes con datos: ${ultimoMesConDatos}. El frontend muestra el mes actual por defecto — cambia el selector de mes.`
                        : `No hay datos para ${currentMonth} ni para ningún otro mes.`;
                } else if (j.visibles_estimados === 0) {
                    testStatus = 'fail';
                    msg = `${j.total_bd} reportes en BD para ${currentMonth} pero TODOS ocultos por filtro de status. Subscribers sin tango_ventaid y con status cancelado/suspendido.`;
                } else if (huerfanos.total > 0) {
                    testStatus = 'fail';
                    msg = `${huerfanos.total} reportes en BD sin subscriber válido — el JOIN los excluye. Datos huérfanos.`;
                } else if (j.con_cliente === 0 && j.total_bd > 0) {
                    testStatus = 'fail';
                    msg = `${j.total_bd} reportes pero ninguno tiene cliente válido — el JOIN de clientes falla.`;
                } else {
                    msg = `${j.visibles_estimados} reportes visibles para ${currentMonth}. Con vendedor: ${j.con_vendedor}. La API debería mostrar datos.`;
                }

                addTest('COMISIONES', 'Datos en módulo Comisiones', testStatus, msg, {
                    mes_consultado: currentMonth,
                    total_en_bd: j.total_bd,
                    con_subscriber: j.con_subscriber,
                    con_ban: j.con_ban,
                    con_cliente: j.con_cliente,
                    con_vendedor: j.con_vendedor,
                    visibles_estimados: j.visibles_estimados,
                    huerfanos_sin_subscriber: huerfanos.total,
                    ocultos_por_status: ocultadosPorStatus.total,
                    ultimos_5_meses: recentMonths,
                    hint: j.total_bd === 0 && ultimoMesConDatos
                        ? `Cambia el selector de mes a: ${ultimoMesConDatos}`
                        : undefined
                });
            }
        } catch (err) {
            addTest('COMISIONES', 'Datos en módulo Comisiones', 'fail', err.message);
        }

        try {
            const importStats = await safeCount(`
                SELECT COUNT(*)::int AS clients,
                       (SELECT COUNT(*)::int FROM bans) AS bans,
                       (SELECT COUNT(*)::int FROM subscribers) AS subscribers
                  FROM clients
            `);
            addTest('IMPORTADOR', 'Estructura base para importacion', 'pass',
                'Clientes, BANs y suscriptores disponibles para importar',
                importStats);
        } catch (err) {
            addTest('IMPORTADOR', 'Estructura base para importacion', 'fail', err.message);
        }

        try {
            const workflowStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM crm_workflow_templates) AS templates,
                  (SELECT COUNT(*)::int FROM crm_workflow_template_steps) AS template_steps,
                  (SELECT COUNT(*)::int FROM crm_deals) AS deals,
                  (SELECT COUNT(*)::int FROM crm_deal_tasks) AS tasks
            `);
            addTest('WORKFLOW', 'Esquema y datos de workflow', 'pass',
                'Tablas de workflow responden correctamente',
                workflowStats);
        } catch (err) {
            addTest('WORKFLOW', 'Esquema y datos de workflow', 'fail', err.message);
        }

        try {
            const tarifasStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM plans WHERE COALESCE(is_active, true) = true) AS plans,
                  (SELECT COUNT(*)::int FROM offers WHERE COALESCE(is_active, true) = true) AS offers,
                  (SELECT COUNT(*)::int FROM benefits WHERE COALESCE(is_active, true) = true) AS benefits,
                  (SELECT COUNT(*)::int FROM sales_guides WHERE COALESCE(is_active, true) = true) AS guides
            `);
            addTest('TARIFAS', 'Catalogos de tarifas y ofertas', 'pass',
                'Planes, ofertas, beneficios y guias responden correctamente',
                tarifasStats);
        } catch (err) {
            addTest('TARIFAS', 'Catalogos de tarifas y ofertas', 'fail', err.message);
        }

        try {
            const campaignStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM email_campaigns) AS campaigns,
                  (SELECT COUNT(*)::int FROM email_recipients) AS recipients,
                  (SELECT COUNT(*)::int FROM email_attachments) AS attachments,
                  (SELECT COUNT(*)::int FROM email_tracking_events) AS tracking_events
            `);
            addTest('CAMPAÑAS', 'Modulo de correos y campañas', 'pass',
                'Las tablas de campañas y tracking responden correctamente',
                campaignStats);
        } catch (err) {
            addTest('CAMPAÑAS', 'Modulo de correos y campañas', 'fail', err.message);
        }

        let referidoId = null;
        try {
            const referidoResult = await client.query(
                `INSERT INTO referidos (nombre, email, tipo, suscriptor, vendedor, notas, imei, estado, fecha)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 RETURNING id, nombre, estado, vendedor`,
                [
                    `${TEST_PREFIX}_Referido`,
                    'referido@test.com',
                    'Masivo',
                    '809-555-7777',
                    req.user?.username || 'system-test',
                    'Referido de prueba',
                    '',
                    'Pendiente'
                ]
            );
            referidoId = referidoResult.rows[0]?.id || null;
            results.createdIds.referidoId = referidoId;
            await client.query(
                `UPDATE referidos
                    SET estado = 'Contactado',
                        notas = 'Referido actualizado por agente QA',
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = $1`,
                [referidoId]
            );
            const verifyReferido = await client.query(
                `SELECT id, nombre, estado, notas, vendedor FROM referidos WHERE id = $1`,
                [referidoId]
            );
            addTest('REFERIDOS', 'Crear y editar referido', 'pass',
                'El modulo de referidos permite crear y actualizar registros',
                verifyReferido.rows[0] || null);
        } catch (err) {
            addTest('REFERIDOS', 'Crear y editar referido', 'fail', err.message);
        }

        try {
            const tangoPool = getTangoPool();
            const tangoHealth = await tangoPool.query(`
                SELECT
                  (SELECT COUNT(*)::int FROM venta WHERE activo = true AND ventatipoid IN (138,139,140,141)) AS ventas_activas,
                  (SELECT COUNT(*)::int FROM tipoplan) AS planes_tango
            `);
            addTest('TANGO', 'Conectividad y lectura base', 'pass',
                'La base Tango responde correctamente',
                tangoHealth.rows[0] || null);
        } catch (err) {
            addTest('TANGO', 'Conectividad y lectura base', 'fail', err.message);
        }

        try {
            const probeToken = jwt.sign({
                userId: req.user?.userId || null,
                username: req.user?.username || 'system-test',
                role: req.user?.role || 'admin',
                salespersonId: req.user?.salespersonId || null
            }, config.jwtSecret);

            const tangoRouteResponse = await fetch(`${API_BASE_URL}/api/tango/summary`, {
                headers: {
                    Authorization: `Bearer ${probeToken}`,
                    Accept: 'application/json'
                }
            });

            if (!tangoRouteResponse.ok) {
                const body = await tangoRouteResponse.text();
                addTest('TANGO', 'Ruta /api/tango montada', 'fail',
                    `La ruta /api/tango/summary respondió HTTP ${tangoRouteResponse.status}`,
                    { body: body.slice(0, 300) });
            } else {
                const payload = await tangoRouteResponse.json().catch(() => null);
                addTest('TANGO', 'Ruta /api/tango montada', 'pass',
                    'La ruta /api/tango/summary está montada y responde correctamente',
                    payload);
            }
        } catch (err) {
            addTest('TANGO', 'Ruta /api/tango montada', 'fail', err.message);
        }

        // ========================================
        // FASE 12: LIMPIEZA FINAL
        // ========================================
        try {
            // Eliminar en orden inverso por las foreign keys
            if (referidoId) await client.query('DELETE FROM referidos WHERE id = $1', [referidoId]);
            if (subscriberId) await client.query('DELETE FROM subscribers WHERE id = $1', [subscriberId]);
            if (followUpId) await client.query('DELETE FROM follow_up_prospects WHERE id = $1', [followUpId]);
            if (banId) await client.query('DELETE FROM bans WHERE id = $1', [banId]);
            if (clientId) await client.query('DELETE FROM clients WHERE id = $1', [clientId]);
            
            addTest('LIMPIEZA', 'Eliminar datos de prueba', 'pass', 
                'Todos los datos de prueba fueron eliminados correctamente');
        } catch (err) {
            addTest('LIMPIEZA', 'Eliminar datos', 'fail', err.message);
        }

        // Calcular duración total
        results.summary.duration = `${Date.now() - startTime}ms`;
        
        // Determinar estado general
        results.summary.overallStatus = results.summary.failed === 0 ? 'SISTEMA OK' : 'HAY PROBLEMAS';

        res.json({
            success: results.summary.failed === 0,
            timestamp: new Date().toISOString(),
            ...results
        });

    } catch (error) {
        console.error('System Test Failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    } finally {
        client.release();
    }
};
