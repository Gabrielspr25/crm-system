import XLSX from 'xlsx';

const filePath = './elementos_extra/excels/Prueba real TABLA DE ACTIVACIONES 2025 CRM.xlsx';

console.log("📋 PROBANDO ARCHIVO DE ACTIVACIONES\n");

// Leer archivo
const workbook = XLSX.readFile(filePath);
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

console.log("=== METADATOS (Posiciones Fijas) ===");
// Vendedor: Fila 3 (idx 2), Col D (idx 3) o C (idx 2)
const vendor = jsonData[2] ? (jsonData[2][3] || jsonData[2][2] || "") : "";
console.log("Vendedor (Fila 3, Col C/D):", vendor);

// BAN: Fila 5 (idx 4), Col D (idx 3) o C (idx 2)
const ban = jsonData[4] ? (jsonData[4][3] || jsonData[4][2] || "") : "";
console.log("BAN (Fila 5, Col C/D):", ban);

// Cliente: Fila 7 (idx 6), Col D (idx 3) o C (idx 2)
const businessName = jsonData[6] ? (jsonData[6][3] || jsonData[6][2] || "") : "";
console.log("Empresa (Fila 7, Col C/D):", businessName);

console.log("\n=== BÚSQUEDA DE CABECERA ===");

// Buscar fila con headers
let headerRowIdx = 9; // Por defecto fila 10
let headers = (jsonData[9] || []);

if (!headers.some(h => String(h).toUpperCase().includes("CELULAR") || String(h).toUpperCase().includes("TELEFONO") || String(h).toUpperCase().includes("PHONE"))) {
    headerRowIdx = jsonData.findIndex(row => row && row.some((cell) => String(cell).toUpperCase().includes("CELULAR") || String(cell).toUpperCase().includes("TELEFONO") || String(cell).toUpperCase().includes("PHONE")));
    if (headerRowIdx !== -1) {
        headers = jsonData[headerRowIdx];
        console.log(`✅ Cabecera encontrada en fila ${headerRowIdx + 1}`);
    } else {
        console.log("❌ No se encontró fila de cabecera con CELULAR/TELEFONO/PHONE");
    }
} else {
    console.log(`✅ Cabecera en fila por defecto ${headerRowIdx + 1}`);
}

console.log("Columnas encontradas:", headers.slice(0, 15));

// Mapeo dinámico
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

// Fallbacks
const finalIdxPhone = idxPhone !== -1 ? idxPhone : 0;
const finalIdxPlan = idxPlan !== -1 ? idxPlan : 6;
const finalIdxValue = idxValue !== -1 ? idxValue : 7;
const finalIdxMonths = idxMonths !== -1 ? idxMonths : 13;
const finalIdxNotes = idxNotes !== -1 ? idxNotes : -1;

console.log("\n=== ÍNDICES DE COLUMNAS ===");
console.log("Teléfono:", finalIdxPhone, headers[finalIdxPhone]);
console.log("Plan:", finalIdxPlan, headers[finalIdxPlan]);
console.log("Valor/Renta:", finalIdxValue, headers[finalIdxValue]);
console.log("Meses:", finalIdxMonths, headers[finalIdxMonths]);
console.log("Notas:", finalIdxNotes, finalIdxNotes !== -1 ? headers[finalIdxNotes] : "No encontrado");

// Extraer filas de datos
const dataRows = jsonData.slice(headerRowIdx + 1);
console.log(`\n=== DATOS (${dataRows.length} filas desde fila ${headerRowIdx + 2}) ===`);

let validRows = 0;
let errorRows = 0;
const errors = [];

for (let i = 0; i < Math.min(5, dataRows.length); i++) {
    const row = dataRows[i];
    const phone = String(row[finalIdxPhone] || "").trim();
    const plan = String(row[finalIdxPlan] || "").trim();
    const value = row[finalIdxValue];
    const months = row[finalIdxMonths];
    const notes = finalIdxNotes !== -1 ? row[finalIdxNotes] : "";

    console.log(`\nFila ${i + 1}:`);
    console.log("  Teléfono:", phone || "❌ VACÍO");
    console.log("  Plan:", plan || "(vacío)");
    console.log("  Valor:", value || "(vacío)");
    console.log("  Meses:", months || "(vacío)");
    console.log("  Notas:", notes || "(vacío)");

    if (!phone) {
        errors.push(`Fila ${i + 1}: Teléfono vacío`);
        errorRows++;
    } else {
        validRows++;
    }
}

console.log(`\n=== RESUMEN ===`);
console.log(`Total filas: ${dataRows.length}`);
console.log(`Muestras válidas: ${validRows}`);
console.log(`Muestras con errores: ${errorRows}`);

if (errors.length > 0) {
    console.log("\n❌ ERRORES ENCONTRADOS:");
    errors.forEach(err => console.log(`  - ${err}`));
}

console.log("\n✅ Validación completada");
console.log("\n📝 INSTRUCCIONES:");
console.log("1. Abre http://143.244.191.139 en tu navegador");
console.log("2. Ve a la página 'Importar'");
console.log("3. Activa el botón '📋 Modo Activaciones: OFF' (debe cambiar a ON)");
console.log("4. Arrastra el archivo Excel a la zona de importación");
console.log("5. Verifica los metadatos (BAN, Vendedor, Empresa)");
console.log("6. Importa las activaciones");
