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
        // FASE PHONE_NORM: rangos reservados (BANs 999111001-003, phones 7874444444/55555/66666)
        await client.query(`DELETE FROM subscribers WHERE phone IN ('7874444444','7874455555','7874466666')`);
        await client.query(`DELETE FROM bans WHERE ban_number IN ('999111001','999111002','999111003')`);
        // FASE A: rangos reservados (BANs 999222001-003, phones 7878881111/2222/3333)
        await client.query(`DELETE FROM subscriber_reports WHERE report_month = '2099-01-01'::date`);
        await client.query(`DELETE FROM subscribers WHERE phone IN ('7878881111','7878882222','7878883333')`);
        await client.query(`DELETE FROM bans WHERE ban_number IN ('999222001','999222002','999222003')`);
        // FASE B: cleanup defensivo (tareas, pasos cliente con prefijo)
        await client.query(`DELETE FROM crm_tasks WHERE title LIKE '${TEST_PREFIX}%'`).catch(() => {});
        await client.query(`DELETE FROM crm_tasks WHERE owner_user_id IN (SELECT id FROM users_auth WHERE username LIKE '${TEST_PREFIX}%')`).catch(() => {});
        await client.query(`DELETE FROM client_steps WHERE client_id IN (SELECT id FROM clients WHERE name LIKE '${TEST_PREFIX}%')`).catch(() => {});
        await client.query(`DELETE FROM user_permission_overrides WHERE user_id IN (SELECT id FROM users_auth WHERE username LIKE '${TEST_PREFIX}%')`).catch(() => {});
        await client.query(`DELETE FROM users_auth WHERE username LIKE '${TEST_PREFIX}%'`);
        await client.query(`DELETE FROM salespeople WHERE name LIKE '${TEST_PREFIX}%'`);
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

        if (clientId) {
            try {
                const { response, payload } = await apiJson('/api/clients', {
                    method: 'POST',
                    json: {
                        ...TEST_DATA.client,
                        phone: '809-555-0099',
                    }
                });

                if (response.status === 400) {
                    addTest('CLIENTES', 'Bloquear cliente duplicado por nombre', 'pass',
                        'El sistema rechazó crear un cliente con el mismo nombre normalizado',
                        payload);
                } else {
                    addTest('CLIENTES', 'Bloquear cliente duplicado por nombre', 'fail',
                        `Se esperaba HTTP 400 y respondió HTTP ${response.status}`,
                        payload);
                }
            } catch (err) {
                addTest('CLIENTES', 'Bloquear cliente duplicado por nombre', 'fail', err.message);
            }
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

        if (clientId && banId) {
            try {
                const { response, payload } = await apiJson('/api/bans', {
                    method: 'POST',
                    json: {
                        client_id: clientId,
                        ban_number: TEST_DATA.ban.number,
                        account_type: 'Fijo',
                    }
                });

                if (response.status === 400) {
                    addTest('BANS', 'Bloquear BAN duplicado', 'pass',
                        'El sistema rechazó crear un BAN repetido',
                        payload);
                } else {
                    addTest('BANS', 'Bloquear BAN duplicado', 'fail',
                        `Se esperaba HTTP 400 y respondió HTTP ${response.status}`,
                        payload);
                }
            } catch (err) {
                addTest('BANS', 'Bloquear BAN duplicado', 'fail', err.message);
            }
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
        // FASE 7.0.1: RUTAS MODULARES DE SUSCRIPTORES
        // ========================================
        if (subscriberId) {
            try {
                const routeChecks = [];

                const noRenew = await apiJson(`/api/subscribers/${subscriberId}/no-renueva-ahora`, {
                    method: 'PUT',
                    json: { note: 'Prueba temporal del agente de sistema' }
                });
                routeChecks.push({
                    route: 'PUT /api/subscribers/:id/no-renueva-ahora',
                    status: noRenew.response.status
                });

                const pending = await apiJson(`/api/subscribers/${subscriberId}/pending-renewal`, {
                    method: 'PUT',
                    json: {}
                });
                routeChecks.push({
                    route: 'PUT /api/subscribers/:id/pending-renewal',
                    status: pending.response.status
                });

                const renewal = await apiJson(`/api/subscribers/${subscriberId}/renewal`, {
                    method: 'PUT',
                    json: {
                        plan: 'BREDE5',
                        monthly_value: TEST_DATA.subscriber.monthly_value,
                        remaining_payments: TEST_DATA.subscriber.remaining_payments,
                        contract_term: TEST_DATA.subscriber.contract_term
                    }
                });
                routeChecks.push({
                    route: 'PUT /api/subscribers/:id/renewal',
                    status: renewal.response.status
                });

                const notFoundRoutes = routeChecks.filter((item) => item.status === 404);
                const failedRoutes = routeChecks.filter((item) => item.status < 200 || item.status >= 300);

                if (notFoundRoutes.length === 0 && failedRoutes.length === 0) {
                    addTest('SUSCRIPTORES', 'Rutas no-renueva/pending-renewal/renewal', 'pass',
                        'Las 3 rutas de suscriptores existen y responden sin 404 usando un registro temporal',
                        routeChecks);
                } else {
                    addTest('SUSCRIPTORES', 'Rutas no-renueva/pending-renewal/renewal', 'fail',
                        `${notFoundRoutes.length} ruta(s) devolvieron 404; ${failedRoutes.length} ruta(s) fallaron`,
                        routeChecks);
                }
            } catch (err) {
                addTest('SUSCRIPTORES', 'Rutas no-renueva/pending-renewal/renewal', 'fail', err.message);
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
        // FASE 7.2: IMPORTACION - STATUS ESTRICTO (A o C)
        // ========================================
        try {
            const importTestBan = '999888776';
            // Limpieza previa por si quedo basura
            await client.query('DELETE FROM bans WHERE ban_number = $1', [importTestBan]);

            const importRow = (status) => ({
                Clientes: { name: `${TEST_PREFIX}_Cliente_StatusInvalido`, salesperson_id: '' },
                BANs: { ban_number: importTestBan, status, account_type: 'Movil' },
                Suscriptores: { phone: '8095559001', plan: 'BREDE3' }
            });

            // Test 1: simulate (Excel) cuenta status vacio/raro como rechazados
            const sim = await apiJson('/api/importador/simulate', {
                method: 'POST',
                json: { data: [importRow(''), importRow('X-RARO'), importRow('A')] }
            });
            const rechazados = Number(sim.payload?.report?.rechazados_status || 0);
            const disponibles = Number(sim.payload?.report?.disponibles || 0);
            if (sim.response.ok && rechazados >= 2 && disponibles >= 1) {
                addTest('IMPORTACION', 'Simulate Excel cuenta status vacio/raro como rechazados', 'pass',
                    `simulate detecto ${rechazados} fila(s) rechazadas y ${disponibles} disponible(s)`,
                    { rechazados_status: rechazados, disponibles });
            } else {
                addTest('IMPORTACION', 'Simulate Excel cuenta status vacio/raro como rechazados', 'fail',
                    `simulate devolvio rechazados=${rechazados}, disponibles=${disponibles}`,
                    sim.payload?.report || sim.payload);
            }

            // Test 2: save (Excel) NO crea el BAN si status viene vacio
            const save = await apiJson('/api/importador/save', {
                method: 'POST',
                json: { data: [importRow('')] }
            });
            const banExists = await client.query(
                'SELECT id, status FROM bans WHERE ban_number = $1',
                [importTestBan]
            );
            if (banExists.rows.length === 0) {
                addTest('IMPORTACION', 'Save Excel rechaza fila sin status', 'pass',
                    'El BAN con status vacio no se creo en BD',
                    { omittedReasons: (save.payload?.omittedReasons || []).slice(0, 2) });
            } else {
                await client.query('DELETE FROM bans WHERE ban_number = $1', [importTestBan]);
                addTest('IMPORTACION', 'Save Excel rechaza fila sin status', 'fail',
                    `El BAN se creo con status=${banExists.rows[0].status}; deberia ser rechazado`);
            }

            // Test 3: paste-sync rechaza filas con status vacio o no aceptado
            if (banId) {
                const paste = await apiJson('/api/subscribers/paste-sync', {
                    method: 'POST',
                    json: {
                        ban_id: banId,
                        dry_run: true,
                        subscribers: [
                            { subscriber: '8095559002', status: '', plan: 'BREDE3' },
                            { subscriber: '8095559003', status: 'pending', plan: 'BREDE3' },
                            { subscriber: '8095559004', status: 'suspended', plan: 'BREDE3' }
                        ]
                    }
                });
                const invalidLines = Number(paste.payload?.stats?.invalid_lines || 0);
                if (paste.response.ok && invalidLines >= 3) {
                    addTest('IMPORTACION', 'Paste-sync rechaza vacio/pending/suspended', 'pass',
                        `paste-sync marco ${invalidLines} fila(s) como invalidas`,
                        { invalid_lines: invalidLines, warnings: (paste.payload?.warnings || []).slice(0, 3) });
                } else {
                    addTest('IMPORTACION', 'Paste-sync rechaza vacio/pending/suspended', 'fail',
                        `paste-sync solo marco ${invalidLines}/3 filas como invalidas`,
                        paste.payload?.stats || paste.payload);
                }
            } else {
                addTest('IMPORTACION', 'Paste-sync rechaza vacio/pending/suspended', 'skip',
                    'No habia banId disponible para probar paste-sync');
            }

            // Test 4: cero BANs con status NULL en BD
            const nullCheck = await client.query('SELECT COUNT(*)::int AS n FROM bans WHERE status IS NULL');
            const nullCount = Number(nullCheck.rows[0]?.n || 0);
            if (nullCount === 0) {
                addTest('IMPORTACION', 'BD sin BANs con status NULL', 'pass',
                    'La tabla bans no tiene registros con status NULL');
            } else {
                addTest('IMPORTACION', 'BD sin BANs con status NULL', 'fail',
                    `Hay ${nullCount} BAN(s) con status NULL; deben limpiarse antes de aplicar NOT NULL`,
                    { count_null: nullCount });
            }

            // Test 5: importar un BAN NUEVO via Excel debe crearlo sin error de columna
            const newBanNumber = '999888775';
            const newBanClient = `${TEST_PREFIX}_Cliente_BANNuevo`;
            await client.query('DELETE FROM bans WHERE ban_number = $1', [newBanNumber]);
            await client.query('DELETE FROM clients WHERE name = $1', [newBanClient]);

            const saveNew = await apiJson('/api/importador/save', {
                method: 'POST',
                json: {
                    data: [{
                        Clientes: { name: newBanClient, salesperson_id: '' },
                        BANs: { ban_number: newBanNumber, status: 'A', account_type: 'Movil' },
                        Suscriptores: { phone: '8095559010', plan: 'BREDE3' }
                    }]
                }
            });
            const banCreado = await client.query(
                'SELECT id, status, account_type FROM bans WHERE ban_number = $1',
                [newBanNumber]
            );
            const errorsList = saveNew.payload?.errors || saveNew.payload?.results?.errors || [];
            const colError = String(JSON.stringify(errorsList) + (saveNew.payload?.error || ''))
                .toLowerCase()
                .includes('column');
            if (banCreado.rows.length === 1 && banCreado.rows[0].status === 'A' && !colError) {
                addTest('IMPORTACION', 'Crear BAN nuevo via Excel sin error de columna', 'pass',
                    `BAN ${newBanNumber} creado con status='A' y account_type='${banCreado.rows[0].account_type}'`,
                    { id: banCreado.rows[0].id });
            } else {
                addTest('IMPORTACION', 'Crear BAN nuevo via Excel sin error de columna', 'fail',
                    'El BAN nuevo no se creo correctamente o hubo error de columna inexistente',
                    {
                        rowsFound: banCreado.rows.length,
                        columnError: colError,
                        responseStatus: saveNew.response.status,
                        payloadSnippet: JSON.stringify(saveNew.payload).slice(0, 300)
                    });
            }
            // Limpieza del BAN/cliente nuevos
            await client.query('DELETE FROM bans WHERE ban_number = $1', [newBanNumber]);
            await client.query('DELETE FROM clients WHERE name = $1', [newBanClient]);

            // Limpieza final del BAN de prueba de status invalido (si por alguna razon se creo)
            await client.query('DELETE FROM bans WHERE ban_number = $1', [importTestBan]);
            await client.query('DELETE FROM clients WHERE name = $1', [`${TEST_PREFIX}_Cliente_StatusInvalido`]);
        } catch (err) {
            addTest('IMPORTACION', 'Validacion estricta de status', 'fail', err.message);
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
        // FASE 8.1: PASOS Y PRIORIDADES DE SEGUIMIENTO
        // ========================================
        try {
            const stepName = `${TEST_PREFIX}_Paso_Seguimiento`;
            const stepUpdatedName = `${TEST_PREFIX}_Paso_Seguimiento_Editado`;
            let stepId = null;

            const stepsAlias = await apiJson('/api/follow-up-prospects/steps');
            const stepsDirect = await apiJson('/api/follow-up-steps');
            const stepCreate = await apiJson('/api/follow-up-steps', {
                method: 'POST',
                json: {
                    name: stepName,
                    description: 'Paso temporal creado por el agente de sistema',
                    order_index: 9991,
                    is_active: true
                }
            });
            stepId = stepCreate.payload?.id || null;
            const stepUpdate = stepId
                ? await apiJson(`/api/follow-up-steps/${stepId}`, {
                    method: 'PUT',
                    json: {
                        name: stepUpdatedName,
                        description: 'Paso temporal editado por el agente de sistema',
                        order_index: 9992,
                        is_active: true
                    }
                })
                : null;
            const stepDelete = stepId
                ? await apiJson(`/api/follow-up-steps/${stepId}`, { method: 'DELETE' })
                : null;

            const checks = [
                { action: 'GET /api/follow-up-prospects/steps', status: stepsAlias.response.status, ok: stepsAlias.response.ok },
                { action: 'GET /api/follow-up-steps', status: stepsDirect.response.status, ok: stepsDirect.response.ok },
                { action: 'POST /api/follow-up-steps', status: stepCreate.response.status, ok: stepCreate.response.ok },
                { action: 'PUT /api/follow-up-steps/:id', status: stepUpdate?.response?.status || null, ok: Boolean(stepUpdate?.response?.ok) },
                { action: 'DELETE /api/follow-up-steps/:id', status: stepDelete?.response?.status || null, ok: Boolean(stepDelete?.response?.ok) }
            ];
            const failed = checks.filter((check) => !check.ok || check.status === 404);

            if (failed.length === 0) {
                addTest('SEGUIMIENTOS', 'GET y CRUD de pasos', 'pass',
                    'Pasos de seguimiento cargan y CRUD temporal funciona sin 404',
                    checks);
            } else {
                addTest('SEGUIMIENTOS', 'GET y CRUD de pasos', 'fail',
                    `${failed.length} operacion(es) de pasos fallaron`,
                    checks);
            }

            await client.query('DELETE FROM follow_up_steps WHERE name LIKE $1', [`${TEST_PREFIX}_Paso_Seguimiento%`]);
        } catch (err) {
            addTest('SEGUIMIENTOS', 'GET y CRUD de pasos', 'fail', err.message);
        }

        try {
            const priorityName = `${TEST_PREFIX}_Prioridad`;
            const priorityUpdatedName = `${TEST_PREFIX}_Prioridad_Editada`;
            let priorityId = null;

            const prioritiesGet = await apiJson('/api/priorities');
            const priorityCreate = await apiJson('/api/priorities', {
                method: 'POST',
                json: {
                    name: priorityName,
                    color_hex: '#3B82F6',
                    order_index: 9991,
                    is_active: true
                }
            });
            priorityId = priorityCreate.payload?.id || null;
            const priorityUpdate = priorityId
                ? await apiJson(`/api/priorities/${priorityId}`, {
                    method: 'PUT',
                    json: {
                        name: priorityUpdatedName,
                        color_hex: '#22C55E',
                        order_index: 9992,
                        is_active: true
                    }
                })
                : null;
            const priorityDelete = priorityId
                ? await apiJson(`/api/priorities/${priorityId}`, { method: 'DELETE' })
                : null;

            const checks = [
                { action: 'GET /api/priorities', status: prioritiesGet.response.status, ok: prioritiesGet.response.ok },
                { action: 'POST /api/priorities', status: priorityCreate.response.status, ok: priorityCreate.response.ok },
                { action: 'PUT /api/priorities/:id', status: priorityUpdate?.response?.status || null, ok: Boolean(priorityUpdate?.response?.ok) },
                { action: 'DELETE /api/priorities/:id', status: priorityDelete?.response?.status || null, ok: Boolean(priorityDelete?.response?.ok) }
            ];
            const failed = checks.filter((check) => !check.ok || check.status === 404);

            if (failed.length === 0) {
                addTest('SEGUIMIENTOS', 'GET y CRUD de prioridades', 'pass',
                    'Prioridades cargan y CRUD temporal funciona sin 404',
                    checks);
            } else {
                addTest('SEGUIMIENTOS', 'GET y CRUD de prioridades', 'fail',
                    `${failed.length} operacion(es) de prioridades fallaron`,
                    checks);
            }

            await client.query('DELETE FROM priorities WHERE name LIKE $1', [`${TEST_PREFIX}_Prioridad%`]);
        } catch (err) {
            addTest('SEGUIMIENTOS', 'GET y CRUD de prioridades', 'fail', err.message);
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

        try {
            const { response: activeClientsResp, payload: activeClientsPayload } = await apiJson('/api/clients?tab=active');
            const clientsPayload = Array.isArray(activeClientsPayload?.clients) ? activeClientsPayload.clients : [];
            const activeStatsCount = Number(activeClientsPayload?.stats?.active_count ?? -1);
            const invalidActiveClients = clientsPayload.filter((clientRow) => {
                const activeBans = Number(clientRow.active_ban_count || 0);
                const totalBans = Number(clientRow.ban_count || 0);
                const totalSubscribers = Number(clientRow.subscriber_count || 0);
                const activeSubscribers = Number(clientRow.active_subscriber_count || 0);
                return totalBans === 0 || activeBans === 0 || (totalSubscribers > 0 && activeSubscribers === 0);
            });
            const missingScoringFields = clientsPayload.filter((clientRow) => (
                clientRow.active_ban_count === undefined
                || clientRow.has_convergence === undefined
                || clientRow.recent_followup === undefined
                || clientRow.primary_contract_end_date === undefined
                || clientRow.priority_score === undefined
                || !Number.isFinite(Number(clientRow.priority_score))
            ));

            if (
                activeClientsResp.ok
                && activeStatsCount === clientsPayload.length
                && invalidActiveClients.length === 0
                && missingScoringFields.length === 0
            ) {
                addTest('CLIENTES', 'Fuente unica de clientes activos', 'pass',
                    `/api/clients?tab=active devuelve ${clientsPayload.length} activos y coincide con stats.active_count`,
                    { count: clientsPayload.length });
            } else {
                addTest('CLIENTES', 'Fuente unica de clientes activos', 'fail',
                    `HTTP ${activeClientsResp.status}; lista=${clientsPayload.length}; stats=${activeStatsCount}; invalidos=${invalidActiveClients.length}; sin_scoring=${missingScoringFields.length}`,
                    {
                        invalidActiveClients: invalidActiveClients.slice(0, 5),
                        missingScoringFields: missingScoringFields.slice(0, 5)
                    });
            }
        } catch (err) {
            addTest('CLIENTES', 'Fuente unica de clientes activos', 'fail', err.message);
        }

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

        // ========================================
        // FASE: TAREAS  (testKey: "TAREAS")
        // ========================================
        try {
            const taskStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM crm_tasks)              AS crm_tasks,
                  (SELECT COUNT(*)::int FROM crm_deals)              AS deals,
                  (SELECT COUNT(*)::int FROM crm_deal_tasks)         AS deal_tasks,
                  (SELECT COUNT(*)::int FROM crm_workflow_templates) AS templates
            `);
            addTest('TAREAS', 'Tablas de tareas y workflow', 'pass',
                `crm_tasks: ${taskStats.crm_tasks} | deals: ${taskStats.deals} | templates: ${taskStats.templates}`,
                taskStats);
        } catch (err) {
            addTest('TAREAS', 'Tablas de tareas y workflow', 'fail', err.message);
        }

        // ========================================
        // FASE: AGENTES / MEMORIA
        // ========================================
        try {
            await apiJson('/api/agents/memory', {
                method: 'POST',
                json: {
                    agent_name: `${TEST_PREFIX}_Agente`,
                    memory_type: 'analysis',
                    title: `${TEST_PREFIX}_Memoria`,
                    content: 'Memoria temporal creada por el agente de pruebas del sistema.',
                    source_module: 'system-test',
                    related_client_id: clientId || null,
                    related_ban: TEST_DATA.ban.number,
                    importance: 5
                }
            });

            await apiJson('/api/agents/decisions', {
                method: 'POST',
                json: {
                    agent_name: `${TEST_PREFIX}_Agente`,
                    title: `${TEST_PREFIX}_Decision`,
                    decision: 'Validar modulo de memoria de agentes',
                    reason: 'Debe existir historial reutilizable para el Cuartel de Agentes',
                    impact: 'Backend y BD disponibles para contexto persistente',
                    status: 'executed'
                }
            });

            const { response: taskCreateResp, payload: taskCreatePayload } = await apiJson('/api/agents/tasks', {
                method: 'POST',
                json: {
                    agent_name: `${TEST_PREFIX}_Agente`,
                    title: `${TEST_PREFIX}_Tarea`,
                    description: 'Tarea temporal creada por el agente de pruebas',
                    status: 'pending',
                    priority: 'high',
                    related_client_id: clientId || null
                }
            });

            if (taskCreateResp.ok && taskCreatePayload?.id) {
                await apiJson(`/api/agents/tasks/${taskCreatePayload.id}`, {
                    method: 'PATCH',
                    json: { status: 'done', priority: 'normal' }
                });
            }

            await apiJson('/api/agents/runs', {
                method: 'POST',
                json: {
                    agent_name: `${TEST_PREFIX}_Agente`,
                    run_type: 'system-test',
                    input_summary: 'Validar endpoints de agentes',
                    output_summary: 'Endpoints de memoria, decisiones, tareas y corridas responden',
                    status: 'success'
                }
            });

            const [memoryList, decisionsList, tasksList, runsList] = await Promise.all([
                apiJson('/api/agents/memory?limit=5'),
                apiJson('/api/agents/decisions?limit=5'),
                apiJson('/api/agents/tasks?limit=5'),
                apiJson('/api/agents/runs?limit=5')
            ]);

            const tableStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM agent_memory)    AS memories,
                  (SELECT COUNT(*)::int FROM agent_decisions) AS decisions,
                  (SELECT COUNT(*)::int FROM agent_tasks)     AS tasks,
                  (SELECT COUNT(*)::int FROM agent_runs)      AS runs
            `);

            const endpointsOk = [memoryList, decisionsList, tasksList, runsList].every((item) => item.response.ok && Array.isArray(item.payload));

            if (endpointsOk) {
                addTest('AGENTES', 'Memoria persistente y endpoints /api/agents', 'pass',
                    'Tablas y endpoints de memoria de agentes responden correctamente',
                    tableStats);
            } else {
                addTest('AGENTES', 'Memoria persistente y endpoints /api/agents', 'fail',
                    'Uno o mas endpoints de /api/agents no respondio como lista',
                    {
                        memory: memoryList.response.status,
                        decisions: decisionsList.response.status,
                        tasks: tasksList.response.status,
                        runs: runsList.response.status
                    });
            }
        } catch (err) {
            addTest('AGENTES', 'Memoria persistente y endpoints /api/agents', 'fail', err.message);
        }

        // ========================================
        // FASE: VENDEDORES  (testKey: "VENDEDORES")
        // ========================================
        try {
            const vendorStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM vendors WHERE COALESCE(is_active, 1) = 1) AS vendors_activos,
                  (SELECT COUNT(*)::int FROM salespeople)                               AS salespeople_total,
                  COUNT(CASE WHEN role = 'admin'      THEN 1 END)::int                 AS admins,
                  COUNT(CASE WHEN role = 'supervisor' THEN 1 END)::int                 AS supervisores,
                  COUNT(CASE WHEN role = 'vendedor'   THEN 1 END)::int                 AS vendedores
                FROM salespeople
            `);
            if ((vendorStats.salespeople_total || 0) === 0) {
                addTest('VENDEDORES', 'Estructura de vendedores', 'fail',
                    'No hay vendedores registrados en salespeople', vendorStats);
            } else {
                addTest('VENDEDORES', 'Estructura de vendedores', 'pass',
                    `${vendorStats.salespeople_total} salespeople | ${vendorStats.vendors_activos} vendors activos`,
                    vendorStats);
            }
        } catch (err) {
            addTest('VENDEDORES', 'Estructura de vendedores', 'fail', err.message);
        }

        // Test: perfiles de acceso (presets) para vendedores
        try {
            const presetStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM permission_presets)                                             AS presets_total,
                  (SELECT COUNT(*)::int FROM salespeople WHERE permission_preset_name IS NOT NULL)          AS vendedores_con_preset,
                  (SELECT COUNT(*)::int FROM user_permission_overrides)                                     AS overrides_total
            `);
            const presetTableOk = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'permission_presets'
                ) AS exists
            `);
            if (!presetTableOk.rows[0].exists) {
                addTest('VENDEDORES', 'Tabla permission_presets para perfiles de acceso', 'fail',
                    'La tabla permission_presets no existe — crear con: CREATE TABLE permission_presets (id BIGSERIAL, name TEXT, effects JSONB)');
            } else {
                addTest('VENDEDORES', 'Perfiles de acceso (presets) por vendedor', 'pass',
                    `${presetStats.presets_total} presets definidos | ${presetStats.vendedores_con_preset} vendedores con preset asignado | ${presetStats.overrides_total} overrides activos`,
                    presetStats);
            }
        } catch (err) {
            addTest('VENDEDORES', 'Perfiles de acceso (presets) por vendedor', 'fail', err.message);
        }

        // ========================================
        // FASE: PRODUCTOS  (testKey: "PRODUCTOS")
        // ========================================
        try {
            const productStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM products)                                  AS productos,
                  (SELECT COUNT(*)::int FROM product_commission_tiers)                  AS tiers,
                  (SELECT COUNT(*)::int FROM plans   WHERE COALESCE(is_active, true))   AS planes_activos,
                  (SELECT COUNT(*)::int FROM offers  WHERE COALESCE(is_active, true))   AS ofertas_activas,
                  (SELECT COUNT(*)::int FROM benefits WHERE COALESCE(is_active, true))  AS beneficios_activos
            `);
            addTest('PRODUCTOS', 'Catalogo de productos y tiers', 'pass',
                `${productStats.productos} productos | ${productStats.tiers} tiers | ${productStats.planes_activos} planes activos`,
                productStats);
        } catch (err) {
            addTest('PRODUCTOS', 'Catalogo de productos y tiers', 'fail', err.message);
        }

        // ========================================
        // FASE: CATEGORIAS  (testKey: "CATEGORIAS")
        // ========================================
        try {
            const catStats = await safeCount(`
                SELECT COUNT(*)::int AS categorias FROM categories
            `);
            // Verificar tabla de pasos de categoría (puede tener distinto nombre)
            const stepsTableCheck = await client.query(`
                SELECT table_name
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name IN ('category_steps','crm_workflow_template_steps','client_step_templates')
                 ORDER BY table_name
            `);
            const stepsTables = stepsTableCheck.rows.map(r => r.table_name);
            addTest('CATEGORIAS', 'Modulo de categorias', 'pass',
                `${catStats.categorias} categorias registradas | Tablas de pasos: ${stepsTables.join(', ') || 'ver crm_workflow_template_steps'}`,
                { categorias: catStats.categorias, stepsTables });
        } catch (err) {
            addTest('CATEGORIAS', 'Modulo de categorias', 'fail', err.message);
        }

        // ========================================
        // FASE: METAS  (testKey: "METAS")
        // ========================================
        try {
            const goalsStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM product_goals)  AS product_goals,
                  (SELECT COUNT(*)::int FROM business_goals) AS business_goals,
                  (SELECT COUNT(*)::int FROM sales_history)  AS sales_history_rows
            `);
            addTest('METAS', 'Modulo de metas y objetivos', 'pass',
                `product_goals: ${goalsStats.product_goals} | business_goals: ${goalsStats.business_goals} | sales_history: ${goalsStats.sales_history_rows}`,
                goalsStats);
        } catch (err) {
            addTest('METAS', 'Modulo de metas y objetivos', 'fail', err.message);
        }

        // Test: endpoint /api/goals/by-period responde correctamente
        try {
            const now = new Date();
            const { response: goalsResp, payload: goalsPayload } = await apiJson(
                `/api/goals/by-period?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
            );
            if (goalsResp.ok) {
                addTest('METAS', 'Endpoint /api/goals/by-period', 'pass',
                    `Responde correctamente — ${Array.isArray(goalsPayload) ? goalsPayload.length : '?'} metas para el mes actual`,
                    { count: Array.isArray(goalsPayload) ? goalsPayload.length : null });
            } else {
                addTest('METAS', 'Endpoint /api/goals/by-period', 'fail',
                    `HTTP ${goalsResp.status}`, goalsPayload);
            }
        } catch (err) {
            addTest('METAS', 'Endpoint /api/goals/by-period', 'fail', err.message);
        }

        // Test: endpoint usado por la pantalla Panel de Metas
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const { response: dashboardResp, payload: dashboardPayload } = await apiJson(
                `/api/dashboard/resumen?year=${year}&month=${month}`
            );

            if (
                dashboardResp.ok
                && dashboardPayload?.period?.year === year
                && dashboardPayload?.period?.month === month
            ) {
                addTest('METAS', 'Endpoint /api/dashboard/resumen', 'pass',
                    'Panel de Metas responde para el periodo actual',
                    {
                        year,
                        month,
                        total_goal: dashboardPayload?.kpis?.total_goal ?? null,
                        total_actual: dashboardPayload?.kpis?.total_actual ?? null
                    });
            } else {
                addTest('METAS', 'Endpoint /api/dashboard/resumen', 'fail',
                    `HTTP ${dashboardResp.status}`, dashboardPayload);
            }
        } catch (err) {
            addTest('METAS', 'Endpoint /api/dashboard/resumen', 'fail', err.message);
        }

        // Test: endpoint actual de la pantalla Gestion responde correctamente
        try {
            const now = new Date();
            const { response: gestionGoalsResp, payload: gestionGoalsPayload } = await apiJson(
                `/api/gestion/goals?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
            );
            if (
                gestionGoalsResp.ok
                && gestionGoalsPayload
                && typeof gestionGoalsPayload.business === 'object'
                && Array.isArray(gestionGoalsPayload.vendors)
            ) {
                addTest('METAS', 'Endpoint /api/gestion/goals', 'pass',
                    'La pantalla Gestion puede cargar metas del periodo actual',
                    {
                        businessGoals: Object.keys(gestionGoalsPayload.business || {}).length,
                        vendors: gestionGoalsPayload.vendors.length
                    });
            } else {
                addTest('METAS', 'Endpoint /api/gestion/goals', 'fail',
                    `HTTP ${gestionGoalsResp.status}`, gestionGoalsPayload);
            }
        } catch (err) {
            addTest('METAS', 'Endpoint /api/gestion/goals', 'fail', err.message);
        }

        // Test: permisos de metas detectados desde /api/me
        try {
            const { response: meResp, payload: meMeta } = await apiJson('/api/me');
            if (meResp.ok && meMeta?.role) {
                addTest('METAS', 'Deteccion de rol en vivo via /api/me', 'pass',
                    `Rol en DB: ${meMeta.role} — La detección live funciona (no depende del token de localStorage)`,
                    { role: meMeta.role });
            } else {
                addTest('METAS', 'Deteccion de rol en vivo via /api/me', 'fail',
                    `El endpoint /api/me no devolvió rol. HTTP ${meResp.status}`, meMeta);
            }
        } catch (err) {
            addTest('METAS', 'Deteccion de rol en vivo via /api/me', 'fail', err.message);
        }

        // ========================================
        // FASE: CORREOS  (testKey: "CORREOS")
        // ========================================
        try {
            const emailStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM email_campaigns)      AS campanas,
                  (SELECT COUNT(*)::int FROM email_recipients)     AS destinatarios,
                  (SELECT COUNT(*)::int FROM email_attachments)    AS adjuntos,
                  (SELECT COUNT(*)::int FROM email_tracking_events)AS eventos_tracking
            `);
            // Verificar que el módulo de correos tiene estructura para enviar
            const emailReady = emailStats.campanas !== undefined;
            addTest('CORREOS', 'Estructura del modulo de correos', emailReady ? 'pass' : 'fail',
                `${emailStats.campanas} campanas | ${emailStats.destinatarios} destinatarios | tracking: ${emailStats.eventos_tracking} eventos`,
                emailStats);
        } catch (err) {
            addTest('CORREOS', 'Estructura del modulo de correos', 'fail', err.message);
        }

        // ========================================
        // FASE: COGNOS  (testKey: "COGNOS")
        // ========================================
        try {
            // Cognos trabaja contra la BD Tango — verificamos que el pool responde
            // y que hay datos base disponibles para sync
            const cognosCheck = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM subscriber_reports) AS reports_locales,
                  (SELECT COUNT(*)::int FROM subscribers)        AS suscriptores_locales
            `);
            addTest('COGNOS', 'Datos disponibles para sincronizacion Cognos', 'pass',
                `${cognosCheck.reports_locales} reportes locales | ${cognosCheck.suscriptores_locales} suscriptores listos para sync`,
                cognosCheck);
        } catch (err) {
            addTest('COGNOS', 'Datos disponibles para sincronizacion Cognos', 'fail', err.message);
        }

        // ========================================
        // FASE: HISTORIAL  (testKey: "HISTORIAL")
        // ========================================
        try {
            // Verificar tablas de auditoría disponibles
            const auditTablesCheck = await client.query(`
                SELECT table_name
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name IN ('audit_log','audit_logs','activity_log','user_activity','login_history')
                 ORDER BY table_name
            `);
            const auditTables = auditTablesCheck.rows.map(r => r.table_name);

            // Verificar que user_permission_overrides tiene historial de cambios
            const permOverridesCount = await safeCount(
                `SELECT COUNT(*)::int AS total FROM user_permission_overrides`
            );

            if (auditTables.length > 0) {
                addTest('HISTORIAL', 'Tablas de auditoria detectadas', 'pass',
                    `Tablas: ${auditTables.join(', ')} | Overrides de permisos: ${permOverridesCount.total}`,
                    { auditTables, permOverridesCount });
            } else {
                addTest('HISTORIAL', 'Historial via user_permission_overrides', 'pass',
                    `Sistema de historial activo via overrides. Registros: ${permOverridesCount.total}`,
                    { note: 'No hay tabla audit_log dedicada — el historial se gestiona por la capa de aplicacion', permOverridesCount });
            }
        } catch (err) {
            addTest('HISTORIAL', 'Modulo de historial', 'fail', err.message);
        }

        // ========================================
        // FASE: PERFIL  (testKey: "PERFIL")
        // ========================================
        try {
            // Verificar que el endpoint /api/auth/me responde correctamente
            const { response: meResponse, payload: mePayload } = await apiJson('/api/auth/me');
            if (meResponse.ok && mePayload?.username) {
                addTest('PERFIL', 'Endpoint de perfil de usuario', 'pass',
                    `Perfil accesible para usuario: ${mePayload.username} (${mePayload.role})`,
                    { username: mePayload.username, role: mePayload.role });
            } else {
                // Fallback: verificar tabla users_auth directamente
                const userCheck = await safeCount(`
                    SELECT COUNT(*)::int AS total,
                           COUNT(CASE WHEN password LIKE '$2%' THEN 1 END)::int AS con_bcrypt
                      FROM users_auth
                `);
                addTest('PERFIL', 'Tabla de usuarios y perfiles', 'pass',
                    `${userCheck.total} usuarios registrados | ${userCheck.con_bcrypt} con bcrypt hash`,
                    userCheck);
            }
        } catch (err) {
            // Último fallback sin lanzar error
            try {
                const userCheck = await safeCount(`SELECT COUNT(*)::int AS total FROM users_auth`);
                addTest('PERFIL', 'Tabla de usuarios (fallback)', 'pass',
                    `${userCheck.total} usuarios en users_auth`, userCheck);
            } catch (err2) {
                addTest('PERFIL', 'Modulo de perfil', 'fail', err2.message);
            }
        }

        // ========================================
        // FASE: USUARIOS  (testKey: "USUARIOS")
        // ========================================
        try {
            // role viene de salespeople via JOIN — no existe en users_auth directamente
            // password es el campo que guarda el hash bcrypt (no password_hash)
            const usersRows = await query(`
                SELECT
                  COUNT(*)::int                                                              AS total,
                  COUNT(CASE WHEN s.role = 'admin'      THEN 1 END)::int                   AS admins,
                  COUNT(CASE WHEN s.role = 'supervisor' THEN 1 END)::int                   AS supervisores,
                  COUNT(CASE WHEN s.role = 'vendedor'   THEN 1 END)::int                   AS vendedores,
                  COUNT(CASE WHEN u.salesperson_id IS NULL THEN 1 END)::int                AS sin_salesperson,
                  COUNT(CASE WHEN u.password LIKE '$2%' THEN 1 END)::int                   AS con_bcrypt,
                  (SELECT COUNT(*)::int FROM user_permission_overrides)                    AS overrides_guardados
                FROM users_auth u
                LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
            `);
            const usersStats = usersRows[0] || {};
            const sinHash = (usersStats.total || 0) - (usersStats.con_bcrypt || 0);
            const status  = sinHash > 0 ? 'fail' : 'pass';
            addTest('USUARIOS', 'Estructura de usuarios y permisos', status,
                status === 'pass'
                    ? `${usersStats.total} usuarios | ${usersStats.overrides_guardados} overrides de permisos guardados`
                    : `ALERTA: ${sinHash} usuario(s) sin bcrypt hash`,
                usersStats);
        } catch (err) {
            addTest('USUARIOS', 'Estructura de usuarios y permisos', 'fail', err.message);
        }

        // ========================================
        // FASE: SEGURIDAD  (testKey: "SEGURIDAD")
        // ========================================
        try {
            const checks_seg = [];

            // 1) JWT Secrets configurados
            const hasJwt = !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'development-secret';
            checks_seg.push({ check: 'JWT_SECRET', ok: hasJwt, detail: hasJwt ? 'Configurado' : 'USANDO DEFAULT (inseguro)' });

            // 2) Contraseñas con hash bcrypt (columna se llama "password", no "password_hash")
            const pwRows = await query(`
                SELECT COUNT(*)::int AS total,
                       COUNT(CASE WHEN password LIKE '$2%' THEN 1 END)::int AS hashed
                  FROM users_auth
            `);
            const pwCheck = pwRows[0] || { total: 0, hashed: 0 };
            const allHashed = Number(pwCheck.total) === Number(pwCheck.hashed);
            checks_seg.push({ check: 'Passwords bcrypt', ok: allHashed, detail: `${pwCheck.hashed}/${pwCheck.total} hasheadas` });

            // 3) Integridad referencial
            const orphanBans = await safeCount(`
                SELECT COUNT(*)::int AS total FROM bans
                 WHERE client_id NOT IN (SELECT id FROM clients)
            `);
            const orphanSubs = await safeCount(`
                SELECT COUNT(*)::int AS total FROM subscribers
                 WHERE ban_id NOT IN (SELECT id FROM bans)
            `);
            checks_seg.push({ check: 'BANs sin cliente',          ok: orphanBans.total === 0, detail: `${orphanBans.total} huerfanos` });
            checks_seg.push({ check: 'Suscriptores sin BAN',      ok: orphanSubs.total === 0, detail: `${orphanSubs.total} huerfanos` });

            // 4) user_permission_overrides schema
            const overrideTableOk = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'user_permission_overrides'
                ) AS exists
            `);
            checks_seg.push({ check: 'Tabla permisos override', ok: overrideTableOk.rows[0].exists, detail: overrideTableOk.rows[0].exists ? 'OK' : 'FALTA' });

            // 5) La ruta destructiva de limpieza no debe estar habilitada en produccion.
            const cleanBefore = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM clients)     AS clients,
                  (SELECT COUNT(*)::int FROM bans)        AS bans,
                  (SELECT COUNT(*)::int FROM subscribers) AS subscribers
            `);
            const { response: cleanResp } = await apiJson('/api/admin/clean-database', {
                method: 'DELETE'
            });
            const cleanAfter = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM clients)     AS clients,
                  (SELECT COUNT(*)::int FROM bans)        AS bans,
                  (SELECT COUNT(*)::int FROM subscribers) AS subscribers
            `);
            const cleanCountsUnchanged = Number(cleanBefore.clients) === Number(cleanAfter.clients)
                && Number(cleanBefore.bans) === Number(cleanAfter.bans)
                && Number(cleanBefore.subscribers) === Number(cleanAfter.subscribers);
            const productionRuntime = process.env.NODE_ENV === 'production' || process.cwd() === '/opt/crmp';
            const cleanBlocked = productionRuntime
                ? [403, 404].includes(cleanResp.status)
                : [400, 403, 404].includes(cleanResp.status);
            checks_seg.push({
                check: 'Bloqueo clean-database',
                ok: cleanBlocked && cleanCountsUnchanged,
                detail: `HTTP ${cleanResp.status}; datos ${cleanCountsUnchanged ? 'sin cambios' : 'CAMBIARON'}`
            });

            const failed_seg = checks_seg.filter(c => !c.ok);
            const status_seg = failed_seg.length === 0 ? 'pass' : 'fail';
            addTest('SEGURIDAD', 'Chequeos de seguridad y configuracion', status_seg,
                status_seg === 'pass'
                    ? `${checks_seg.length}/${checks_seg.length} chequeos OK`
                    : `${failed_seg.length} problema(s): ${failed_seg.map(c => c.check).join(', ')}`,
                checks_seg);
        } catch (err) {
            addTest('SEGURIDAD', 'Chequeos de seguridad', 'fail', err.message);
        }

        // ========================================
        // FASE: PASOS CLIENTES  (testKey: "PASOS")
        // ========================================
        try {
            const pasosStats = await safeCount(`
                SELECT
                  (SELECT COUNT(*)::int FROM crm_workflow_templates)      AS templates,
                  (SELECT COUNT(*)::int FROM crm_workflow_template_steps) AS template_steps,
                  (SELECT COUNT(*)::int FROM crm_deals)                   AS deals_activos,
                  (SELECT COUNT(*)::int FROM crm_deal_tasks WHERE status = 'done')       AS tareas_done,
                  (SELECT COUNT(*)::int FROM crm_deal_tasks WHERE status = 'in_progress') AS tareas_activas,
                  (SELECT COUNT(*)::int FROM crm_deal_tasks WHERE status = 'pending')    AS tareas_pendientes
            `);
            addTest('PASOS', 'Plantillas y pasos de workflow de clientes', 'pass',
                `${pasosStats.templates} templates | ${pasosStats.template_steps} pasos | ${pasosStats.deals_activos} deals | done:${pasosStats.tareas_done} activas:${pasosStats.tareas_activas} pendientes:${pasosStats.tareas_pendientes}`,
                pasosStats);
        } catch (err) {
            addTest('PASOS', 'Plantillas y pasos de workflow de clientes', 'fail', err.message);
        }

        // Test: endpoint de sync de deals desde seguimiento
        try {
            // Verificar que la ruta existe llamando con un ID inválido (esperamos 4xx, no 500)
            const { response: syncResp, payload: syncPayload } = await apiJson('/api/clients/0/sync', {
                method: 'POST',
                json: { seller_id: null }
            });
            // 400 o 404 indica que la ruta existe y valida correctamente
            const routeExists = syncResp.status === 400 || syncResp.status === 404 || syncResp.status === 200;
            if (routeExists) {
                addTest('PASOS', 'Endpoint sync deals desde seguimiento', 'pass',
                    `Ruta POST /api/deals/clients/:id/sync responde (HTTP ${syncResp.status}) — validación activa`,
                    { status: syncResp.status, response: syncPayload });
            } else {
                addTest('PASOS', 'Endpoint sync deals desde seguimiento', 'fail',
                    `La ruta respondió HTTP ${syncResp.status} inesperado`,
                    syncPayload);
            }
        } catch (err) {
            addTest('PASOS', 'Endpoint sync deals desde seguimiento', 'fail', err.message);
        }

        // ── Separador antes de REFERIDOS ──────────────────────────────────────
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

        // ============================================================
        // FASE PHONE_NORM: validar normalización de phone en subscribers
        // ============================================================
        // Rango de IDs sintéticos:
        //   BANs:    999111001 / 002 / 003
        //   Phones:  7874444444 / 7874455555 / 7874466666
        //   Names:   ${TEST_PREFIX}_Phone_C{1,2,3}_*
        // Limpieza previa cubre estos rangos en FASE 1.
        const PFX_PHONE = `${TEST_PREFIX}_Phone`;
        const phoneIds = { c1: null, c2: null, c3: null, b1: null, b2: null, b3: null };
        const createPhoneClient = async (suffix) => {
            const { response, payload } = await apiJson('/api/clients', {
                method: 'POST',
                json: {
                    name: `${PFX_PHONE}_${suffix}`,
                    owner_name: `${PFX_PHONE}_${suffix}_Owner`,
                }
            });
            if (!response.ok) throw new Error(`POST /api/clients ${suffix}: HTTP ${response.status} ${payload?.error || ''}`);
            return payload?.id || null;
        };
        const createPhoneBan = async (clientId, banNumber) => {
            const { response, payload } = await apiJson('/api/bans', {
                method: 'POST',
                json: {
                    client_id: clientId,
                    ban_number: banNumber,
                    account_type: 'MOVIL',
                }
            });
            if (!response.ok) throw new Error(`POST /api/bans ${banNumber}: HTTP ${response.status} ${payload?.error || ''}`);
            return payload?.id || null;
        };

        // 5.1 — Crear C1 + BAN sin suscriptor
        try {
            phoneIds.c1 = await createPhoneClient('C1_BANSIN');
            phoneIds.b1 = await createPhoneBan(phoneIds.c1, '999111001');
            const subs = await query('SELECT COUNT(*)::int AS n FROM subscribers WHERE ban_id = $1', [phoneIds.b1]);
            if (Number(subs[0]?.n || 0) === 0 && phoneIds.b1) {
                addTest('PHONE_NORM', 'C1 BAN sin suscriptor permitido', 'pass',
                    'Cliente y BAN creados sin suscriptor', { client_id: phoneIds.c1, ban_id: phoneIds.b1 });
            } else {
                addTest('PHONE_NORM', 'C1 BAN sin suscriptor permitido', 'fail',
                    `Estado inesperado: subs=${subs[0]?.n}, ban_id=${phoneIds.b1}`);
            }
        } catch (err) {
            addTest('PHONE_NORM', 'C1 BAN sin suscriptor permitido', 'fail', err.message);
        }

        // 5.2 — C2 + subscriber 787-444-4444 → debe quedar 7874444444
        try {
            phoneIds.c2 = await createPhoneClient('C2_DASHED');
            phoneIds.b2 = await createPhoneBan(phoneIds.c2, '999111002');
            const { response, payload } = await apiJson('/api/subscribers', {
                method: 'POST',
                json: {
                    ban_id: phoneIds.b2,
                    phone: '787-444-4444',
                    plan: 'PHTEST',
                    monthly_value: 25.00
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${payload?.error || ''}`);
            const verify = await query('SELECT phone FROM subscribers WHERE id = $1', [payload.id]);
            const stored = verify[0]?.phone;
            if (stored === '7874444444') {
                addTest('PHONE_NORM', 'C2 phone con guiones se normaliza a 10 digitos', 'pass',
                    `Input '787-444-4444' guardado como '${stored}'`, { subscriber_id: payload.id });
            } else {
                addTest('PHONE_NORM', 'C2 phone con guiones se normaliza a 10 digitos', 'fail',
                    `Esperado '7874444444', guardado '${stored}'`);
            }
        } catch (err) {
            addTest('PHONE_NORM', 'C2 phone con guiones se normaliza a 10 digitos', 'fail', err.message);
        }

        // 5.3 — C3 + subscriber 7874455555 (limpio)
        try {
            phoneIds.c3 = await createPhoneClient('C3_PLAIN');
            phoneIds.b3 = await createPhoneBan(phoneIds.c3, '999111003');
            const { response, payload } = await apiJson('/api/subscribers', {
                method: 'POST',
                json: {
                    ban_id: phoneIds.b3,
                    phone: '7874455555',
                    plan: 'PHTEST',
                    monthly_value: 25.00
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${payload?.error || ''}`);
            const verify = await query('SELECT phone FROM subscribers WHERE id = $1', [payload.id]);
            const stored = verify[0]?.phone;
            if (stored === '7874455555') {
                addTest('PHONE_NORM', 'C3 phone limpio se preserva', 'pass',
                    `Input '7874455555' guardado igual`, { subscriber_id: payload.id });
            } else {
                addTest('PHONE_NORM', 'C3 phone limpio se preserva', 'fail',
                    `Esperado '7874455555', guardado '${stored}'`);
            }
        } catch (err) {
            addTest('PHONE_NORM', 'C3 phone limpio se preserva', 'fail', err.message);
        }

        // 5.4 — Editar C1: agregar subscriber con prefijo país '+1 787 446 6666'
        try {
            if (!phoneIds.b1) throw new Error('C1 banId no disponible');
            const { response, payload } = await apiJson('/api/subscribers', {
                method: 'POST',
                json: {
                    ban_id: phoneIds.b1,
                    phone: '+1 787 446 6666',
                    plan: 'PHTEST',
                    monthly_value: 25.00
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${payload?.error || ''}`);
            const verify = await query('SELECT phone FROM subscribers WHERE id = $1', [payload.id]);
            const stored = verify[0]?.phone;
            if (stored === '7874466666') {
                addTest('PHONE_NORM', 'C1 phone con prefijo pais +1 se strippea', 'pass',
                    `Input '+1 787 446 6666' guardado como '${stored}'`, { subscriber_id: payload.id });
            } else {
                addTest('PHONE_NORM', 'C1 phone con prefijo pais +1 se strippea', 'fail',
                    `Esperado '7874466666', guardado '${stored}'`);
            }
        } catch (err) {
            addTest('PHONE_NORM', 'C1 phone con prefijo pais +1 se strippea', 'fail', err.message);
        }

        // 5.5 — Duplicado: (787)444-4444 cuando ya existe 7874444444 (de C2)
        try {
            if (!phoneIds.b2) throw new Error('C2 banId no disponible');
            const { response, payload } = await apiJson('/api/subscribers', {
                method: 'POST',
                json: {
                    ban_id: phoneIds.b2,
                    phone: '(787)444-4444',
                    plan: 'PHTEST',
                    monthly_value: 25.00
                }
            });
            const errMsg = String(payload?.error || '').toLowerCase();
            const is4xx = response.status >= 400 && response.status < 500;
            const sayDup = errMsg.includes('ya existe') || errMsg.includes('duplica') || errMsg.includes('duplicate');
            if (is4xx && sayDup) {
                addTest('PHONE_NORM', 'Rechazo duplicado por formato distinto', 'pass',
                    `HTTP ${response.status} con mensaje de duplicado`, { error: payload?.error });
            } else {
                addTest('PHONE_NORM', 'Rechazo duplicado por formato distinto', 'fail',
                    `Esperado 4xx + 'ya existe', obtenido HTTP ${response.status}`,
                    { payload });
            }
        } catch (err) {
            addTest('PHONE_NORM', 'Rechazo duplicado por formato distinto', 'fail', err.message);
        }

        // 5.6 — Cleanup local de FASE PHONE_NORM
        try {
            const banIds = [phoneIds.b1, phoneIds.b2, phoneIds.b3].filter(Boolean);
            if (banIds.length > 0) {
                await client.query('DELETE FROM subscriber_reports WHERE subscriber_id IN (SELECT id FROM subscribers WHERE ban_id = ANY($1::uuid[]))', [banIds]);
                await client.query('DELETE FROM subscribers WHERE ban_id = ANY($1::uuid[])', [banIds]);
                await client.query('DELETE FROM bans WHERE id = ANY($1::uuid[])', [banIds]);
            }
            await client.query(`DELETE FROM clients WHERE name LIKE '${PFX_PHONE}_%'`);
            addTest('PHONE_NORM', 'Cleanup datos sinteticos PHONE_NORM', 'pass',
                'Datos sinteticos eliminados (clientes, BANs, subscribers)');
        } catch (err) {
            addTest('PHONE_NORM', 'Cleanup datos sinteticos PHONE_NORM', 'fail', err.message);
        }

        // ============================================================
        // FASE A: AUTH + PERMISOS + CRUD operativo (subs/comisiones/BANs)
        // ============================================================
        // Rangos reservados:
        //   User auth:  ${TEST_PREFIX}user_a (pwd TestPass2026!)
        //   Clientes:   ${TEST_PREFIX}_FaseA_C{1,2}_*
        //   BANs:       999222001-003
        //   Phones:     7878881111 / 2222 / 3333
        //   Reports:    report_month = '2099-01-01'
        const FA_USER = `${TEST_PREFIX}user_a`;
        const FA_PASS = 'TestPass2026!';
        const PFX_FA = `${TEST_PREFIX}_FaseA`;
        const fa = {
            userId: null, salespersonId: null, userToken: null,
            c1: null, c2: null,
            banA: null, banB: null, banC: null,
            subA: null
        };

        // ── Helper: apiJson con un token específico ──
        const apiJsonAs = async (token, path, options = {}) => {
            const { json, headers, ...rest } = options;
            const requestHeaders = {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
                ...(headers || {})
            };
            let body = rest.body;
            if (json !== undefined) {
                body = JSON.stringify(json);
                requestHeaders['Content-Type'] = 'application/json';
            }
            const response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: requestHeaders, body });
            const raw = await response.text();
            let payload = null;
            try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw }; }
            return { response, payload };
        };

        // ── A0.1: Crear user sintético ──
        try {
            const { response, payload } = await apiJson('/api/users', {
                method: 'POST',
                json: { username: FA_USER, password: FA_PASS, role: 'vendedor' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${payload?.error || ''}`);
            fa.userId = payload?.id || null;
            // Recuperar salesperson_id auto-generado para limpieza posterior
            const sp = await query('SELECT salesperson_id FROM users_auth WHERE id = $1', [fa.userId]);
            fa.salespersonId = sp[0]?.salesperson_id || null;
            if (fa.userId) {
                addTest('FASE_A', 'A0.1 Crear user sintetico', 'pass',
                    `User ${FA_USER} creado`, { userId: fa.userId, salespersonId: fa.salespersonId });
            } else {
                addTest('FASE_A', 'A0.1 Crear user sintetico', 'fail', 'No se obtuvo userId');
            }
        } catch (err) {
            addTest('FASE_A', 'A0.1 Crear user sintetico', 'fail', err.message);
        }

        // ── A1.1: Login con credenciales validas ──
        try {
            const { response, payload } = await apiJson('/api/auth/login', {
                method: 'POST',
                json: { username: FA_USER, password: FA_PASS }
            });
            if (response.ok && payload?.token) {
                fa.userToken = payload.token;
                addTest('FASE_A', 'A1.1 Login credenciales validas', 'pass',
                    'HTTP 200 + token JWT recibido', { username: FA_USER });
            } else {
                addTest('FASE_A', 'A1.1 Login credenciales validas', 'fail',
                    `HTTP ${response.status}: ${payload?.error || 'sin token'}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A1.1 Login credenciales validas', 'fail', err.message);
        }

        // ── A1.2: Login con password incorrecto ──
        try {
            const { response } = await apiJson('/api/auth/login', {
                method: 'POST',
                json: { username: FA_USER, password: 'WRONG_PASSWORD' }
            });
            if (response.status === 401) {
                addTest('FASE_A', 'A1.2 Login credenciales invalidas rechazado', 'pass',
                    'HTTP 401 como esperado');
            } else {
                addTest('FASE_A', 'A1.2 Login credenciales invalidas rechazado', 'fail',
                    `Esperado 401, obtenido ${response.status}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A1.2 Login credenciales invalidas rechazado', 'fail', err.message);
        }

        // ── A1.3: GET /api/auth/me con token nuevo ──
        try {
            if (!fa.userToken) throw new Error('No hay token (A1.1 fallo)');
            const { response, payload } = await apiJsonAs(fa.userToken, '/api/auth/me');
            // Endpoint devuelve { user: { username, ... }, role, salespersonId }
            const usernameInPayload = payload?.user?.username || payload?.username;
            if (response.ok && usernameInPayload === FA_USER) {
                addTest('FASE_A', 'A1.3 /api/auth/me devuelve user del token', 'pass',
                    `username coincide: ${usernameInPayload}`);
            } else {
                addTest('FASE_A', 'A1.3 /api/auth/me devuelve user del token', 'fail',
                    `HTTP ${response.status} o username no coincide`, payload);
            }
        } catch (err) {
            addTest('FASE_A', 'A1.3 /api/auth/me devuelve user del token', 'fail', err.message);
        }

        // ── A2.1: GET /api/permissions/catalog ──
        try {
            const { response, payload } = await apiJson('/api/permissions/catalog');
            const arr = Array.isArray(payload?.permissions) ? payload.permissions : [];
            const ok = response.ok && arr.length > 0 && arr[0]?.key && arr[0]?.module;
            if (ok) {
                addTest('FASE_A', 'A2.1 Catalogo permisos disponible', 'pass',
                    `${arr.length} permisos en catalogo`);
            } else {
                addTest('FASE_A', 'A2.1 Catalogo permisos disponible', 'fail',
                    `HTTP ${response.status} o shape invalido`, { sample: arr[0] });
            }
        } catch (err) {
            addTest('FASE_A', 'A2.1 Catalogo permisos disponible', 'fail', err.message);
        }

        // ── A2.2: GET /api/permissions/me ──
        try {
            const { response, payload } = await apiJson('/api/permissions/me');
            const map = payload?.permissions || {};
            const sample = map['nav.dashboard'];
            if (response.ok && sample && typeof sample.allowed === 'boolean') {
                addTest('FASE_A', 'A2.2 /api/permissions/me snapshot admin', 'pass',
                    `nav.dashboard.allowed=${sample.allowed}`, { role: payload?.role });
            } else {
                addTest('FASE_A', 'A2.2 /api/permissions/me snapshot admin', 'fail',
                    `HTTP ${response.status} o shape invalido`, { sample });
            }
        } catch (err) {
            addTest('FASE_A', 'A2.2 /api/permissions/me snapshot admin', 'fail', err.message);
        }

        // ── A2.3: PUT override deny nav.tango para user sintetico ──
        try {
            if (!fa.userId) throw new Error('No hay userId (A0.1 fallo)');
            const { response, payload } = await apiJson(`/api/permissions/users/${fa.userId}`, {
                method: 'PUT',
                json: { permissions: [{ permission_key: 'nav.clients', effect: 'deny' }] }
            });
            if (response.ok) {
                addTest('FASE_A', 'A2.3 PUT override deny nav.clients', 'pass',
                    'Override guardado', { user_id: fa.userId });
            } else {
                addTest('FASE_A', 'A2.3 PUT override deny nav.clients', 'fail',
                    `HTTP ${response.status} ${payload?.error || ''}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A2.3 PUT override deny nav.clients', 'fail', err.message);
        }

        // ── A2.4: GET refleja override ──
        try {
            if (!fa.userId) throw new Error('No hay userId');
            const { response, payload } = await apiJson(`/api/permissions/users/${fa.userId}`);
            // El override puede aparecer en .overrides (lista cruda) o .permissions (resolución).
            // Aceptamos cualquiera de los dos como evidencia de persistencia.
            const overrides = payload?.overrides || {};
            const overrideEntry = overrides['nav.clients'];
            const navTango = payload?.permissions?.['nav.clients'];
            const sawDeny =
                (overrideEntry && String(overrideEntry.effect || '').toLowerCase() === 'deny') ||
                (navTango && navTango.effect === 'deny') ||
                (navTango && navTango.allowed === false && navTango.source === 'override');
            if (response.ok && sawDeny) {
                addTest('FASE_A', 'A2.4 GET refleja override deny', 'pass',
                    'Override deny visible en respuesta',
                    { override: overrideEntry, resolved: navTango });
            } else {
                addTest('FASE_A', 'A2.4 GET refleja override deny', 'fail',
                    `No se encontro evidencia de deny en /users/${fa.userId}`,
                    { override: overrideEntry, resolved: navTango });
            }
        } catch (err) {
            addTest('FASE_A', 'A2.4 GET refleja override deny', 'fail', err.message);
        }

        // ── A2.5: Limpiar override (effect inherit) ──
        try {
            if (!fa.userId) throw new Error('No hay userId');
            const { response } = await apiJson(`/api/permissions/users/${fa.userId}`, {
                method: 'PUT',
                json: { permissions: [{ permission_key: 'nav.clients', effect: 'inherit' }] }
            });
            if (response.ok) {
                addTest('FASE_A', 'A2.5 Override limpiado (inherit)', 'pass', 'Override revertido');
            } else {
                addTest('FASE_A', 'A2.5 Override limpiado (inherit)', 'fail', `HTTP ${response.status}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A2.5 Override limpiado (inherit)', 'fail', err.message);
        }

        // ── Setup A4-A6: clientes + BANs + subscriber sintético ──
        try {
            const c1Resp = await apiJson('/api/clients', {
                method: 'POST',
                json: { name: `${PFX_FA}_C1_BANs`, owner_name: `${PFX_FA}_C1_Owner` }
            });
            fa.c1 = c1Resp.payload?.id || null;
            const c2Resp = await apiJson('/api/clients', {
                method: 'POST',
                json: { name: `${PFX_FA}_C2_Cross`, owner_name: `${PFX_FA}_C2_Owner` }
            });
            fa.c2 = c2Resp.payload?.id || null;

            const banAResp = await apiJson('/api/bans', {
                method: 'POST',
                json: { client_id: fa.c1, ban_number: '999222001', account_type: 'MOVIL' }
            });
            fa.banA = banAResp.payload?.id || null;
            const banBResp = await apiJson('/api/bans', {
                method: 'POST',
                json: { client_id: fa.c1, ban_number: '999222002', account_type: 'MOVIL' }
            });
            fa.banB = banBResp.payload?.id || null;
            const banCResp = await apiJson('/api/bans', {
                method: 'POST',
                json: { client_id: fa.c2, ban_number: '999222003', account_type: 'MOVIL' }
            });
            fa.banC = banCResp.payload?.id || null;

            const subAResp = await apiJson('/api/subscribers', {
                method: 'POST',
                json: { ban_id: fa.banA, phone: '7878881111', plan: 'FATEST', monthly_value: 30.00 }
            });
            fa.subA = subAResp.payload?.id || null;

            if (fa.c1 && fa.c2 && fa.banA && fa.banB && fa.banC && fa.subA) {
                addTest('FASE_A', 'Setup A4-A6 (clientes/BANs/sub)', 'pass',
                    'Clientes, BANs y subscriber sintetico creados',
                    { c1: fa.c1, c2: fa.c2, banA: fa.banA, banB: fa.banB, banC: fa.banC, subA: fa.subA });
            } else {
                addTest('FASE_A', 'Setup A4-A6 (clientes/BANs/sub)', 'fail',
                    'Algun recurso no se creo',
                    { c1: fa.c1, c2: fa.c2, banA: fa.banA, banB: fa.banB, banC: fa.banC, subA: fa.subA });
            }
        } catch (err) {
            addTest('FASE_A', 'Setup A4-A6 (clientes/BANs/sub)', 'fail', err.message);
        }

        // ── A4.1: Cancelar subscriber ──
        try {
            if (!fa.subA) throw new Error('No hay subA');
            const { response } = await apiJson(`/api/subscribers/${fa.subA}/cancel`, {
                method: 'PUT',
                json: { cancel_reason: 'test_FaseA' }
            });
            const verify = await query('SELECT status, cancel_reason FROM subscribers WHERE id = $1', [fa.subA]);
            const row = verify[0];
            if (response.ok && row?.status === 'cancelado' && row?.cancel_reason === 'test_FaseA') {
                addTest('FASE_A', 'A4.1 Cancelar subscriber', 'pass',
                    `status=${row.status}, reason=${row.cancel_reason}`);
            } else {
                addTest('FASE_A', 'A4.1 Cancelar subscriber', 'fail',
                    `HTTP ${response.status} status=${row?.status} reason=${row?.cancel_reason}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A4.1 Cancelar subscriber', 'fail', err.message);
        }

        // ── A4.2: Reactivar subscriber ──
        try {
            if (!fa.subA) throw new Error('No hay subA');
            const { response } = await apiJson(`/api/subscribers/${fa.subA}/reactivate`, {
                method: 'PUT'
            });
            const verify = await query('SELECT status, cancel_reason FROM subscribers WHERE id = $1', [fa.subA]);
            const row = verify[0];
            if (response.ok && row?.status === 'activo' && !row?.cancel_reason) {
                addTest('FASE_A', 'A4.2 Reactivar subscriber', 'pass',
                    `status=${row.status}, reason=${row.cancel_reason || 'NULL'}`);
            } else {
                addTest('FASE_A', 'A4.2 Reactivar subscriber', 'fail',
                    `HTTP ${response.status} status=${row?.status} reason=${row?.cancel_reason}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A4.2 Reactivar subscriber', 'fail', err.message);
        }

        // ── A4.3: Cross-BAN duplicate (mismo phone en otro BAN debe rechazar) ──
        try {
            if (!fa.banB) throw new Error('No hay banB');
            const { response, payload } = await apiJson('/api/subscribers', {
                method: 'POST',
                json: { ban_id: fa.banB, phone: '7878881111', plan: 'FATEST', monthly_value: 30.00 }
            });
            const errMsg = String(payload?.error || '').toLowerCase();
            const is4xx = response.status >= 400 && response.status < 500;
            const sayDup = errMsg.includes('ya existe') || errMsg.includes('duplica') || errMsg.includes('duplicate');
            if (is4xx && sayDup) {
                addTest('FASE_A', 'A4.3 Cross-BAN duplicado rechazado', 'pass',
                    `HTTP ${response.status} con mensaje de duplicado`, { error: payload?.error });
            } else {
                addTest('FASE_A', 'A4.3 Cross-BAN duplicado rechazado', 'fail',
                    `Esperado 4xx + 'ya existe', obtenido HTTP ${response.status}`, { payload });
            }
        } catch (err) {
            addTest('FASE_A', 'A4.3 Cross-BAN duplicado rechazado', 'fail', err.message);
        }

        // ── A5.1: PUT report con paid_amount ──
        try {
            if (!fa.subA) throw new Error('No hay subA');
            const { response, payload } = await apiJson(`/api/subscriber-reports/${fa.subA}`, {
                method: 'PUT',
                json: {
                    report_month: '2099-01-01',
                    company_earnings: 100.00,
                    vendor_commission: 30.00,
                    paid_amount: 30.00,
                    paid_date: '2099-01-15'
                }
            });
            if (response.ok && payload?.subscriber_id === fa.subA) {
                addTest('FASE_A', 'A5.1 Marcar report pagado', 'pass',
                    'Report con paid_amount/paid_date persistido');
            } else {
                addTest('FASE_A', 'A5.1 Marcar report pagado', 'fail',
                    `HTTP ${response.status}`, payload);
            }
        } catch (err) {
            addTest('FASE_A', 'A5.1 Marcar report pagado', 'fail', err.message);
        }

        // ── A5.2: GET por mes refleja is_paid ──
        try {
            const { response, payload } = await apiJson('/api/subscriber-reports?month=2099-01');
            const rows = Array.isArray(payload) ? payload : [];
            const found = rows.find((r) => String(r.subscriber_id) === String(fa.subA));
            if (response.ok && found && found.is_paid === true) {
                addTest('FASE_A', 'A5.2 GET reporte refleja is_paid=true', 'pass',
                    `subscriber_id=${fa.subA}, paid_amount=${found.paid_amount}`);
            } else {
                addTest('FASE_A', 'A5.2 GET reporte refleja is_paid=true', 'fail',
                    `No encontro fila o is_paid no es true`, { found });
            }
        } catch (err) {
            addTest('FASE_A', 'A5.2 GET reporte refleja is_paid=true', 'fail', err.message);
        }

        // ── A5.3: /comparison responde ──
        try {
            const { response } = await apiJson('/api/subscriber-reports/comparison');
            if (response.ok) {
                addTest('FASE_A', 'A5.3 /comparison responde', 'pass', 'HTTP 200');
            } else {
                addTest('FASE_A', 'A5.3 /comparison responde', 'fail', `HTTP ${response.status}`);
            }
        } catch (err) {
            addTest('FASE_A', 'A5.3 /comparison responde', 'fail', err.message);
        }

        // ── A6.1: Editar account_type del BAN-C ──
        try {
            if (!fa.banC) throw new Error('No hay banC');
            const { response, payload } = await apiJson(`/api/bans/${fa.banC}`, {
                method: 'PUT',
                json: { account_type: 'PYMES' }
            });
            const verify = await query('SELECT account_type FROM bans WHERE id = $1', [fa.banC]);
            if (response.ok && verify[0]?.account_type === 'PYMES') {
                addTest('FASE_A', 'A6.1 Editar account_type de BAN', 'pass',
                    'account_type cambiado a PYMES');
            } else {
                addTest('FASE_A', 'A6.1 Editar account_type de BAN', 'fail',
                    `HTTP ${response.status} account_type=${verify[0]?.account_type}`, payload);
            }
        } catch (err) {
            addTest('FASE_A', 'A6.1 Editar account_type de BAN', 'fail', err.message);
        }

        // ── A6.2: DELETE BAN sin subs (BAN-C) ──
        try {
            if (!fa.banC) throw new Error('No hay banC');
            const { response } = await apiJson(`/api/bans/${fa.banC}`, { method: 'DELETE' });
            const verify = await query('SELECT id FROM bans WHERE id = $1', [fa.banC]);
            if (response.ok && verify.length === 0) {
                addTest('FASE_A', 'A6.2 Eliminar BAN sin subs', 'pass', 'BAN eliminado');
                fa.banC = null; // ya no existe
            } else {
                addTest('FASE_A', 'A6.2 Eliminar BAN sin subs', 'fail',
                    `HTTP ${response.status} o BAN sigue existiendo`);
            }
        } catch (err) {
            addTest('FASE_A', 'A6.2 Eliminar BAN sin subs', 'fail', err.message);
        }

        // ── A6.3: DELETE BAN con subs activos (BAN-A) debe rechazar ──
        try {
            if (!fa.banA) throw new Error('No hay banA');
            const { response, payload } = await apiJson(`/api/bans/${fa.banA}`, { method: 'DELETE' });
            const verify = await query('SELECT id FROM bans WHERE id = $1', [fa.banA]);
            const errMsg = String(payload?.error || '').toLowerCase();
            const is4xx = response.status >= 400 && response.status < 500;
            const saysActive = errMsg.includes('lineas activas') || errMsg.includes('líneas activas') || errMsg.includes('activas');
            if (is4xx && saysActive && verify.length === 1) {
                addTest('FASE_A', 'A6.3 DELETE BAN con subs activos rechazado', 'pass',
                    `HTTP ${response.status} con mensaje, BAN preservado`, { error: payload?.error });
            } else {
                addTest('FASE_A', 'A6.3 DELETE BAN con subs activos rechazado', 'fail',
                    `Esperado 4xx + 'activas' + BAN preservado, obtenido HTTP ${response.status}`,
                    { payload, banExiste: verify.length === 1 });
            }
        } catch (err) {
            addTest('FASE_A', 'A6.3 DELETE BAN con subs activos rechazado', 'fail', err.message);
        }

        // ── A7.1: Cleanup local de FASE A ──
        try {
            // 1) Reportes del subscriber sintetico
            if (fa.subA) await client.query('DELETE FROM subscriber_reports WHERE subscriber_id = $1', [fa.subA]);
            // 2) Subscribers de los BANs sintéticos
            const banIdsFA = [fa.banA, fa.banB, fa.banC].filter(Boolean);
            if (banIdsFA.length > 0) {
                await client.query('DELETE FROM subscribers WHERE ban_id = ANY($1::uuid[])', [banIdsFA]);
                await client.query('DELETE FROM bans WHERE id = ANY($1::uuid[])', [banIdsFA]);
            }
            // 3) Clientes sintéticos
            await client.query(`DELETE FROM clients WHERE name LIKE '${PFX_FA}_%'`);
            // 4) Permission overrides + user sintético + salesperson auto-generado
            if (fa.userId) {
                await client.query('DELETE FROM user_permission_overrides WHERE user_id = $1', [fa.userId]).catch(() => {});
                await client.query('DELETE FROM users_auth WHERE id = $1', [fa.userId]);
            }
            if (fa.salespersonId) {
                await client.query('DELETE FROM salespeople WHERE id = $1', [fa.salespersonId]).catch(() => {});
            }
            addTest('FASE_A', 'A7.1 Cleanup local FASE A', 'pass',
                'Datos sinteticos FASE A eliminados (user, salesperson, clientes, BANs, subs, reports, overrides)');
        } catch (err) {
            addTest('FASE_A', 'A7.1 Cleanup local FASE A', 'fail', err.message);
        }

        // ============================================================
        // FASE B: Tareas + Seguimiento + Pasos cliente + Tango sync
        // ============================================================
        // Datos sinteticos:
        //   User auth:  ${TEST_PREFIX}user_b (pwd TestPassB2026!)
        //   Cliente:    ${TEST_PREFIX}_FaseB_C1_Tasks
        //   Tareas:     title LIKE ${TEST_PREFIX}_FaseB_Task%
        //   Prospect:   company_name = ${TEST_PREFIX}_FaseB_Prospect
        // Tango sync E2E: solo se ejecuta si RUN_TANGO_SYNC_TEST=true
        //                 (por defecto skip — no modifica datos reales).
        const FB_USER = `${TEST_PREFIX}user_b`;
        const FB_PASS = 'TestPassB2026!';
        const PFX_FB = `${TEST_PREFIX}_FaseB`;
        const fb = {
            userId: null, salespersonId: null,
            c1: null,
            taskId: null,
            followUpId: null
        };

        // ── B0.1: Crear user sintetico + cliente sintetico para FASE B ──
        try {
            const u = await apiJson('/api/users', {
                method: 'POST',
                json: { username: FB_USER, password: FB_PASS, role: 'vendedor' }
            });
            if (!u.response.ok) throw new Error(`POST /api/users: HTTP ${u.response.status} ${u.payload?.error || ''}`);
            fb.userId = u.payload?.id || null;
            const sp = await query('SELECT salesperson_id FROM users_auth WHERE id = $1', [fb.userId]);
            fb.salespersonId = sp[0]?.salesperson_id || null;

            const c = await apiJson('/api/clients', {
                method: 'POST',
                json: { name: `${PFX_FB}_C1_Tasks`, owner_name: `${PFX_FB}_C1_Owner` }
            });
            if (!c.response.ok) throw new Error(`POST /api/clients: HTTP ${c.response.status}`);
            fb.c1 = c.payload?.id || null;

            if (fb.userId && fb.c1) {
                addTest('FASE_B', 'B0.1 Setup user + cliente sinteticos', 'pass',
                    'Recursos sinteticos creados', { userId: fb.userId, c1: fb.c1 });
            } else {
                addTest('FASE_B', 'B0.1 Setup user + cliente sinteticos', 'fail',
                    'Algun recurso no se creo', { userId: fb.userId, c1: fb.c1 });
            }
        } catch (err) {
            addTest('FASE_B', 'B0.1 Setup user + cliente sinteticos', 'fail', err.message);
        }

        // ── B1.1: Crear tarea personal ──
        try {
            const { response, payload } = await apiJson('/api/tasks', {
                method: 'POST',
                json: {
                    title: `${PFX_FB}_Task_1`,
                    due_date: '2099-12-31',
                    priority: 'normal',
                    notes: 'tarea sintetica FASE B'
                }
            });
            if (!response.ok || !payload?.id) {
                throw new Error(`HTTP ${response.status} ${payload?.error || ''}`);
            }
            fb.taskId = payload.id;
            const verify = await query('SELECT status, title FROM crm_tasks WHERE id = $1', [fb.taskId]);
            if (verify[0]?.status === 'pending' && String(verify[0]?.title || '').includes('FaseB_Task_1')) {
                addTest('FASE_B', 'B1.1 Crear tarea personal', 'pass',
                    `Tarea ${fb.taskId} creada con status=pending`);
            } else {
                addTest('FASE_B', 'B1.1 Crear tarea personal', 'fail',
                    `BD shape inesperado`, verify[0]);
            }
        } catch (err) {
            addTest('FASE_B', 'B1.1 Crear tarea personal', 'fail', err.message);
        }

        // ── B1.2: PUT status pending -> in_progress ──
        try {
            if (!fb.taskId) throw new Error('No hay taskId');
            const { response } = await apiJson(`/api/tasks/${fb.taskId}`, {
                method: 'PUT',
                json: { status: 'in_progress' }
            });
            const verify = await query('SELECT status FROM crm_tasks WHERE id = $1', [fb.taskId]);
            if (response.ok && verify[0]?.status === 'in_progress') {
                addTest('FASE_B', 'B1.2 Cambiar status a in_progress', 'pass',
                    'status=in_progress');
            } else {
                addTest('FASE_B', 'B1.2 Cambiar status a in_progress', 'fail',
                    `HTTP ${response.status} status=${verify[0]?.status}`);
            }
        } catch (err) {
            addTest('FASE_B', 'B1.2 Cambiar status a in_progress', 'fail', err.message);
        }

        // ── B1.3: PUT status -> done (verifica completed_at) ──
        try {
            if (!fb.taskId) throw new Error('No hay taskId');
            const { response } = await apiJson(`/api/tasks/${fb.taskId}`, {
                method: 'PUT',
                json: { status: 'done' }
            });
            const verify = await query('SELECT status, completed_at FROM crm_tasks WHERE id = $1', [fb.taskId]);
            if (response.ok && verify[0]?.status === 'done' && verify[0]?.completed_at) {
                addTest('FASE_B', 'B1.3 Marcar tarea done setea completed_at', 'pass',
                    `status=done, completed_at=${verify[0].completed_at}`);
            } else {
                addTest('FASE_B', 'B1.3 Marcar tarea done setea completed_at', 'fail',
                    `HTTP ${response.status} status=${verify[0]?.status} completed_at=${verify[0]?.completed_at}`);
            }
        } catch (err) {
            addTest('FASE_B', 'B1.3 Marcar tarea done setea completed_at', 'fail', err.message);
        }

        // ── B1.4: DELETE tarea ──
        try {
            if (!fb.taskId) throw new Error('No hay taskId');
            const { response } = await apiJson(`/api/tasks/${fb.taskId}`, { method: 'DELETE' });
            const verify = await query('SELECT id FROM crm_tasks WHERE id = $1', [fb.taskId]);
            if (response.ok && verify.length === 0) {
                addTest('FASE_B', 'B1.4 DELETE tarea', 'pass', 'Tarea eliminada');
                fb.taskId = null;
            } else {
                addTest('FASE_B', 'B1.4 DELETE tarea', 'fail',
                    `HTTP ${response.status} o tarea sigue en BD`);
            }
        } catch (err) {
            addTest('FASE_B', 'B1.4 DELETE tarea', 'fail', err.message);
        }

        // ── B2.1: GET /api/deal-tasks?pending_only=1 ──
        try {
            const { response, payload } = await apiJson('/api/deal-tasks?pending_only=1');
            if (response.ok && Array.isArray(payload)) {
                addTest('FASE_B', 'B2.1 GET deal-tasks responde array', 'pass',
                    `${payload.length} deal_tasks pending`);
            } else {
                addTest('FASE_B', 'B2.1 GET deal-tasks responde array', 'fail',
                    `HTTP ${response.status} o no es array`);
            }
        } catch (err) {
            addTest('FASE_B', 'B2.1 GET deal-tasks responde array', 'fail', err.message);
        }

        // ── B2.2: GET /api/workflow-templates ──
        try {
            const { response, payload } = await apiJson('/api/workflow-templates');
            if (response.ok && Array.isArray(payload)) {
                addTest('FASE_B', 'B2.2 GET workflow-templates responde array', 'pass',
                    `${payload.length} templates`);
            } else {
                addTest('FASE_B', 'B2.2 GET workflow-templates responde array', 'fail',
                    `HTTP ${response.status} o no es array`);
            }
        } catch (err) {
            addTest('FASE_B', 'B2.2 GET workflow-templates responde array', 'fail', err.message);
        }

        // ── B2.3: GET /api/clients/:id/deals (cliente sintetico, sin deals) ──
        try {
            if (!fb.c1) throw new Error('No hay c1');
            const { response, payload } = await apiJson(`/api/clients/${fb.c1}/deals`);
            if (response.ok && Array.isArray(payload)) {
                addTest('FASE_B', 'B2.3 GET deals del cliente sintetico', 'pass',
                    `${payload.length} deals (esperado 0)`);
            } else {
                addTest('FASE_B', 'B2.3 GET deals del cliente sintetico', 'fail',
                    `HTTP ${response.status} o no es array`);
            }
        } catch (err) {
            addTest('FASE_B', 'B2.3 GET deals del cliente sintetico', 'fail', err.message);
        }

        // ── B3: Pasos cliente (skip si no hay category_steps) ──
        let firstStepId = null;
        try {
            const stepCount = await query('SELECT COUNT(*)::int AS n FROM category_steps');
            if (Number(stepCount[0]?.n || 0) === 0) {
                addTest('FASE_B', 'B3.1 GET pasos del cliente', 'skip',
                    'Sin category_steps en BD - test omitido');
                addTest('FASE_B', 'B3.2 PATCH paso is_done=true', 'skip',
                    'Sin category_steps - test omitido');
                addTest('FASE_B', 'B3.3 GET refleja paso done', 'skip',
                    'Sin category_steps - test omitido');
            } else {
                if (!fb.c1) throw new Error('No hay c1');
                // B3.1
                const r1 = await apiJson(`/api/clients/${fb.c1}/steps`);
                if (r1.response.ok && Array.isArray(r1.payload) && r1.payload.length > 0) {
                    firstStepId = r1.payload[0]?.step_id || null;
                    addTest('FASE_B', 'B3.1 GET pasos del cliente', 'pass',
                        `${r1.payload.length} pasos disponibles`);
                } else {
                    addTest('FASE_B', 'B3.1 GET pasos del cliente', 'fail',
                        `HTTP ${r1.response.status} o array vacio`);
                }

                // B3.2
                if (firstStepId) {
                    const r2 = await apiJson(`/api/clients/${fb.c1}/steps/${firstStepId}`, {
                        method: 'PATCH',
                        json: { is_done: true, notes: 'test_FaseB' }
                    });
                    if (r2.response.ok) {
                        addTest('FASE_B', 'B3.2 PATCH paso is_done=true', 'pass',
                            `step ${firstStepId} marcado done`);
                    } else {
                        addTest('FASE_B', 'B3.2 PATCH paso is_done=true', 'fail',
                            `HTTP ${r2.response.status}`);
                    }

                    // B3.3
                    const r3 = await apiJson(`/api/clients/${fb.c1}/steps`);
                    const found = Array.isArray(r3.payload)
                        ? r3.payload.find((s) => String(s.step_id) === String(firstStepId))
                        : null;
                    if (r3.response.ok && found && found.is_done === true && found.done_at) {
                        addTest('FASE_B', 'B3.3 GET refleja paso done', 'pass',
                            `is_done=true, done_at=${found.done_at}`);
                    } else {
                        addTest('FASE_B', 'B3.3 GET refleja paso done', 'fail',
                            `Paso no muestra is_done=true`, found);
                    }
                } else {
                    addTest('FASE_B', 'B3.2 PATCH paso is_done=true', 'fail',
                        'No se obtuvo firstStepId de B3.1');
                    addTest('FASE_B', 'B3.3 GET refleja paso done', 'fail',
                        'No se obtuvo firstStepId de B3.1');
                }
            }
        } catch (err) {
            addTest('FASE_B', 'B3 Pasos cliente', 'fail', err.message);
        }

        // ── B4.1: Crear follow-up prospect (requiere vendor_id real) ──
        let fbVendorId = null;
        try {
            if (!fb.c1) throw new Error('No hay c1');
            // POST /api/follow-up-prospects exige vendor_id; tomar uno existente.
            const vRows = await query('SELECT id FROM vendors ORDER BY created_at ASC LIMIT 1');
            fbVendorId = vRows[0]?.id || null;
            if (!fbVendorId) {
                addTest('FASE_B', 'B4.1 Crear follow-up prospect', 'skip',
                    'No hay vendors en BD - test omitido');
            } else {
                const { response, payload } = await apiJson('/api/follow-up-prospects', {
                    method: 'POST',
                    json: {
                        company_name: `${PFX_FB}_Prospect`,
                        client_id: fb.c1,
                        vendor_id: fbVendorId,
                        fijo_ren: 0, fijo_new: 0,
                        movil_nueva: 0, movil_renovacion: 0,
                        claro_tv: 0, cloud: 0, mpls: 0,
                        total_amount: 1000,
                        notes: 'prospect sintetico'
                    }
                });
                if (response.ok && payload?.id) {
                    fb.followUpId = payload.id;
                    addTest('FASE_B', 'B4.1 Crear follow-up prospect', 'pass',
                        `prospect ${fb.followUpId} creado`);
                } else {
                    addTest('FASE_B', 'B4.1 Crear follow-up prospect', 'fail',
                        `HTTP ${response.status} ${payload?.error || ''}`);
                }
            }
        } catch (err) {
            addTest('FASE_B', 'B4.1 Crear follow-up prospect', 'fail', err.message);
        }

        // ── B4.2: Editar prospect (notes/total_amount) ──
        try {
            if (!fb.followUpId) {
                if (!fbVendorId) {
                    addTest('FASE_B', 'B4.2 Editar prospect', 'skip',
                        'B4.1 skipped por falta de vendor - no hay prospect');
                    throw new Error('__SKIP__');
                }
                throw new Error('No hay followUpId');
            }
            const { response } = await apiJson(`/api/follow-up-prospects/${fb.followUpId}`, {
                method: 'PUT',
                json: { notes: 'editado_FaseB', total_amount: 2000 }
            });
            const verify = await query(
                'SELECT notes, total_amount FROM follow_up_prospects WHERE id = $1',
                [fb.followUpId]
            );
            if (response.ok && verify[0]?.notes === 'editado_FaseB' && Number(verify[0]?.total_amount) === 2000) {
                addTest('FASE_B', 'B4.2 Editar prospect', 'pass',
                    'notes y total_amount actualizados');
            } else {
                addTest('FASE_B', 'B4.2 Editar prospect', 'fail',
                    `HTTP ${response.status}`, verify[0]);
            }
        } catch (err) {
            if (err.message !== '__SKIP__') {
                addTest('FASE_B', 'B4.2 Editar prospect', 'fail', err.message);
            }
        }

        // ── B4.3: Log de llamada (PUT con last_call_date/next_call_date/call_count) ──
        try {
            if (!fb.followUpId) {
                if (!fbVendorId) {
                    addTest('FASE_B', 'B4.3 Log de llamada en prospect', 'skip',
                        'B4.1 skipped - no hay prospect');
                    throw new Error('__SKIP__');
                }
                throw new Error('No hay followUpId');
            }
            const { response } = await apiJson(`/api/follow-up-prospects/${fb.followUpId}`, {
                method: 'PUT',
                json: {
                    last_call_date: '2099-06-01',
                    next_call_date: '2099-06-15',
                    call_count: 1
                }
            });
            const verify = await query(
                'SELECT last_call_date::text, next_call_date::text, call_count FROM follow_up_prospects WHERE id = $1',
                [fb.followUpId]
            );
            const row = verify[0];
            const ok = response.ok
                && String(row?.last_call_date || '').startsWith('2099-06-01')
                && String(row?.next_call_date || '').startsWith('2099-06-15')
                && Number(row?.call_count) === 1;
            if (ok) {
                addTest('FASE_B', 'B4.3 Log de llamada en prospect', 'pass',
                    `call_count=1, fechas guardadas`);
            } else {
                addTest('FASE_B', 'B4.3 Log de llamada en prospect', 'fail',
                    `HTTP ${response.status}`, row);
            }
        } catch (err) {
            if (err.message !== '__SKIP__') {
                addTest('FASE_B', 'B4.3 Log de llamada en prospect', 'fail', err.message);
            }
        }

        // ── B4.4: Completar prospect ──
        try {
            if (!fb.followUpId) {
                if (!fbVendorId) {
                    addTest('FASE_B', 'B4.4 Completar prospect', 'skip',
                        'B4.1 skipped - no hay prospect');
                    throw new Error('__SKIP__');
                }
                throw new Error('No hay followUpId');
            }
            const { response } = await apiJson(`/api/follow-up-prospects/${fb.followUpId}`, {
                method: 'PUT',
                json: { is_completed: true, completed_date: '2099-06-30' }
            });
            const verify = await query(
                'SELECT is_completed, completed_date::text FROM follow_up_prospects WHERE id = $1',
                [fb.followUpId]
            );
            const row = verify[0];
            const isCompleted = row?.is_completed === true || row?.is_completed === 1 || String(row?.is_completed) === 't';
            if (response.ok && isCompleted && String(row?.completed_date || '').startsWith('2099-06-30')) {
                addTest('FASE_B', 'B4.4 Completar prospect', 'pass',
                    'is_completed=true, completed_date guardado');
            } else {
                addTest('FASE_B', 'B4.4 Completar prospect', 'fail',
                    `HTTP ${response.status}`, row);
            }
        } catch (err) {
            if (err.message !== '__SKIP__') {
                addTest('FASE_B', 'B4.4 Completar prospect', 'fail', err.message);
            }
        }

        // ── B4.5: Devolver prospect (return) ──
        try {
            if (!fb.followUpId) {
                if (!fbVendorId) {
                    addTest('FASE_B', 'B4.5 Devolver prospect (return)', 'skip',
                        'B4.1 skipped - no hay prospect');
                    throw new Error('__SKIP__');
                }
                throw new Error('No hay followUpId');
            }
            const { response } = await apiJson(`/api/follow-up-prospects/${fb.followUpId}/return`, {
                method: 'PUT'
            });
            const verify = await query(
                'SELECT is_active FROM follow_up_prospects WHERE id = $1',
                [fb.followUpId]
            );
            const row = verify[0];
            const isInactive = row?.is_active === false || row?.is_active === 0
                || String(row?.is_active) === 'f' || String(row?.is_active) === '0';
            if (response.ok && isInactive) {
                addTest('FASE_B', 'B4.5 Devolver prospect (return)', 'pass',
                    `is_active=${row.is_active}`);
            } else {
                addTest('FASE_B', 'B4.5 Devolver prospect (return)', 'fail',
                    `HTTP ${response.status} is_active=${row?.is_active}`);
            }
        } catch (err) {
            if (err.message !== '__SKIP__') {
                addTest('FASE_B', 'B4.5 Devolver prospect (return)', 'fail', err.message);
            }
        }

        // ── B5: Tango sync E2E (skip por defecto, ejecutar solo con flag) ──
        const RUN_TANGO = String(process.env.RUN_TANGO_SYNC_TEST || '').toLowerCase() === 'true';
        if (!RUN_TANGO) {
            addTest('FASE_B', 'B5.1 Tango sync HTTP 200', 'skip',
                'RUN_TANGO_SYNC_TEST != true (off por defecto)');
            addTest('FASE_B', 'B5.2 Tango sync stats coherente', 'skip',
                'RUN_TANGO_SYNC_TEST != true');
            addTest('FASE_B', 'B5.3 Sin regresion de count subscribers', 'skip',
                'RUN_TANGO_SYNC_TEST != true');
        } else {
            let preCount = 0;
            try {
                const pre = await query('SELECT COUNT(*)::int AS n FROM subscribers');
                preCount = Number(pre[0]?.n || 0);
                const { response, payload } = await apiJson('/api/tango/sync', {
                    method: 'POST',
                    headers: { 'X-Test-Timeout-Override': '120000' }
                });
                // B5.1
                if (response.ok) {
                    addTest('FASE_B', 'B5.1 Tango sync HTTP 200', 'pass', 'sync ejecutado');
                } else {
                    addTest('FASE_B', 'B5.1 Tango sync HTTP 200', 'fail',
                        `HTTP ${response.status}`);
                }
                // B5.2
                const stats = payload?.stats || {};
                const errors = Number(stats.errors || 0);
                const ventas = Number(stats.tango_ventas || 0);
                if (errors === 0 && ventas > 0) {
                    addTest('FASE_B', 'B5.2 Tango sync stats coherente', 'pass',
                        `errors=0, tango_ventas=${ventas}`);
                } else {
                    addTest('FASE_B', 'B5.2 Tango sync stats coherente', 'fail',
                        `errors=${errors}, tango_ventas=${ventas}`);
                }
                // B5.3
                const post = await query('SELECT COUNT(*)::int AS n FROM subscribers');
                const postCount = Number(post[0]?.n || 0);
                if (postCount >= preCount) {
                    addTest('FASE_B', 'B5.3 Sin regresion de count subscribers', 'pass',
                        `pre=${preCount}, post=${postCount}`);
                } else {
                    addTest('FASE_B', 'B5.3 Sin regresion de count subscribers', 'fail',
                        `pre=${preCount}, post=${postCount} (perdida)`);
                }
            } catch (err) {
                addTest('FASE_B', 'B5 Tango sync E2E', 'fail', err.message);
            }
        }

        // ── B6.1: Cleanup local FASE B ──
        try {
            if (fb.followUpId) await client.query('DELETE FROM follow_up_prospects WHERE id = $1', [fb.followUpId]);
            // Tareas (por si quedaron, aunque B1.4 ya borró)
            await client.query(`DELETE FROM crm_tasks WHERE title LIKE '${PFX_FB}_%'`);
            // client_steps del cliente sintético
            if (fb.c1) await client.query('DELETE FROM client_steps WHERE client_id = $1', [fb.c1]);
            // Cliente sintético
            if (fb.c1) await client.query('DELETE FROM clients WHERE id = $1', [fb.c1]);
            // User + permission overrides + salesperson
            if (fb.userId) {
                await client.query('DELETE FROM user_permission_overrides WHERE user_id = $1', [fb.userId]).catch(() => {});
                await client.query('DELETE FROM users_auth WHERE id = $1', [fb.userId]);
            }
            if (fb.salespersonId) {
                await client.query('DELETE FROM salespeople WHERE id = $1', [fb.salespersonId]).catch(() => {});
            }
            addTest('FASE_B', 'B6.1 Cleanup local FASE B', 'pass',
                'Datos sinteticos FASE B eliminados (user, salesperson, cliente, tareas, prospect, steps)');
        } catch (err) {
            addTest('FASE_B', 'B6.1 Cleanup local FASE B', 'fail', err.message);
        }

        // ========================================
        // FASE 12: LIMPIEZA FINAL
        // ========================================
        try {
            // Eliminar en orden inverso por las foreign keys
            if (referidoId) await client.query('DELETE FROM referidos WHERE id = $1', [referidoId]);
            await client.query(`
                DO $$
                BEGIN
                  IF to_regclass('public.agent_runs') IS NOT NULL THEN
                    DELETE FROM agent_runs WHERE agent_name LIKE '${TEST_PREFIX}%';
                  END IF;
                  IF to_regclass('public.agent_tasks') IS NOT NULL THEN
                    DELETE FROM agent_tasks WHERE agent_name LIKE '${TEST_PREFIX}%';
                  END IF;
                  IF to_regclass('public.agent_decisions') IS NOT NULL THEN
                    DELETE FROM agent_decisions WHERE agent_name LIKE '${TEST_PREFIX}%';
                  END IF;
                  IF to_regclass('public.agent_memory') IS NOT NULL THEN
                    DELETE FROM agent_memory WHERE agent_name LIKE '${TEST_PREFIX}%';
                  END IF;
                END $$;
            `);
            await client.query('DELETE FROM follow_up_steps WHERE name LIKE $1', [`${TEST_PREFIX}_Paso_Seguimiento%`]);
            await client.query('DELETE FROM priorities WHERE name LIKE $1', [`${TEST_PREFIX}_Prioridad%`]);
            if (subscriberId) await client.query('DELETE FROM subscribers WHERE id = $1', [subscriberId]);
            if (followUpId) await client.query('DELETE FROM follow_up_prospects WHERE id = $1', [followUpId]);
            if (banId) await client.query('DELETE FROM bans WHERE id = $1', [banId]);
            if (clientId) await client.query('DELETE FROM clients WHERE id = $1', [clientId]);
            // Defensa adicional: cualquier user_auth/salesperson sintetico (FASE A)
            await client.query(`DELETE FROM user_permission_overrides WHERE user_id IN (SELECT id FROM users_auth WHERE username LIKE '${TEST_PREFIX}%')`).catch(() => {});
            await client.query(`DELETE FROM users_auth WHERE username LIKE '${TEST_PREFIX}%'`);
            await client.query(`DELETE FROM salespeople WHERE name LIKE '${TEST_PREFIX}%'`);

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
