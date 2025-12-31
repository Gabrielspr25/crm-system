// Script para borrar datos usando la API del backend (usa las mismas credenciales que el servidor)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

async function borrarViaAPI() {
  try {
    console.log('\n===================================================');
    console.log('  ⚠️  BORRANDO DATOS VIA API DEL BACKEND  ⚠️');
    console.log('===================================================');
    console.log('');
    console.log('⚠️  Este endpoint requiere autenticación');
    console.log('⚠️  Asegúrate de que el backend esté corriendo');
    console.log('');
    console.log('NOTA: Se agregó el endpoint DELETE /api/admin/clean-database');
    console.log('Necesitas autenticarte primero para usarlo.');
    console.log('');
    console.log('===================================================');
    console.log('');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

borrarViaAPI().catch(console.error);

