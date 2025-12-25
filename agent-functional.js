import http from 'http';
import bcrypt from 'bcrypt';
import { query } from './src/backend/database/db.js';

const API_URL = 'http://localhost:3001';
const AGENT_USER = 'agent_check_user';
const AGENT_PASS = 'AgentPass123!';

// Colores para consola
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

async function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    log('\n🕵️  INICIANDO AGENTE DE VERIFICACIÓN FUNCIONAL (E2E)', colors.cyan);
    log('==================================================');

    let userId = null;
    let token = null;
    let clientId = null;
    let banId = null;

    try {
        // 1. CREAR USUARIO TEMPORAL
        log('\n[1/7] Creando usuario temporal en BD...', colors.yellow);
        
        // Crear o recuperar vendedor dummy
        let spId;
        const existingSp = await query("SELECT id FROM salespeople WHERE email = 'agent@test.com'");
        if (existingSp.length > 0) {
            spId = existingSp[0].id;
        } else {
            const spRes = await query(
                `INSERT INTO salespeople (name, email, role, created_at, updated_at)
                 VALUES ($1, $2, 'vendedor', NOW(), NOW()) RETURNING id`,
                [AGENT_USER, 'agent@test.com']
            );
            spId = spRes[0].id;
        }

        // Limpiar usuario si existe de corrida anterior fallida
        await query("DELETE FROM users_auth WHERE username = $1", [AGENT_USER]);

        const hash = await bcrypt.hash(AGENT_PASS, 10);
        // users_auth: id (uuid), username, password, salesperson_id, created_at, last_login
        const userRes = await query(
            `INSERT INTO users_auth (username, password, salesperson_id, created_at) 
             VALUES ($1, $2, $3, NOW()) RETURNING id`,
            [AGENT_USER, hash, spId]
        );
        userId = userRes[0].id;
        log(`✅ Usuario creado (ID: ${userId})`, colors.green);

        // 2. LOGIN (Obtener Token)
        log('\n[2/7] Probando Autenticación (Login)...', colors.yellow);
        const loginRes = await request('POST', '/login', { username: AGENT_USER, password: AGENT_PASS });
        if (loginRes.status !== 200) throw new Error(`Login falló: ${JSON.stringify(loginRes.body)}`);
        token = loginRes.body.token;
        log('✅ Login exitoso. Token recibido.', colors.green);

        // 3. CREAR CLIENTE
        log('\n[3/7] Probando Creación de Cliente...', colors.yellow);
        const randomSuffix = Math.floor(Math.random() * 10000);
        const clientData = {
            name: `Agente Test Client ${randomSuffix}`,
            business_name: `Agente Test Business ${randomSuffix}`,
            email: `agent${randomSuffix}@test.com`,
            phone: '555555555',
            is_active: 1
        };
        const clientRes = await request('POST', '/clients', clientData, token);
        if (clientRes.status !== 201) throw new Error(`Crear Cliente falló: ${JSON.stringify(clientRes.body)}`);
        clientId = clientRes.body.id;
        log(`✅ Cliente creado (ID: ${clientId})`, colors.green);

        // 4. CREAR BAN (Simulando Frontend)
        log('\n[4/7] Probando Creación de BAN...', colors.yellow);
        const randomBan = Math.floor(Math.random() * 900000000 + 100000000).toString();
        const banData = {
            client_id: clientId,
            ban_number: randomBan, 
            description: 'Test BAN Agent',
            status: 'active'
        };
        const banRes = await request('POST', '/bans', banData, token);
        if (banRes.status !== 201) throw new Error(`Crear BAN falló: ${JSON.stringify(banRes.body)}`);
        banId = banRes.body.id;
        
        // Verificar que se guardó correctamente
        if (banRes.body.ban_number !== banData.ban_number && banRes.body.account_number !== banData.ban_number) {
             throw new Error(`El BAN no guardó el número correcto. Recibido: ${JSON.stringify(banRes.body)}`);
        }
        log(`✅ BAN creado correctamente (ID: ${banId})`, colors.green);

        // 5. ACTUALIZAR BAN (La prueba de fuego)
        log('\n[5/7] Probando ACTUALIZACIÓN de BAN (Bug Anterior)...', colors.yellow);
        const newRandomBan = Math.floor(Math.random() * 900000000 + 100000000).toString();
        const updateData = {
            ban_number: newRandomBan, // Nuevo número
            description: 'Updated by Agent',
            client_id: clientId
        };
        const updateRes = await request('PUT', `/bans/${banId}`, updateData, token);
        
        if (updateRes.status !== 200) {
            throw new Error(`Actualizar BAN falló (Status ${updateRes.status}): ${JSON.stringify(updateRes.body)}`);
        }

        // Verificar en BD o respuesta que cambió
        // Nota: El backend puede devolver account_number o ban_number dependiendo de la implementación DB
        const savedNumber = updateRes.body.ban_number || updateRes.body.account_number;
        if (savedNumber !== newRandomBan) {
            throw new Error(`CRÍTICO: El BAN no se actualizó. Se esperaba '${newRandomBan}', se recibió '${savedNumber}'`);
        }
        log('✅ BAN actualizado correctamente. El bug está resuelto.', colors.green);

        // 6. VERIFICAR REPORTES (Nuevo Test)
        log('\n[6/7] Verificando Endpoint de Reportes (Completed Prospects)...', colors.yellow);
        const reportsRes = await request('GET', '/completed-prospects', null, token);
        if (reportsRes.status !== 200) {
            throw new Error(`Endpoint de Reportes falló (Status ${reportsRes.status}). Posiblemente falta la ruta en el backend.`);
        }
        if (!Array.isArray(reportsRes.body)) {
            throw new Error(`Endpoint de Reportes no devolvió un array. Recibido: ${typeof reportsRes.body}`);
        }
        log(`✅ Endpoint de Reportes responde correctamente (${reportsRes.body.length} registros encontrados).`, colors.green);

        log('\n✨ DIAGNÓSTICO FINAL: EL SISTEMA FUNCIONA CORRECTAMENTE ✨', colors.cyan);

    } catch (error) {
        log(`\n❌ ERROR FATAL: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        // 7. LIMPIEZA
        log('\n[7/7] Limpiando datos de prueba...', colors.yellow);
        try {
            if (banId) await query('DELETE FROM bans WHERE id = $1', [banId]);
            if (clientId) await query('DELETE FROM clients WHERE id = $1', [clientId]);
            if (userId) await query('DELETE FROM users_auth WHERE id = $1', [userId]);
            // Limpiar salesperson creado
            await query("DELETE FROM salespeople WHERE email = 'agent@test.com'");
            log('✅ Limpieza completada.', colors.green);
        } catch (e) {
            log(`⚠️ Error en limpieza: ${e.message}`, colors.red);
        }
        process.exit(0);
    }
}

main();
