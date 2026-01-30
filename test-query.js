
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 EJECUTANDO QUERY DIRECTO EN BD...\n');
    const cmd = `su - postgres -c "psql -d crm_pro -c \\"SELECT p.id, p.name, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.name ASC\\""`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
