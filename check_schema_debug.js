import { query } from './src/backend/database/db.js';

async function checkSchema() {
    try {
        const result = await query(`
      SELECT * FROM follow_up_prospects LIMIT 1;
    `);
        if (result.length > 0) {
            console.log('Columnas encontradas (keys):', Object.keys(result[0]));
            console.log('Ejemplo de fila:', result[0]);
        } else {
            console.log('La tabla está vacía, no puedo inferir columnas.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

checkSchema();
