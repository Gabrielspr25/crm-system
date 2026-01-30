
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔥 ELIMINANDO MR BLACK...\n');

    const sql = `
DO $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT id INTO v_client_id FROM clients WHERE name ILIKE '%MR BLACK%';
    
    IF v_client_id IS NOT NULL THEN
        DELETE FROM follow_up_prospects WHERE client_id = v_client_id;
        DELETE FROM subscribers WHERE ban_id IN (SELECT id FROM bans WHERE client_id = v_client_id);
        DELETE FROM bans WHERE client_id = v_client_id;
        DELETE FROM clients WHERE id = v_client_id;
        RAISE NOTICE 'Cliente MR BLACK eliminado.';
    ELSE
        RAISE NOTICE 'No se encontró MR BLACK.';
    END IF;
END $$;
`;

    const escapedSql = sql.replace(/'/g, "'\\''").replace(/\$\$/g, "\\$\\$");
    const cmd = `su - postgres -c "psql -d crm_pro -c '${escapedSql}'"`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
