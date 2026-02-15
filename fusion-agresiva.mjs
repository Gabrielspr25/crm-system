import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

async function aggressiveMergeDuplicates() {
    const logFusiones = [];
    let fusionesExitosas = 0;
    let fusionesError = 0;

    try {
        console.log('\n🚀 FUSIÓN AUTOMÁTICA AGRESIVA DE CLIENTES DUPLICADOS\n');
        console.log('=' .repeat(80));
        console.log('Fecha:', new Date().toLocaleString());
        console.log('Estrategia: Mantener el registro MÁS ANTIGUO, fusionar todos los demás');
        console.log('=' .repeat(80));

        // Obtener todos los clientes duplicados
        const duplicatesQuery = `
            SELECT 
                UPPER(TRIM(name)) as nombre_normalizado,
                array_agg(id::text ORDER BY created_at) as client_ids,
                COUNT(*) as cantidad
            FROM clients
            WHERE name IS NOT NULL AND TRIM(name) != ''
            GROUP BY UPPER(TRIM(name))
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) ASC, UPPER(TRIM(name));
        `;

        const duplicatesResult = await pool.query(duplicatesQuery);
        console.log(`\n📊 Total de nombres duplicados: ${duplicatesResult.rows.length}`);
        console.log(`📊 Total de registros a fusionar: ${duplicatesResult.rows.reduce((sum, r) => sum + r.cantidad - 1, 0)}\n`);

        for (const dupGroup of duplicatesResult.rows) {
            const clientIds = dupGroup.client_ids;
            const nombreCliente = dupGroup.nombre_normalizado;

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`📋 "${nombreCliente}" (${clientIds.length} duplicados)`);

            // El primer ID es el más antiguo (ORDER BY created_at)
            const targetClientId = clientIds[0];
            console.log(`🎯 Destino: ${targetClientId.substring(0, 8)}... (el más antiguo)`);

            // Fusionar todos los demás al más antiguo
            for (let i = 1; i < clientIds.length; i++) {
                const sourceClientId = clientIds[i];
                console.log(`\n   🔄 Fusionando ${i}/${clientIds.length - 1}: ${sourceClientId.substring(0, 8)}... → ${targetClientId.substring(0, 8)}...`);
                
                const mergeResult = await mergeClients(sourceClientId, targetClientId, nombreCliente);
                
                if (mergeResult.success) {
                    console.log(`   ✅ Éxito | BANs movidos: ${mergeResult.bansMovidos} | Suscriptores: ${mergeResult.susMovidos}`);
                    fusionesExitosas++;
                    logFusiones.push({
                        fecha: new Date().toISOString(),
                        cliente: nombreCliente,
                        origen: sourceClientId,
                        destino: targetClientId,
                        bans_movidos: mergeResult.bansMovidos,
                        suscriptores_movidos: mergeResult.susMovidos,
                        resultado: 'EXITOSA'
                    });
                } else {
                    console.log(`   ❌ Error: ${mergeResult.error}`);
                    fusionesError++;
                    logFusiones.push({
                        fecha: new Date().toISOString(),
                        cliente: nombreCliente,
                        origen: sourceClientId,
                        destino: targetClientId,
                        resultado: 'ERROR',
                        error: mergeResult.error
                    });
                }

                // Esperar 200ms entre fusiones
                await sleep(200);
            }

            console.log(`   ✓ Cliente "${nombreCliente}" consolidado (${clientIds.length} → 1)`);
        }

        // Guardar log
        const fs = await import('fs');
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toISOString().split('T')[1].split(':').slice(0, 2).join('-');
        const logFilename = `FUSION-AGRESIVA-${fecha}-${hora}.json`;
        fs.writeFileSync(logFilename, JSON.stringify(logFusiones, null, 2));

        // Resumen final
        console.log(`\n\n${'='.repeat(80)}`);
        console.log('🎉 FUSIÓN COMPLETADA');
        console.log('='.repeat(80));
        console.log(`✅ Fusiones exitosas:  ${fusionesExitosas}`);
        console.log(`❌ Errores:            ${fusionesError}`);
        console.log(`📊 Clientes eliminados: ${fusionesExitosas}`);
        console.log(`📊 Clientes restantes:  ${duplicatesResult.rows.length} (consolidados)`);
        console.log(`📄 Log guardado:       ${logFilename}`);
        console.log('='.repeat(80) + '\n');

        // Verificación final
        console.log('🔍 Verificando duplicados restantes...\n');
        const verifyResult = await pool.query(duplicatesQuery);
        if (verifyResult.rows.length === 0) {
            console.log('✅ ¡PERFECTO! No quedan duplicados en la base de datos.\n');
        } else {
            console.log(`⚠️  Aún quedan ${verifyResult.rows.length} nombres duplicados.`);
            console.log('   Revisar errores en el log.\n');
        }

    } catch (error) {
        console.error('❌ Error fatal:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

async function mergeClients(sourceId, targetId, clientName) {
    try {
        // 1. Contar BANs y suscriptores antes de mover
        const bansCountResult = await pool.query(
            'SELECT COUNT(*) as count FROM bans WHERE client_id = $1',
            [sourceId]
        );
        const bansMovidos = parseInt(bansCountResult.rows[0].count);

        const susCountResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM subscribers s 
             JOIN bans b ON s.ban_id = b.id 
             WHERE b.client_id = $1`,
            [sourceId]
        );
        const susMovidos = parseInt(susCountResult.rows[0].count);

        // 2. Mover BANs
        await pool.query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);

        // 3. Mover follow_up_prospects si existen
        await pool.query('UPDATE follow_up_prospects SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);

        // 4. Eliminar cliente origen
        await pool.query('DELETE FROM clients WHERE id = $1', [sourceId]);

        return { 
            success: true, 
            bansMovidos,
            susMovidos
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            bansMovidos: 0,
            susMovidos: 0
        };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar
aggressiveMergeDuplicates();
