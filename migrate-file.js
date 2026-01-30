
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 Ejecutando migración SQL...\n');

    // 1. Crear archivo SQL
    const createSql = `
cat > /tmp/fix_categories.sql << 'EOF'
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color_hex VARCHAR(20) DEFAULT '#3B82F6';
ALTER TABLE categories ALTER COLUMN color_hex SET DEFAULT '#3B82F6';
UPDATE categories SET color_hex = '#3B82F6' WHERE color_hex IS NULL;
EOF
chown postgres:postgres /tmp/fix_categories.sql
`;

    // 2. Ejecutar archivo SQL
    const runSql = `
su - postgres -c "psql -d crm_pro -f /tmp/fix_categories.sql"
`;

    conn.exec(createSql + runSql, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Migración SQL finalizada');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
