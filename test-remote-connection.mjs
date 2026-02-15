import pg from 'pg';
const { Pool } = pg;

console.log('🔍 [TEST] Iniciando prueba de conexión a BD remota...');

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
    statement_timeout: 60000,
    ssl: false,
    max: 2
});

pool.on('error', (err) => {
    console.error('🔍 [TEST] Pool error:', err);
});

async function testConnection() {
    try {
        console.log('🔍 [TEST] Intentando conexión...');
        const client = await pool.connect();
        console.log('✅ [TEST] Conexión establecida');
        
        console.log('🔍 [TEST] Ejecutando consulta simple...');
        const startTime = Date.now();
        const result = await client.query('SELECT version()');
        const queryTime = Date.now() - startTime;
        console.log(`✅ [TEST] Query simple: ${queryTime}ms - Result:`, result.rows[0]);
        
        console.log('🔍 [TEST] Verificando tabla venta...');
        try {
            const tableCheck = await client.query('SELECT * FROM venta LIMIT 1');
            console.log('🔍 [TEST] Tabla venta existe y tiene datos:', tableCheck.rows.length > 0);
        } catch (err) {
            console.log('🔍 [TEST] Tabla venta NO existe:', err.message);
        }
        
        try {
            console.log('🔍 [TEST] Contando registros en venta...');
            const countStart = Date.now();
            const countResult = await client.query('SELECT COUNT(*) as total FROM venta');
            const countTime = Date.now() - countStart;
            console.log(`✅ [TEST] Count venta: ${countTime}ms - Total:`, countResult.rows[0].total);
            
            console.log('🔍 [TEST] Obteniendo muestra de datos...');
            const sampleStart = Date.now();
            const sampleResult = await client.query('SELECT * FROM venta LIMIT 5');
            const sampleTime = Date.now() - sampleStart;
            console.log(`✅ [TEST] Sample venta: ${sampleTime}ms - Registros:`, sampleResult.rows.length);
            
            if (sampleResult.rows.length > 0) {
                console.log('🔍 [TEST] Estructura de registro:', Object.keys(sampleResult.rows[0]));
            }
        } catch (err) {
            console.log('🔍 [TEST] Error accediendo a venta:', err.message);
        }
        
        try {
            console.log('🔍 [TEST] Verificando tabla clientecredito...');
            const clientecreditoCheck = await client.query('SELECT * FROM clientecredito LIMIT 1');
            console.log('🔍 [TEST] Tabla clientecredito existe y tiene datos:', clientecreditoCheck.rows.length > 0);
            
            if (clientecreditoCheck.rows.length > 0) {
                console.log('🔍 [TEST] Contando registros en clientecredito...');
                const clientCountStart = Date.now();
                const clientCountResult = await client.query('SELECT COUNT(*) as total FROM clientecredito');
                const clientCountTime = Date.now() - clientCountStart;
                console.log(`✅ [TEST] Count clientecredito: ${clientCountTime}ms - Total:`, clientCountResult.rows[0].total);
            }
        } catch (err) {
            console.log('🔍 [TEST] Error accediendo a clientecredito:', err.message);
        }
        
        client.release();
        console.log('✅ [TEST] Prueba completada exitosamente');
        
    } catch (error) {
        console.error('❌ [TEST] Error en prueba:', error);
        console.error('❌ [TEST] Error details:', error.code, error.message, error.hint);
    } finally {
        await pool.end();
        console.log('🔍 [TEST] Pool cerrado');
        process.exit(0);
    }
}

testConnection();