import pg from 'pg';
import fetch from 'node-fetch';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

// Configuración de autenticación (necesitas un token JWT válido)
const API_BASE = 'https://crmp.ss-group.cloud';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // Pasarlo como variable de entorno

async function autoMergeDuplicates() {
    try {
        console.log('\n🤖 FUSIÓN AUTOMÁTICA DE CLIENTES DUPLICADOS\n');
        console.log('=' .repeat(80));
        console.log('Fecha:', new Date().toLocaleString());
        console.log('=' .repeat(80));

        // Obtener todos los clientes duplicados
        const duplicatesQuery = `
            SELECT 
                UPPER(TRIM(name)) as nombre_normalizado,
                array_agg(id::text ORDER BY created_at) as client_ids,
                array_agg(created_at ORDER BY created_at) as created_dates,
                COUNT(*) as cantidad
            FROM clients
            WHERE name IS NOT NULL AND TRIM(name) != ''
            GROUP BY UPPER(TRIM(name))
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) ASC, UPPER(TRIM(name));
        `;

        const duplicatesResult = await pool.query(duplicatesQuery);
        console.log(`\n📊 Total de nombres duplicados: ${duplicatesResult.rows.length}\n`);

        let fusionesExitosas = 0;
        let fusionesOmitidas = 0;
        let fusionesError = 0;
        const logFusiones = [];

        for (const dupGroup of duplicatesResult.rows) {
            const clientIds = dupGroup.client_ids;
            const nombreCliente = dupGroup.nombre_normalizado;

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`\n📋 Analizando: "${nombreCliente}" (${clientIds.length} duplicados)`);

            // Obtener información completa de cada registro
            const clientsInfoQuery = `
                SELECT 
                    c.id,
                    c.name,
                    c.created_at,
                    COALESCE((SELECT COUNT(*) FROM bans b WHERE b.client_id = c.id), 0) as ban_count,
                    COALESCE((SELECT COUNT(*) FROM subscribers s 
                              JOIN bans b ON s.ban_id = b.id 
                              WHERE b.client_id = c.id), 0) as subscriber_count,
                    COALESCE((SELECT SUM(s.monthly_value) FROM subscribers s 
                              JOIN bans b ON s.ban_id = b.id 
                              WHERE b.client_id = c.id), 0) as total_monthly_value
                FROM clients c
                WHERE c.id = ANY($1::uuid[])
                ORDER BY c.created_at;
            `;

            const clientsInfo = await pool.query(clientsInfoQuery, [clientIds]);
            const clients = clientsInfo.rows;

            // Analizar el grupo
            const clientsConDatos = clients.filter(c => c.ban_count > 0 || c.subscriber_count > 0);
            const clientsSinDatos = clients.filter(c => c.ban_count === 0 && c.subscriber_count === 0);

            console.log(`   ✓ Con datos: ${clientsConDatos.length}`);
            console.log(`   ○ Sin datos: ${clientsSinDatos.length}`);

            // CASO 1: Todos sin datos excepto UNO
            if (clientsConDatos.length === 1 && clientsSinDatos.length > 0) {
                console.log(`\n   ✅ CASO SIMPLE: Mantener registro con datos, eliminar ${clientsSinDatos.length} vacíos`);
                
                const targetClient = clientsConDatos[0];
                console.log(`   🎯 Destino: ${targetClient.id.substring(0, 8)}... (${targetClient.ban_count} BANs, ${targetClient.subscriber_count} subs)`);

                // Fusionar todos los vacíos al que tiene datos
                for (const emptyClient of clientsSinDatos) {
                    console.log(`\n   🔄 Fusionando ${emptyClient.id.substring(0, 8)}... → ${targetClient.id.substring(0, 8)}...`);
                    
                    const mergeResult = await mergeClients(emptyClient.id, targetClient.id);
                    
                    if (mergeResult.success) {
                        console.log(`   ✓ Fusión exitosa`);
                        fusionesExitosas++;
                        logFusiones.push({
                            fecha: new Date().toISOString(),
                            cliente: nombreCliente,
                            origen: emptyClient.id,
                            destino: targetClient.id,
                            tipo: 'SIMPLE',
                            resultado: 'EXITOSA'
                        });
                    } else {
                        console.log(`   ✗ Error: ${mergeResult.error}`);
                        fusionesError++;
                        logFusiones.push({
                            fecha: new Date().toISOString(),
                            cliente: nombreCliente,
                            origen: emptyClient.id,
                            destino: targetClient.id,
                            tipo: 'SIMPLE',
                            resultado: 'ERROR',
                            error: mergeResult.error
                        });
                    }

                    // Esperar 500ms entre fusiones para no sobrecargar el servidor
                    await sleep(500);
                }
            }
            // CASO 2: TODOS sin datos
            else if (clientsConDatos.length === 0) {
                console.log(`\n   ⚠️  TODOS SIN DATOS: Mantener el más antiguo, eliminar ${clientsSinDatos.length - 1}`);
                
                const targetClient = clients[0]; // El más antiguo
                console.log(`   🎯 Destino: ${targetClient.id.substring(0, 8)}... (creado ${new Date(targetClient.created_at).toLocaleDateString()})`);

                // Fusionar todos excepto el primero
                for (let i = 1; i < clients.length; i++) {
                    const emptyClient = clients[i];
                    console.log(`\n   🔄 Fusionando ${emptyClient.id.substring(0, 8)}... → ${targetClient.id.substring(0, 8)}...`);
                    
                    const mergeResult = await mergeClients(emptyClient.id, targetClient.id);
                    
                    if (mergeResult.success) {
                        console.log(`   ✓ Fusión exitosa`);
                        fusionesExitosas++;
                        logFusiones.push({
                            fecha: new Date().toISOString(),
                            cliente: nombreCliente,
                            origen: emptyClient.id,
                            destino: targetClient.id,
                            tipo: 'TODOS_VACIOS',
                            resultado: 'EXITOSA'
                        });
                    } else {
                        console.log(`   ✗ Error: ${mergeResult.error}`);
                        fusionesError++;
                        logFusiones.push({
                            fecha: new Date().toISOString(),
                            cliente: nombreCliente,
                            origen: emptyClient.id,
                            destino: targetClient.id,
                            tipo: 'TODOS_VACIOS',
                            resultado: 'ERROR',
                            error: mergeResult.error
                        });
                    }

                    await sleep(500);
                }
            }
            // CASO 3: MÚLTIPLES con datos (requiere decisión manual)
            else if (clientsConDatos.length > 1) {
                console.log(`\n   ⏭️  OMITIDO: ${clientsConDatos.length} registros con datos - requiere fusión manual`);
                fusionesOmitidas++;
                
                clientsConDatos.forEach((c, idx) => {
                    console.log(`      ${idx + 1}. ID: ${c.id.substring(0, 8)}... | BANs: ${c.ban_count} | Subs: ${c.subscriber_count} | Valor: $${c.total_monthly_value}/mes`);
                });
            }
        }

        // Guardar log
        const logContent = JSON.stringify(logFusiones, null, 2);
        const fs = await import('fs');
        const fecha = new Date().toISOString().split('T')[0];
        fs.writeFileSync(`FUSION-LOG-${fecha}.json`, logContent);

        // Resumen final
        console.log(`\n\n${'='.repeat(80)}`);
        console.log('📊 RESUMEN DE FUSIONES');
        console.log('='.repeat(80));
        console.log(`✅ Fusiones exitosas:  ${fusionesExitosas}`);
        console.log(`⏭️  Omitidas (manual):   ${fusionesOmitidas}`);
        console.log(`❌ Errores:            ${fusionesError}`);
        console.log(`📄 Log guardado en:    FUSION-LOG-${fecha}.json`);
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error fatal:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Función para fusionar dos clientes usando el endpoint del backend
async function mergeClients(sourceId, targetId) {
    try {
        // Hacer fusión directo en base de datos (sin API por ahora)
        // 1. Mover BANs
        await pool.query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);

        // 2. Mover follow_up_prospects si existen
        try {
            await pool.query('UPDATE follow_up_prospects SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
        } catch (e) {
            // Tabla puede no tener registros
        }

        // 3. Eliminar cliente origen
        await pool.query('DELETE FROM clients WHERE id = $1', [sourceId]);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar
autoMergeDuplicates();
