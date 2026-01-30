
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 CONSULTANDO TIERS DE COMISIÓN...\n');
    const cmd = `su - postgres -c "psql -d crm_pro -c \\"SELECT p.name, t.range_min, t.range_max, t.commission_amount FROM product_commission_tiers t JOIN products p ON t.product_id = p.id WHERE p.name ILIKE '%movil%' ORDER BY p.name, t.range_min\\""`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
