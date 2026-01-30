
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 Ejecutando migración como postgres...\n');

    const cmd = `
su - postgres -c "psql -d crm_pro -c 'ALTER TABLE categories ADD COLUMN IF NOT EXISTS color_hex VARCHAR(20) DEFAULT ''blue'';'"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Comando finalizado');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
