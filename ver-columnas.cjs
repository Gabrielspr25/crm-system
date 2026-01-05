const XLSX = require('xlsx');

const wb = XLSX.readFile('elementos_extra/excels/final UNIFICADO_CLIENTES_HERNAN.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header: 1});

console.log('COLUMNAS DEL EXCEL:');
data[0].forEach((col, i) => {
    console.log(`  [${i}] ${col}`);
});

console.log('\nMUESTRA FILA 2:');
data[1].forEach((val, i) => {
    console.log(`  [${i}] "${val}"`);
});
