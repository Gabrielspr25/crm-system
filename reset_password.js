import 'dotenv/config'; // Cargar variables de entorno
import { query } from './src/backend/database/db.js';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
    try {
        console.log('🔄 Reseteando contraseña de admin...');
        const newPass = '1234';
        const hash = await bcrypt.hash(newPass, 10);

        // Actualizar usuario 'admin'
        const res = await query(
            `UPDATE users_auth SET password = $1 WHERE username = 'admin' RETURNING id`,
            [hash]
        );

        if (res.length > 0) {
            console.log('✅ Contraseña de "admin" actualizada a "1234"');
        } else {
            console.log('⚠️ Usuario "admin" no encontrado. Creándolo...');
            // Obtener ID de vendedor admin
            const sp = await query("SELECT id FROM salespeople WHERE email = 'admin@crm.com'");
            let spId;
            if (sp.length === 0) {
                const newSp = await query("INSERT INTO salespeople (name, email, role) VALUES ('Admin Principal', 'admin@crm.com', 'admin') RETURNING id");
                spId = newSp[0].id;
            } else {
                spId = sp[0].id;
            }

            await query(
                `INSERT INTO users_auth (username, password, salesperson_id) VALUES ('admin', $1, $2)`,
                [hash, spId]
            );
            console.log('✅ Usuario "admin" creado con contraseña "1234"');
        }

        // Recuperar spId si no estaba definido (caso update)
        if (!spId) {
            const spConf = await query("SELECT id FROM salespeople WHERE email = 'admin@crm.com'");
            if (spConf.length > 0) spId = spConf[0].id;
        }

        // CREAR USUARIO DE RESPALDO (admin2)
        console.log('🔄 Creando usuario de respaldo "admin2"...');
        const res2 = await query(
            `UPDATE users_auth SET password = $1 WHERE username = 'admin2' RETURNING id`,
            [hash]
        );

        if (res2.length > 0) {
            console.log('✅ Usuario "admin2" actualizado a "1234"');
        } else {
            await query(
                `INSERT INTO users_auth (username, password, salesperson_id) VALUES ('admin2', $1, $2)`,
                [hash, spId]
            );
            console.log('✅ Usuario "admin2" creado con contraseña "1234"');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

resetAdmin();
