import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al archivo Excel
const excelPath = path.join(__dirname, 'elementos_extra', 'excels', 'final UNIFICADO_CLIENTES_HERNAN.xlsx');

console.log('Leyendo archivo:', excelPath);

// Leer el archivo Excel
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convertir a JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('\n=== ANÁLISIS DE BANs ===\n');
console.log('Total de filas en el archivo:', data.length);

// Obtener los headers (primera fila)
const headers = data[0];
console.log('\nColumnas encontradas:', headers);

// Analizar los datos (empezando desde la fila 1, índice 1)
const bansActivos = new Set();
const bansCancelados = new Set();
const bansActivosConDatos = new Set();
const bansActivosSinDatos = new Set();

for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Columna C (índice 2) - Estado
    const estado = row[2] ? row[2].toString().trim().toUpperCase() : '';

    // Columna A (índice 0) - BAN
    const ban = row[0] ? row[0].toString().trim() : '';

    if (!ban) continue; // Saltar filas sin BAN

    if (estado === 'A' || estado === 'ACTIVO') {
        bansActivos.add(ban);

        // Columnas I, J, K (índices 8, 9, 10)
        const colI = row[8] ? row[8].toString().trim() : '';
        const colJ = row[9] ? row[9].toString().trim() : '';
        const colK = row[10] ? row[10].toString().trim() : '';

        // Verificar si tiene datos en I, J o K
        if (colI || colJ || colK) {
            bansActivosConDatos.add(ban);
        } else {
            bansActivosSinDatos.add(ban);
        }
    } else if (estado === 'C' || estado === 'CANCELADO') {
        bansCancelados.add(ban);
    }
}

// Mostrar resultados
console.log('\n=== RESULTADOS ===\n');
console.log('📊 BANs ACTIVOS (Estado = A):');
console.log('   Total de BANs únicos activos:', bansActivos.size);
console.log('   - Con datos en columnas I, J o K:', bansActivosConDatos.size);
console.log('   - Sin datos en columnas I, J y K:', bansActivosSinDatos.size);

console.log('\n📊 BANs CANCELADOS (Estado = C):');
console.log('   Total de BANs únicos cancelados:', bansCancelados.size);

console.log('\n📊 RESUMEN TOTAL:');
console.log('   Total de BANs únicos:', bansActivos.size + bansCancelados.size);
console.log('   Total de registros (filas):', data.length - 1); // -1 por el header

// Detalle adicional: contar suscriptores por BAN
console.log('\n=== ANÁLISIS DE SUSCRIPTORES POR BAN ===\n');

const suscriptoresPorBan = {};
for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ban = row[0] ? row[0].toString().trim() : ''; // Columna A (índice 0)

    if (!ban) continue;

    if (!suscriptoresPorBan[ban]) {
        suscriptoresPorBan[ban] = {
            count: 0,
            estado: row[2] ? row[2].toString().trim().toUpperCase() : ''
        };
    }
    suscriptoresPorBan[ban].count++;
}

// Contar BANs con múltiples suscriptores
const bansConMultiplesSuscriptores = Object.entries(suscriptoresPorBan)
    .filter(([ban, info]) => info.count > 1)
    .sort((a, b) => b[1].count - a[1].count); // Ordenar por cantidad de suscriptores

console.log('BANs con múltiples suscriptores:', bansConMultiplesSuscriptores.length);
console.log('\nTop 20 BANs con más suscriptores:');
bansConMultiplesSuscriptores.slice(0, 20).forEach(([ban, info]) => {
    console.log(`   BAN ${ban}: ${info.count} suscriptores (Estado: ${info.estado})`);
});

// Crear tabla detallada de totales
console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║              TABLA DETALLADA DE TOTALES - BANs                     ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 1. BANs ACTIVOS (Estado = A)                                       │');
console.log('├────────────────────────────────────────────────────────────────────┤');
console.log(`│ Total BANs únicos activos:                              ${String(bansActivos.size).padStart(10)} │`);
console.log(`│   • Con datos (Nombre/Apellido/Empresa):                ${String(bansActivosConDatos.size).padStart(10)} │`);
console.log(`│   • Sin datos (campos vacíos):                          ${String(bansActivosSinDatos.size).padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 2. BANs CANCELADOS (Estado = C)                                    │');
console.log('├────────────────────────────────────────────────────────────────────┤');
console.log(`│ Total BANs únicos cancelados:                           ${String(bansCancelados.size).padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 3. SUSCRIPTORES POR BAN                                            │');
console.log('├────────────────────────────────────────────────────────────────────┤');
console.log(`│ BANs con UN solo suscriptor:                            ${String(Object.values(suscriptoresPorBan).filter(info => info.count === 1).length).padStart(10)} │`);
console.log(`│ BANs con MÚLTIPLES suscriptores:                        ${String(bansConMultiplesSuscriptores.length).padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

// Análisis de suscriptores por estado
const activosConMultiples = bansConMultiplesSuscriptores.filter(([ban, info]) => info.estado === 'A').length;
const canceladosConMultiples = bansConMultiplesSuscriptores.filter(([ban, info]) => info.estado === 'C').length;

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 4. DESGLOSE DE BANs CON MÚLTIPLES SUSCRIPTORES                     │');
console.log('├────────────────────────────────────────────────────────────────────┤');
console.log(`│ BANs Activos con múltiples suscriptores:                ${String(activosConMultiples).padStart(10)} │`);
console.log(`│ BANs Cancelados con múltiples suscriptores:             ${String(canceladosConMultiples).padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 5. RESUMEN GENERAL                                                 │');
console.log('├────────────────────────────────────────────────────────────────────┤');
console.log(`│ Total BANs únicos en el archivo:                        ${String(bansActivos.size + bansCancelados.size).padStart(10)} │`);
console.log(`│ Total registros (filas) en el archivo:                  ${String(data.length - 1).padStart(10)} │`);
console.log(`│ Diferencia (suscriptores adicionales):                  ${String((data.length - 1) - (bansActivos.size + bansCancelados.size)).padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

console.log('┌────────────────────────────────────────────────────────────────────┐');
console.log('│ 6. PORCENTAJES                                                     │');
console.log('├────────────────────────────────────────────────────────────────────┤');
const totalBans = bansActivos.size + bansCancelados.size;
const pctActivos = ((bansActivos.size / totalBans) * 100).toFixed(2);
const pctCancelados = ((bansCancelados.size / totalBans) * 100).toFixed(2);
const pctActivosConDatos = ((bansActivosConDatos.size / bansActivos.size) * 100).toFixed(2);
const pctActivosSinDatos = ((bansActivosSinDatos.size / bansActivos.size) * 100).toFixed(2);
const pctMultiples = ((bansConMultiplesSuscriptores.length / totalBans) * 100).toFixed(2);

console.log(`│ % BANs Activos:                                         ${String(pctActivos + '%').padStart(10)} │`);
console.log(`│ % BANs Cancelados:                                      ${String(pctCancelados + '%').padStart(10)} │`);
console.log(`│ % Activos con datos:                                    ${String(pctActivosConDatos + '%').padStart(10)} │`);
console.log(`│ % Activos sin datos:                                    ${String(pctActivosSinDatos + '%').padStart(10)} │`);
console.log(`│ % BANs con múltiples suscriptores:                      ${String(pctMultiples + '%').padStart(10)} │`);
console.log('└────────────────────────────────────────────────────────────────────┘\n');

console.log('\n✅ Análisis completado');
