
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🧹 INICIANDO LIMPIEZA DEL SISTEMA...\n');

    const sql = `
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Borrando datos de prueba...';

    -- 1. Borrar Prospectos/Ventas asociadas a los clientes de prueba
    DELETE FROM follow_up_prospects 
    WHERE company_name IN ('MR BLACK INC', 'FERRETERIA COMERCIAL')
       OR company_name LIKE 'TEST_%';

    -- 2. Borrar Suscriptores asociados a BANs de esos clientes
    DELETE FROM subscribers 
    WHERE ban_id IN (
        SELECT b.id FROM bans b
        JOIN clients c ON b.client_id = c.id
        WHERE c.name IN ('MR BLACK INC', 'FERRETERIA COMERCIAL')
           OR c.name LIKE 'TEST_%'
    );

    -- 3. Borrar BANs
    DELETE FROM bans 
    WHERE client_id IN (
        SELECT id FROM clients 
        WHERE name IN ('MR BLACK INC', 'FERRETERIA COMERCIAL')
           OR name LIKE 'TEST_%'
    );

    -- 4. Borrar Clientes
    DELETE FROM clients 
    WHERE name IN ('MR BLACK INC', 'FERRETERIA COMERCIAL')
       OR name LIKE 'TEST_%';

    RAISE NOTICE 'Limpieza completada con éxito.';
END $$;
`;

    // Escapar para bash
    const escapedSql = sql.replace(/'/g, "'\\''").replace(/\$\$/g, "\\$\\$");
    const cmd = `su - postgres -c "psql -d crm_pro -c '${escapedSql}'"`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✨ Sistema limpio.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
