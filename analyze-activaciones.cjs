
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Copia de TABLA DE ACTIVACIONES (005).xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get headers (first row)
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (jsonData.length === 0) {
        console.log("El archivo está vacío.");
        process.exit(0);
    }

    const headers = jsonData[0];
    console.log("=== HEADERS ===");
    console.log(headers);
    
    console.log("\n=== TODAS LAS FILAS ===");
    // Print all rows
    for (let i = 0; i < jsonData.length; i++) {
        console.log(`Fila ${i}:`, jsonData[i]);
    }

    console.log(`\nTotal de filas: ${jsonData.length}`);

} catch (error) {
    console.error("Error leyendo el archivo:", error.message);
}
