const XLSX = require('xlsx');

console.log('\n📋 PRUEBA DE IMPORTADOR DE ACTIVACIONES\n');
console.log('='.repeat(60));

// 1. Cargar Excel
const filePath = 'elementos_extra/excels/TABLA DE ACTIVACIONES (005).xlsx';
console.log(`\n📁 Cargando archivo: ${filePath}`);

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log(`✅ Total filas leídas: ${jsonData.length}`);

// 2. Extraer Metadatos (Modo Activaciones)
console.log('\n📊 EXTRAYENDO METADATOS:\n');

const vendor = jsonData[2] ? (jsonData[2][3] || jsonData[2][2] || "") : "";
const ban = jsonData[4] ? (jsonData[4][3] || jsonData[4][2] || "") : "";
const businessName = jsonData[6] ? (jsonData[6][3] || jsonData[6][2] || "") : "";

console.log(`  Vendedor (Fila 3):  ${vendor}`);
console.log(`  BAN (Fila 5):       ${ban}`);
console.log(`  Cliente (Fila 7):   ${businessName}`);

// 3. Búsqueda Inteligente de Cabecera
console.log('\n🔍 BUSCANDO CABECERA DE DATOS:\n');

let headerRowIdx = 9; // Por defecto fila 10
let headers = (jsonData[9] || []);

if (!headers.some(h => String(h).toUpperCase().includes("CELULAR") || String(h).toUpperCase().includes("TELEFONO") || String(h).toUpperCase().includes("PHONE"))) {
    headerRowIdx = jsonData.findIndex(row => row && row.some((cell) => String(cell).toUpperCase().includes("CELULAR") || String(cell).toUpperCase().includes("TELEFONO") || String(cell).toUpperCase().includes("PHONE")));
    if (headerRowIdx !== -1) {
        headers = jsonData[headerRowIdx];
        console.log(`  Cabecera encontrada en fila ${headerRowIdx + 1}`);
    }
} else {
    console.log(`  Cabecera encontrada en fila ${headerRowIdx + 1} (por defecto)`);
}

console.log('\n📋 Columnas detectadas:');
headers.forEach((h, idx) => {
    if (h && String(h).trim()) {
        console.log(`  [Col ${idx}] ${h}`);
    }
});

// 4. Mapeo Dinámico de Índices
const idxPhone = headers.findIndex(h => {
    const s = String(h).toUpperCase();
    return s.includes("CELULAR") || s.includes("TELEFONO") || s.includes("PHONE");
});

const idxPlan = headers.findIndex(h => {
    const s = String(h).toUpperCase();
    return s === "PLAN" || (s.includes("PLAN") && !s.includes("DATA") && !s.includes("PRECIO"));
});

const idxValue = headers.findIndex(h => {
    const s = String(h).toUpperCase();
    if (s.includes("PRECIO DE VENTA")) return false;
    return (s.includes("PRECIO") && s.includes("PLAN") && !s.includes("DATA")) || s.includes("VALOR") || s.includes("RENTA");
});

const idxMonths = headers.findIndex(h => String(h).toUpperCase().includes("MESES"));
const idxNotes = headers.findIndex(h => String(h).toUpperCase().includes("COMENTARIOS") || String(h).toUpperCase().includes("NOTAS"));

const finalIdxPhone = idxPhone !== -1 ? idxPhone : 0;
const finalIdxPlan = idxPlan !== -1 ? idxPlan : 6;
const finalIdxValue = idxValue !== -1 ? idxValue : 7;
const finalIdxMonths = idxMonths !== -1 ? idxMonths : 13;
const finalIdxNotes = idxNotes !== -1 ? idxNotes : 15;

console.log('\n🎯 MAPEO DE ÍNDICES:\n');
console.log(`  Teléfono:       Col ${finalIdxPhone} (${headers[finalIdxPhone] || 'No encontrado'})`);
console.log(`  Plan:           Col ${finalIdxPlan} (${headers[finalIdxPlan] || 'No encontrado'})`);
console.log(`  Precio Plan:    Col ${finalIdxValue} (${headers[finalIdxValue] || 'No encontrado'})`);
console.log(`  Meses:          Col ${finalIdxMonths} (${headers[finalIdxMonths] || 'No encontrado'})`);
console.log(`  Comentarios:    Col ${finalIdxNotes} (${headers[finalIdxNotes] || 'No encontrado'})`);

