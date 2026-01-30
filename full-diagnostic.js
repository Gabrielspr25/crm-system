
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('=== DIAGNÓSTICO COMPLETO DEL SERVIDOR ===\n');

    const diagnosticCommands = `
echo "1. Estado de PM2:"
pm2 list

echo -e "\n2. Últimos 30 logs del backend:"
pm2 logs ventaspro-backend --lines 30 --nostream

echo -e "\n3. Verificar si el puerto 3001 está escuchando:"
netstat -tlnp | grep 3001 || ss -tlnp | grep 3001

echo -e "\n4. Verificar archivos dist:"
ls -lah /var/www/VentasProui/dist/ | head -20

echo -e "\n5. Verificar package.json version:"
grep '"version"' /var/www/VentasProui/package.json

echo -e "\n6. Verificar .env existe:"
ls -la /var/www/VentasProui/.env

echo -e "\n7. Test de conexión a DB:"
cd /var/www/VentasProui && node -e "import('pg').then(({Pool})=>{const p=new Pool({host:'localhost',port:5432,database:'crm_pro',user:'crm_user',password:'CRM_Seguro_2025!'});p.query('SELECT NOW()').then(r=>console.log('DB OK:',r.rows[0])).catch(e=>console.error('DB ERROR:',e.message)).finally(()=>p.end());})"

echo -e "\n8. Verificar sintaxis de server-FINAL.js:"
cd /var/www/VentasProui && node --check server-FINAL.js && echo "Syntax OK" || echo "SYNTAX ERROR"
`;

    conn.exec(diagnosticCommands, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('\n=== FIN DEL DIAGNÓSTICO ===');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('STDERR: ' + data);
        });
    });
}).connect(config);
