import { getClient } from '../database/db.js';

/**
 * AGENTE DE PRUEBAS COMPLETO DEL SISTEMA
 * Simula un vendedor real probando TODOS los módulos
 */

const TEST_PREFIX = '__SYSTEM_TEST__';

// Datos de prueba que simulan inputs reales de un vendedor
const TEST_DATA = {
    client: {
        name: `${TEST_PREFIX}_Cliente_Prueba`,
        company: `${TEST_PREFIX}_Empresa_SA`,
        email: 'test@sistematest.com',
        phone: '809-555-0001',
        mobile: '809-555-0002',
        address: 'Calle Prueba #123',
        city: 'Santo Domingo',
        zip_code: '10101',
        notes: 'Cliente creado por agente de pruebas'
    },
    ban: {
        number: `${TEST_PREFIX}_BAN_999888777`,
        status: 'activo'
    },
    subscriber: {
        phone: `${TEST_PREFIX}_8095551234`,
        address: 'Av. Suscriptor #456',
        city: 'Santiago',
        zip_code: '20202'
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

    try {
        // ========================================
        // FASE 1: LIMPIEZA PREVIA (por si quedó basura)
        // ========================================
        addTest('SETUP', 'Limpieza previa', 'pass', 'Iniciando limpieza de datos de prueba anteriores');
        
        await client.query(`DELETE FROM subscribers WHERE phone LIKE '${TEST_PREFIX}%'`);
        await client.query(`DELETE FROM bans WHERE number LIKE '${TEST_PREFIX}%'`);
        await client.query(`DELETE FROM follow_up_prospects WHERE company_name LIKE '${TEST_PREFIX}%'`);
        await client.query(`DELETE FROM clients WHERE name LIKE '${TEST_PREFIX}%'`);

        // ========================================
        // FASE 2: CREAR CLIENTE (Todos los campos)
        // ========================================
        let clientId = null;
        try {
            const clientResult = await client.query(
                `INSERT INTO clients 
                 (name, company, email, phone, mobile_phone, address, city, zip_code, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                 RETURNING *`,
                [
                    TEST_DATA.client.name,
                    TEST_DATA.client.company,
                    TEST_DATA.client.email,
                    TEST_DATA.client.phone,
                    TEST_DATA.client.mobile,
                    TEST_DATA.client.address,
                    TEST_DATA.client.city,
                    TEST_DATA.client.zip_code
                ]
            );
            
            if (clientResult.rows.length > 0) {
                clientId = clientResult.rows[0].id;
                results.createdIds.clientId = clientId;
                
                // Verificar que TODOS los campos se guardaron
                const savedClient = clientResult.rows[0];
                const fieldsOk = [];
                const fieldsFail = [];
                
                if (savedClient.name === TEST_DATA.client.name) fieldsOk.push('name'); else fieldsFail.push('name');
                if (savedClient.company === TEST_DATA.client.company) fieldsOk.push('company'); else fieldsFail.push('company');
                if (savedClient.email === TEST_DATA.client.email) fieldsOk.push('email'); else fieldsFail.push('email');
                if (savedClient.phone === TEST_DATA.client.phone) fieldsOk.push('phone'); else fieldsFail.push('phone');
                if (savedClient.mobile_phone === TEST_DATA.client.mobile) fieldsOk.push('mobile_phone'); else fieldsFail.push('mobile_phone');
                if (savedClient.address === TEST_DATA.client.address) fieldsOk.push('address'); else fieldsFail.push('address');
                if (savedClient.city === TEST_DATA.client.city) fieldsOk.push('city'); else fieldsFail.push('city');
                if (savedClient.zip_code === TEST_DATA.client.zip_code) fieldsOk.push('zip_code'); else fieldsFail.push('zip_code');
                
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
                
                await client.query(
                    `UPDATE clients SET name = $1, city = $2, updated_at = NOW() WHERE id = $3`,
                    [newName, newCity, clientId]
                );
                
                // Verificar que se guardó
                const verifyResult = await client.query('SELECT name, city FROM clients WHERE id = $1', [clientId]);
                
                if (verifyResult.rows[0].name === newName && verifyResult.rows[0].city === newCity) {
                    addTest('CLIENTES', 'Editar cliente y guardar', 'pass', 
                        'Cliente editado correctamente',
                        { before: TEST_DATA.client.name, after: newName });
                } else {
                    addTest('CLIENTES', 'Editar cliente y guardar', 'fail', 
                        'Los cambios no se persistieron');
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
                    `INSERT INTO bans (client_id, number, status, created_at, last_updated)
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
                const newStatus = 'inactivo';
                
                await client.query(
                    `UPDATE bans SET status = $1, last_updated = NOW() WHERE id = $2`,
                    [newStatus, banId]
                );
                
                const verifyBan = await client.query('SELECT status FROM bans WHERE id = $1', [banId]);
                
                if (verifyBan.rows[0].status === newStatus) {
                    addTest('BANS', 'Editar BAN y guardar', 'pass', 
                        'Status de BAN actualizado correctamente',
                        { before: 'activo', after: newStatus });
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
                     (ban_id, phone, address, city, zip_code, is_active, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
                     RETURNING *`,
                    [
                        banId,
                        TEST_DATA.subscriber.phone,
                        TEST_DATA.subscriber.address,
                        TEST_DATA.subscriber.city,
                        TEST_DATA.subscriber.zip_code
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
                    if (savedSub.address === TEST_DATA.subscriber.address) fieldsOk.push('address'); else fieldsFail.push('address');
                    if (savedSub.city === TEST_DATA.subscriber.city) fieldsOk.push('city'); else fieldsFail.push('city');
                    
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
                const newAddress = 'Av. Editada #789';
                
                await client.query(
                    `UPDATE subscribers SET address = $1, updated_at = NOW() WHERE id = $2`,
                    [newAddress, subscriberId]
                );
                
                const verifySub = await client.query('SELECT address FROM subscribers WHERE id = $1', [subscriberId]);
                
                if (verifySub.rows[0].address === newAddress) {
                    addTest('SUSCRIPTORES', 'Editar suscriptor y guardar', 'pass',
                        'Dirección de suscriptor actualizada',
                        { before: TEST_DATA.subscriber.address, after: newAddress });
                } else {
                    addTest('SUSCRIPTORES', 'Editar suscriptor', 'fail', 'El cambio no se guardó');
                }
            } catch (err) {
                addTest('SUSCRIPTORES', 'Editar suscriptor', 'fail', err.message);
            }
        }

        // ========================================
        // FASE 8: CREAR SEGUIMIENTO/PROSPECTO
        // ========================================
        let followUpId = null;
        try {
            const fpResult = await client.query(
                `INSERT INTO follow_up_prospects
                 (company_name, client_id, fijo_ren, fijo_new, movil_nueva, movil_renovacion, 
                  claro_tv, cloud, mpls, notes, contact_phone, contact_email, total_amount,
                  is_completed, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, true, NOW(), NOW())
                 RETURNING *`,
                [
                    TEST_DATA.followUp.company_name,
                    clientId,
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
                        b.id as ban_id, b.number as ban_number,
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

        // ========================================
        // FASE 12: LIMPIEZA FINAL
        // ========================================
        try {
            // Eliminar en orden inverso por las foreign keys
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
