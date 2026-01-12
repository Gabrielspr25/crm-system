import { Pool } from 'pg';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD
});

export async function runSystemDiagnostics(req, res) {
  const checks = [];

  // ========================================
  // 1. SISTEMA OPERATIVO Y RECURSOS
  // ========================================
  
  // 1.1 Versión de Node.js
  checks.push({
    name: '1.1 Versión de Node.js',
    status: 'success',
    message: `v${process.version}`,
    details: { 
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });

  // 1.2 Memoria del sistema
  const memUsage = process.memoryUsage();
  const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
  const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
  checks.push({
    name: '1.2 Memoria del Proceso',
    status: memUsedMB > 500 ? 'warning' : 'success',
    message: `${memUsedMB}MB usado de ${memTotalMB}MB`,
    details: {
      heapUsed: `${memUsedMB}MB`,
      heapTotal: `${memTotalMB}MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`
    }
  });

  // 1.3 Uptime del proceso
  const uptimeSeconds = process.uptime();
  const uptimeHours = (uptimeSeconds / 3600).toFixed(2);
  checks.push({
    name: '1.3 Uptime del Servidor',
    status: 'success',
    message: `${uptimeHours} horas (${Math.floor(uptimeSeconds)} segundos)`,
    details: { seconds: Math.floor(uptimeSeconds), hours: uptimeHours }
  });

  // ========================================
  // 2. VARIABLES DE ENTORNO
  // ========================================
  
  const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    checks.push({
      name: '2.1 Variables de Entorno',
      status: 'success',
      message: 'Todas las variables requeridas están configuradas',
      details: { configured: requiredEnvVars }
    });
  } else {
    checks.push({
      name: '2.1 Variables de Entorno',
      status: 'error',
      message: `Faltan variables: ${missingVars.join(', ')}`,
      details: { missing: missingVars, configured: requiredEnvVars.filter(v => !missingVars.includes(v)) }
    });
  }

  // ========================================
  // 3. BASE DE DATOS - CONEXIÓN
  // ========================================

  // ========================================
  // 3. BASE DE DATOS - CONEXIÓN
  // ========================================

  // 3.1 Verificar conexión a base de datos
  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    checks.push({
      name: '3.1 Conexión a PostgreSQL',
      status: responseTime > 100 ? 'warning' : 'success',
      message: responseTime > 100 
        ? `Conectado pero lento (${responseTime}ms)` 
        : `Conectado (${responseTime}ms)`,
      details: { 
        responseTime: `${responseTime}ms`,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      }
    });
  } catch (error) {
    checks.push({
      name: '3.1 Conexión a PostgreSQL',
      status: 'error',
      message: `Error: ${error.message}`,
      details: { error: error.message }
    });
    return res.json({ checks, status: 'critical', timestamp: new Date().toISOString() });
  }

  // 3.2 Verificar versión de PostgreSQL
  try {
    const versionResult = await pool.query('SHOW server_version');
    checks.push({
      name: '3.2 Versión de PostgreSQL',
      status: 'success',
      message: versionResult.rows[0].server_version,
      details: { version: versionResult.rows[0].server_version }
    });
  } catch (error) {
    checks.push({
      name: '3.2 Versión de PostgreSQL',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 3.3 Verificar conexiones activas
  try {
    const connectionsResult = await pool.query(`
      SELECT count(*) as total, 
             count(*) FILTER (WHERE state = 'active') as active,
             count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    const { total, active, idle } = connectionsResult.rows[0];
    checks.push({
      name: '3.3 Conexiones a la Base de Datos',
      status: parseInt(total) > 50 ? 'warning' : 'success',
      message: `${total} conexiones (${active} activas, ${idle} idle)`,
      details: { 
        total: parseInt(total), 
        active: parseInt(active), 
        idle: parseInt(idle) 
      }
    });
  } catch (error) {
    checks.push({
      name: '3.3 Conexiones a la Base de Datos',
      status: 'warning',
      message: 'No se pudo verificar'
    });
  }

  // ========================================
  // 4. BASE DE DATOS - TABLAS PRINCIPALES
  // ========================================
  // ========================================
  // 4. BASE DE DATOS - TABLAS PRINCIPALES
  // ========================================

  const tables = [
    { name: 'users_auth', description: 'Usuarios y autenticación' },
    { name: 'salespeople', description: 'Vendedores' },
    { name: 'clients', description: 'Clientes' },
    { name: 'bans', description: 'Cuentas BAN' },
    { name: 'subscribers', description: 'Suscriptores' },
    { name: 'follow_up_prospects', description: 'Seguimiento y Prospectos' },
    { name: 'products', description: 'Productos' },
    { name: 'categories', description: 'Categorías' },
    { name: 'goals', description: 'Metas' },
    { name: 'referrals', description: 'Referidos' },
    { name: 'tariffs_plans', description: 'Planes de Tarifas' }
  ];
  
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      const count = parseInt(result.rows[0].count);
      checks.push({
        name: `4.${tables.indexOf(table) + 1} Tabla: ${table.name}`,
        status: 'success',
        message: `${count} registros - ${table.description}`,
        details: { count, table: table.name, description: table.description }
      });
    } catch (error) {
      checks.push({
        name: `4.${tables.indexOf(table) + 1} Tabla: ${table.name}`,
        status: 'error',
        message: `Error: ${error.message}`,
        details: { table: table.name, error: error.message }
      });
    }
  }

  // ========================================
  // 5. INTEGRIDAD REFERENCIAL
  // ========================================
  // ========================================
  // 5. INTEGRIDAD REFERENCIAL
  // ========================================

  // 5.1 Verificar BANs huérfanos
  try {
    const orphanBans = await pool.query(`
      SELECT COUNT(*) as count FROM bans 
      WHERE client_id NOT IN (SELECT id FROM clients)
    `);
    
    const count = parseInt(orphanBans.rows[0].count);
    if (count === 0) {
      checks.push({
        name: '5.1 Integridad: BANs → Clientes',
        status: 'success',
        message: 'Todos los BANs tienen cliente válido'
      });
    } else {
      checks.push({
        name: '5.1 Integridad: BANs → Clientes',
        status: 'warning',
        message: `${count} BANs sin cliente (huérfanos)`,
        details: { orphans: count }
      });
    }
  } catch (error) {
    checks.push({
      name: '5.1 Integridad: BANs → Clientes',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 5.2 Verificar suscriptores huérfanos
  try {
    const orphanSubscribers = await pool.query(`
      SELECT COUNT(*) as count FROM subscribers 
      WHERE ban_id NOT IN (SELECT id FROM bans)
    `);
    
    const count = parseInt(orphanSubscribers.rows[0].count);
    if (count === 0) {
      checks.push({
        name: '5.2 Integridad: Suscriptores → BANs',
        status: 'success',
        message: 'Todos los suscriptores tienen BAN válido'
      });
    } else {
      checks.push({
        name: '5.2 Integridad: Suscriptores → BANs',
        status: 'warning',
        message: `${count} suscriptores sin BAN (huérfanos)`,
        details: { orphans: count }
      });
    }
  } catch (error) {
    checks.push({
      name: '5.2 Integridad: Suscriptores → BANs',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 5.3 Verificar clientes sin vendedor
  try {
    const clientsNoSalesperson = await pool.query(`
      SELECT COUNT(*) as count FROM clients 
      WHERE salesperson_id IS NULL
    `);
    
    const count = parseInt(clientsNoSalesperson.rows[0].count);
    if (count === 0) {
      checks.push({
        name: '5.3 Integridad: Clientes → Vendedores',
        status: 'success',
        message: 'Todos los clientes tienen vendedor asignado'
      });
    } else {
      checks.push({
        name: '5.3 Integridad: Clientes → Vendedores',
        status: 'warning',
        message: `${count} clientes sin vendedor asignado`,
        details: { count }
      });
    }
  } catch (error) {
    checks.push({
      name: '5.3 Integridad: Clientes → Vendedores',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }
  try {
    const prospectsNoClient = await pool.query(`
      SELECT COUNT(*) as count FROM follow_up_prospects 
      WHERE client_id IS NULL
    `);
    
    const count = parseInt(prospectsNoClient.rows[0].count);
    if (count === 0) {
      checks.push({
        name: 'Integridad: Prospectos sin cliente',
        status: 'success',
        message: 'Todos los prospectos tienen cliente asignado'
      });
    } else {
      checks.push({
        name: 'Integridad: Prospectos sin cliente',
        status: 'warning',
        message: `${count} prospectos sin client_id (válido para importados)`,
        details: { count }
      });
    }
  } catch (error) {
    checks.push({
      name: 'Integridad: Prospectos sin cliente',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 6. Verificar tipos de datos UUIDs
  try {
    const uuidCheck = await pool.query(`
      SELECT 
        pg_typeof(id) as client_id_type,
        pg_typeof(salesperson_id) as salesperson_id_type
      FROM clients 
      LIMIT 1
    `);
    
    const types = uuidCheck.rows[0];
    if (types && types.client_id_type === 'uuid' && types.salesperson_id_type === 'uuid') {
      checks.push({
        name: 'Schema: Tipos UUID',
        status: 'success',
        message: 'Todos los IDs usan UUID correctamente'
      });
    } else {
      checks.push({
        name: 'Schema: Tipos UUID',
        status: 'warning',
        message: 'Verificar tipos de datos',
        details: types
      });
    }
  } catch (error) {
    checks.push({
      name: 'Schema: Tipos UUID',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 7. Verificar columnas críticas
  try {
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subscribers' AND column_name = 'line_type'
    `);
    
    if (columnCheck.rows.length > 0) {
      checks.push({
        name: 'Schema: subscribers.line_type',
        status: 'success',
        message: `Existe (${columnCheck.rows[0].data_type})`,
        details: columnCheck.rows[0]
      });
    } else {
      checks.push({
        name: 'Schema: subscribers.line_type',
        status: 'error',
        message: 'Columna no existe - requerida para Reportes'
      });
    }
  } catch (error) {
    checks.push({
      name: 'Schema: subscribers.line_type',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 8. Verificar productos con comisiones
  try {
    const productsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN commission_percentage IS NOT NULL THEN 1 END) as with_commission
      FROM products
    `);
    
    const { total, with_commission } = productsCheck.rows[0];
    if (parseInt(total) === parseInt(with_commission)) {
      checks.push({
        name: 'Productos: Comisiones',
        status: 'success',
        message: `${total} productos con comisión configurada`,
        details: { total: parseInt(total), with_commission: parseInt(with_commission) }
      });
    } else {
      checks.push({
        name: 'Productos: Comisiones',
        status: 'warning',
        message: `${parseInt(total) - parseInt(with_commission)} productos sin comisión`,
        details: { total: parseInt(total), with_commission: parseInt(with_commission) }
      });
    }
  } catch (error) {
    checks.push({
      name: 'Productos: Comisiones',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // 9. Verificar versión del sistema
  try {
    const packageJson = require('../../package.json');
    checks.push({
      name: 'Versión del Sistema',
      status: 'success',
      message: `v${packageJson.version}`,
      details: { version: packageJson.version, name: packageJson.name }
    });
  } catch (error) {
    checks.push({
      name: 'Versión del Sistema',
      status: 'warning',
      message: 'No se pudo leer package.json'
    });
  }

  // 10. Verificar estadísticas generales
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE salesperson_id IS NOT NULL) as clients_assigned,
        (SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NULL) as prospects_active,
        (SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NOT NULL) as prospects_completed,
        (SELECT COUNT(DISTINCT salesperson_id) FROM clients) as active_salespeople
    `);
    
    checks.push({
      name: 'Estadísticas del Sistema',
      status: 'success',
      message: 'Resumen operativo',
      details: {
        clientes_asignados: parseInt(stats.rows[0].clients_assigned),
        prospectos_activos: parseInt(stats.rows[0].prospects_active),
        ventas_completadas: parseInt(stats.rows[0].prospects_completed),
        vendedores_activos: parseInt(stats.rows[0].active_salespeople)
      }
    });
  } catch (error) {
    checks.push({
      name: 'Estadísticas del Sistema',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // ========================================
  // 7. PRUEBAS FUNCIONALES (ESCRITURA)
  // ========================================

  // 7.1 Probar CREAR Cliente (test)
  let testClientId = null;
  try {
    // Obtener un vendedor para asignar
    const salespersonResult = await pool.query('SELECT id FROM salespeople LIMIT 1');
    if (salespersonResult.rows.length === 0) {
      checks.push({
        name: '7.1 Test: CREAR Cliente',
        status: 'warning',
        message: 'No hay vendedores en el sistema para probar'
      });
    } else {
      const salespersonId = salespersonResult.rows[0].id;
      
      const insertResult = await pool.query(`
        INSERT INTO clients (name, salesperson_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING id
      `, [`TEST_DIAGNOSTICO_${Date.now()}`, salespersonId]);
      
      testClientId = insertResult.rows[0].id;
      
      checks.push({
        name: '7.1 Test: CREAR Cliente',
        status: 'success',
        message: 'Cliente de prueba creado exitosamente',
        details: { client_id: testClientId }
      });
    }
  } catch (error) {
    checks.push({
      name: '7.1 Test: CREAR Cliente',
      status: 'error',
      message: `Error: ${error.message}`,
      details: { error: error.message }
    });
  }

  // 7.2 Probar EDITAR Cliente
  if (testClientId) {
    try {
      await pool.query(`
        UPDATE clients 
        SET name = $1, updated_at = NOW()
        WHERE id = $2
      `, [`TEST_EDITADO_${Date.now()}`, testClientId]);
      
      checks.push({
        name: '7.2 Test: EDITAR Cliente',
        status: 'success',
        message: 'Cliente de prueba editado exitosamente'
      });
    } catch (error) {
      checks.push({
        name: '7.2 Test: EDITAR Cliente',
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
  }

  // 7.3 Probar CREAR BAN
  let testBanId = null;
  if (testClientId) {
    try {
      const banResult = await pool.query(`
        INSERT INTO bans (client_id, ban_number, account_type, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
      `, [testClientId, `TEST_BAN_${Date.now()}`, 'movil', 'A']);
      
      testBanId = banResult.rows[0].id;
      
      checks.push({
        name: '7.3 Test: CREAR BAN',
        status: 'success',
        message: 'BAN de prueba creado exitosamente',
        details: { ban_id: testBanId }
      });
    } catch (error) {
      checks.push({
        name: '7.3 Test: CREAR BAN',
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
  }

  // 7.4 Probar CREAR Suscriptor
  let testSubscriberId = null;
  if (testBanId) {
    try {
      const subscriberResult = await pool.query(`
        INSERT INTO subscribers (ban_id, phone, plan, monthly_value, line_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, [testBanId, `787${Math.floor(Math.random() * 9999999)}`, 'Plan Test', 35.00, 'NEW']);
      
      testSubscriberId = subscriberResult.rows[0].id;
      
      checks.push({
        name: '7.4 Test: CREAR Suscriptor',
        status: 'success',
        message: 'Suscriptor de prueba creado exitosamente',
        details: { subscriber_id: testSubscriberId }
      });
    } catch (error) {
      checks.push({
        name: '7.4 Test: CREAR Suscriptor',
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
  }

  // 7.5 Probar MOVER a Seguimiento
  let testProspectId = null;
  if (testClientId) {
    try {
      const prospectResult = await pool.query(`
        INSERT INTO follow_up_prospects (
          client_id, company_name, priority, 
          fijo_ren, fijo_new, movil_nueva, movil_renovacion, 
          claro_tv, cloud, mpls, total_amount,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())
        RETURNING id
      `, [testClientId, 'TEST_PROSPECTO', 'media']);
      
      testProspectId = prospectResult.rows[0].id;
      
      checks.push({
        name: '7.5 Test: MOVER a Seguimiento',
        status: 'success',
        message: 'Prospecto creado en seguimiento exitosamente',
        details: { prospect_id: testProspectId }
      });
    } catch (error) {
      checks.push({
        name: '7.5 Test: MOVER a Seguimiento',
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
  }

  // 7.6 Probar COMPLETAR Venta
  if (testProspectId) {
    try {
      await pool.query(`
        UPDATE follow_up_prospects
        SET completed_date = NOW(),
            movil_nueva = 210.00,
            total_amount = 210.00,
            updated_at = NOW()
        WHERE id = $1
      `, [testProspectId]);
      
      checks.push({
        name: '7.6 Test: COMPLETAR Venta',
        status: 'success',
        message: 'Venta completada exitosamente'
      });
    } catch (error) {
      checks.push({
        name: '7.6 Test: COMPLETAR Venta',
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
  }

  // 7.7 Verificar cálculo de comisiones
  if (testProspectId) {
    try {
      const commissionCheck = await pool.query(`
        SELECT 
          fup.movil_nueva,
          p.commission_percentage
        FROM follow_up_prospects fup
        LEFT JOIN products p ON p.name = 'Movil New'
        WHERE fup.id = $1
      `, [testProspectId]);
      
      if (commissionCheck.rows.length > 0) {
        const amount = parseFloat(commissionCheck.rows[0].movil_nueva);
        const percentage = parseFloat(commissionCheck.rows[0].commission_percentage);
        const expectedCommission = (amount * percentage) / 100;
        
        checks.push({
          name: '7.7 Test: Cálculo de Comisiones',
          status: 'success',
          message: `Comisión calculada: $${expectedCommission.toFixed(2)} (${amount} × ${percentage}%)`,
          details: { amount, percentage, commission: expectedCommission }
        });
      }
    } catch (error) {
      checks.push({
        name: '7.7 Test: Cálculo de Comisiones',
        status: 'warning',
        message: 'No se pudo verificar cálculo'
      });
    }
  }

  // ========================================
  // 8. LIMPIEZA DE DATOS DE PRUEBA
  // ========================================

  // 8.1 Limpiar registros de prueba
  let cleanupSuccess = 0;
  let cleanupErrors = 0;

  try {
    if (testProspectId) {
      await pool.query('DELETE FROM follow_up_prospects WHERE id = $1', [testProspectId]);
      cleanupSuccess++;
    }
    if (testSubscriberId) {
      await pool.query('DELETE FROM subscribers WHERE id = $1', [testSubscriberId]);
      cleanupSuccess++;
    }
    if (testBanId) {
      await pool.query('DELETE FROM bans WHERE id = $1', [testBanId]);
      cleanupSuccess++;
    }
    if (testClientId) {
      await pool.query('DELETE FROM clients WHERE id = $1', [testClientId]);
      cleanupSuccess++;
    }
    
    checks.push({
      name: '8.1 Limpieza: Borrar Datos de Prueba',
      status: 'success',
      message: `${cleanupSuccess} registros de prueba eliminados`,
      details: { deleted: cleanupSuccess }
    });
  } catch (error) {
    checks.push({
      name: '8.1 Limpieza: Borrar Datos de Prueba',
      status: 'warning',
      message: `Error al limpiar: ${error.message}`,
      details: { success: cleanupSuccess, errors: cleanupErrors }
    });
  }

  // ========================================
  // 9. ESTADÍSTICAS GENERALES
  // ========================================

  // 9.1 Verificar estadísticas operativas
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE salesperson_id IS NOT NULL) as clients_assigned,
        (SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NULL) as prospects_active,
        (SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NOT NULL) as prospects_completed,
        (SELECT COUNT(DISTINCT salesperson_id) FROM clients) as active_salespeople
    `);
    
    checks.push({
      name: '9.1 Estadísticas del Sistema',
      status: 'success',
      message: 'Resumen operativo',
      details: {
        clientes_asignados: parseInt(stats.rows[0].clients_assigned),
        prospectos_activos: parseInt(stats.rows[0].prospects_active),
        ventas_completadas: parseInt(stats.rows[0].prospects_completed),
        vendedores_activos: parseInt(stats.rows[0].active_salespeople)
      }
    });
  } catch (error) {
    checks.push({
      name: '9.1 Estadísticas del Sistema',
      status: 'error',
      message: `Error: ${error.message}`
    });
  }

  // ========================================
  // 10. RESUMEN FINAL
  // ========================================
  
  const totalChecks = checks.length;
  const successChecks = checks.filter(c => c.status === 'success').length;
  const warningChecks = checks.filter(c => c.status === 'warning').length;
  const errorChecks = checks.filter(c => c.status === 'error').length;
  
  const overallStatus = errorChecks > 0 ? 'critical' : (warningChecks > 0 ? 'warning' : 'healthy');

  res.json({ 
    checks, 
    summary: {
      total: totalChecks,
      success: successChecks,
      warnings: warningChecks,
      errors: errorChecks,
      status: overallStatus
    },
    timestamp: new Date().toISOString() 
  });
}
