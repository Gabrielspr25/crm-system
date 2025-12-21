import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 VERIFICANDO COMPONENTE OfferGenerator...\n');

const componentPath = path.join(__dirname, 'src', 'react-app', 'components', 'OfferGenerator.tsx');

if (fs.existsSync(componentPath)) {
    console.log('✅ ARCHIVO ENCONTRADO:', componentPath);
    console.log('');
    
    const content = fs.readFileSync(componentPath, 'utf8');
    const lines = content.split('\n');
    
    console.log('📊 TAMAÑO:', lines.length, 'líneas');
    console.log('');
    console.log('📋 CONTENIDO COMPLETO:\n');
    console.log('━'.repeat(80));
    
    lines.forEach((line, i) => {
        console.log(`${String(i + 1).padStart(4, ' ')} | ${line}`);
    });
    
    console.log('━'.repeat(80));
    console.log('\n✅ Componente mostrado completamente\n');
    
} else {
    console.log('❌ COMPONENTE NO EXISTE:', componentPath);
    console.log('\n💡 Necesito crear el componente OfferGenerator con:');
    console.log('   1. Datos del cliente');
    console.log('   2. Planes actuales del cliente');
    console.log('   3. Campo para escribir oferta manual');
    console.log('   4. Botón para generar PDF con la oferta\n');
}
