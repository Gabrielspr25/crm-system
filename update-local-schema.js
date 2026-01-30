
import { query } from './src/backend/database/db.js';

async function updateLocalSchema() {
    try {
        console.log('🚀 Actualizando base de datos local para recibir reporte HERNAN...');

        // Tabla Subscribers
        await query(`
            ALTER TABLE subscribers 
            ADD COLUMN IF NOT EXISTS imei VARCHAR(50),
            ADD COLUMN IF NOT EXISTS init_activation_date DATE,
            ADD COLUMN IF NOT EXISTS effective_date DATE,
            ADD COLUMN IF NOT EXISTS activity_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS subscriber_name_remote VARCHAR(255),
            ADD COLUMN IF NOT EXISTS price_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS sub_actv_location VARCHAR(100);
        `);

        // Tabla BANs
        await query(`
            ALTER TABLE bans 
            ADD COLUMN IF NOT EXISTS dealer_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS reason_desc TEXT,
            ADD COLUMN IF NOT EXISTS sub_status_report VARCHAR(100);
        `);

        // Tabla Clients
        await query(`
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
        `);

        console.log('✅ Base de datos local actualizada correctamente.');
    } catch (error) {
        console.error('❌ Error actualizando schema local:', error);
    }
}

updateLocalSchema();