// 5. Extraer Datos
const dataRows = jsonData.slice(headerRowIdx + 1);

console.log('\n📦 EXTRAYENDO DATOS:\n');

const extractedRows = dataRows
    .filter(row => {
        const phone = row[finalIdxPhone];
        return phone && String(phone).replace(/[^0-9]/g, '').length >= 8;
    })
    .map((row, idx) => {
        const cleanPhone = String(row[finalIdxPhone] || "").replace(/[^0-9]/g, '').slice(-10);
        
        let contractEndDate = "";
        const months = parseInt(String(row[finalIdxMonths] || "0").replace(/[^0-9]/g, ''), 10);
        
        if (months > 0) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + months);
            contractEndDate = endDate.toISOString().split('T')[0];
        }

        return {
            row: idx + 1,
            phone: cleanPhone,
            plan: row[finalIdxPlan] || "",
            monthly_value: String(row[finalIdxValue] || "").replace(',', '.'),
            months: row[finalIdxMonths] || "",
            notes: row[finalIdxNotes] || "",
            contract_end_date: contractEndDate
        };
    });

console.log(`  Total filas procesadas: ${extractedRows.length}`);
console.log(`  Total filas omitidas: ${dataRows.length - extractedRows.length}`);

// 6. Mostrar Tabla de Resultados
console.log('\n📊 DATOS EXTRAÍDOS:\n');
console.log('='.repeat(120));
console.log(`${'#'.padEnd(4)} | ${'TELÉFONO'.padEnd(15)} | ${'PLAN'.padEnd(20)} | ${'VALOR'.padEnd(10)} | ${'MESES'.padEnd(6)} | ${'FIN CONTRATO'.padEnd(12)} | ${'COMENTARIOS'.padEnd(20)}`);
console.log('='.repeat(120));

extractedRows.forEach(row => {
    console.log(
        `${String(row.row).padEnd(4)} | ` +
        `${row.phone.padEnd(15)} | ` +
        `${String(row.plan).substring(0, 20).padEnd(20)} | ` +
        `${String(row.monthly_value).padEnd(10)} | ` +
        `${String(row.months).padEnd(6)} | ` +
        `${row.contract_end_date.padEnd(12)} | ` +
        `${String(row.notes).substring(0, 20).padEnd(20)}`
    );
});

console.log('='.repeat(120));

// 7. Validaciones
console.log('\n✅ VALIDACIONES:\n');

const errors = [];

if (!vendor.trim()) errors.push('⚠️  Vendedor no encontrado en el archivo');
if (!ban.toString().trim()) errors.push('⚠️  BAN no encontrado en el archivo');
if (!businessName.trim()) errors.push('⚠️  Nombre del cliente no encontrado en el archivo');

extractedRows.forEach((row, idx) => {
    if (!row.phone || row.phone.length < 8) {
        errors.push(`⚠️  Fila ${row.row}: Teléfono inválido (${row.phone})`);
    }
    if (!row.plan || !String(row.plan).trim()) {
        errors.push(`⚠️  Fila ${row.row}: Plan requerido`);
    }
    if (!row.monthly_value || String(row.monthly_value).trim() === '') {
        errors.push(`⚠️  Fila ${row.row}: Valor mensual requerido`);
    }
});

if (errors.length > 0) {
    console.log('❌ SE ENCONTRARON ERRORES:\n');
    errors.forEach(err => console.log(`  ${err}`));
} else {
    console.log('✅ Todas las validaciones pasaron correctamente');
    console.log(`✅ ${extractedRows.length} activaciones listas para importar`);
}

// 8. Resumen Final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN FINAL:');
console.log('='.repeat(60));
console.log(`  📁 Archivo:           ${filePath}`);
console.log(`  👤 Vendedor:          ${vendor}`);
console.log(`  🏢 Cliente:           ${businessName}`);
console.log(`  📞 BAN:               ${ban}`);
console.log(`  📋 Filas detectadas:  ${extractedRows.length}`);
console.log(`  ✅ Listo para importar: ${errors.length === 0 ? 'SÍ' : 'NO'}`);
console.log('='.repeat(60) + '\n');
