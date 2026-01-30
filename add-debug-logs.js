
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔧 AGREGANDO LOGS AL CONTROLADOR...\n');
    const cmd = `
cat > /tmp/productController-debug.js << 'EOF'
import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

export const getProducts = async (req, res) => {
    try {
        console.log('📦 GET PRODUCTS - Iniciando query...');
        const products = await query(\`
            SELECT p.*, c.name as category_name, c.color_hex as category_color 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.name ASC
        \`);
        console.log('📦 Productos obtenidos:', products.rows.length);
        console.log('📦 Primer producto:', JSON.stringify(products.rows[0]));
        res.json(products.rows);
    } catch (error) {
        console.error('❌ ERROR EN GET PRODUCTS:', error);
        serverError(res, error, 'Error obteniendo productos');
    }
};
EOF

cp /tmp/productController-debug.js /var/www/VentasProui/src/backend/controllers/productController.js
pm2 restart ventaspro-backend
sleep 2
pm2 logs ventaspro-backend --lines 5 --nostream
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Logs agregados. Ahora recarga la página de Productos y vuelve a ejecutar este script para ver los logs.');
            conn.end();
        })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
