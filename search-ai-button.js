import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 BUSCANDO BOTÓN "GENERAR OFERTA IA"...\n');

function searchInFile(filePath, searchTerms) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const results = [];

        lines.forEach((line, index) => {
            searchTerms.forEach(term => {
                if (line.toLowerCase().includes(term.toLowerCase())) {
                    results.push({
                        line: index + 1,
                        content: line.trim(),
                        term: term
                    });
                }
            });
        });

        return results;
    } catch (error) {
        return [];
    }
}

function searchDirectory(dir, searchTerms) {
    const results = {};
    
    function walk(directory) {
        try {
            const files = fs.readdirSync(directory);
            
            files.forEach(file => {
                const filePath = path.join(directory, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
                    walk(filePath);
                } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
                    const matches = searchInFile(filePath, searchTerms);
                    if (matches.length > 0) {
                        results[filePath] = matches;
                    }
                }
            });
        } catch (error) {
            // Ignorar errores de permisos
        }
    }
    
    walk(dir);
    return results;
}

const searchTerms = [
    'Generar Oferta',
    'OfferGenerator',
    'offerGenerator',
    'Sparkles',
    'showOfferGenerator',
    'setShowOfferGenerator'
];

const srcPath = path.join(__dirname, 'src');
const results = searchDirectory(srcPath, searchTerms);

console.log('📋 RESULTADOS DE LA BÚSQUEDA:\n');
console.log('━'.repeat(80));

if (Object.keys(results).length === 0) {
    console.log('❌ No se encontró el botón "Generar Oferta IA"\n');
} else {
    Object.entries(results).forEach(([filePath, matches]) => {
        const relativePath = path.relative(__dirname, filePath);
        console.log(`\n📄 ARCHIVO: ${relativePath}`);
        console.log('─'.repeat(80));
        
        matches.forEach(match => {
            console.log(`   Línea ${match.line}: ${match.content.substring(0, 100)}${match.content.length > 100 ? '...' : ''}`);
        });
    });
    
    console.log('\n' + '━'.repeat(80));
    console.log('\n📊 RESUMEN:');
    console.log(`   • Archivos encontrados: ${Object.keys(results).length}`);
    console.log(`   • Total de coincidencias: ${Object.values(results).reduce((sum, m) => sum + m.length, 0)}`);
}

// Buscar componente OfferGenerator
console.log('\n\n🔍 BUSCANDO COMPONENTE OfferGenerator...\n');

const componentsPath = path.join(__dirname, 'src', 'react-app', 'components');
if (fs.existsSync(componentsPath)) {
    const files = fs.readdirSync(componentsPath);
    const offerGenFile = files.find(f => f.toLowerCase().includes('offer'));
    
    if (offerGenFile) {
        const fullPath = path.join(componentsPath, offerGenFile);
        console.log(`✅ ENCONTRADO: ${offerGenFile}\n`);
        
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        console.log('📋 ANÁLISIS DEL COMPONENTE:\n');
        console.log('━'.repeat(80));
        
        // Buscar funciones principales
        const functions = [];
        lines.forEach((line, i) => {
            if (line.includes('function') || line.includes('const') && line.includes('=>')) {
                functions.push({ line: i + 1, content: line.trim() });
            }
        });
        
        console.log('\n🔧 FUNCIONES PRINCIPALES:');
        functions.slice(0, 10).forEach(f => {
            console.log(`   Línea ${f.line}: ${f.content.substring(0, 80)}...`);
        });
        
        console.log('\n📄 PRIMERAS 50 LÍNEAS DEL COMPONENTE:\n');
        console.log('━'.repeat(80));
        lines.slice(0, 50).forEach((line, i) => {
            console.log(`${String(i + 1).padStart(3, ' ')} | ${line}`);
        });
        console.log('━'.repeat(80));
    } else {
        console.log('❌ No se encontró el archivo OfferGenerator\n');
    }
}

console.log('\n✅ Búsqueda completada\n');
