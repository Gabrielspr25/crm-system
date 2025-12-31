const xlsx = require('xlsx');

const wb = xlsx.readFile('./elementos_extra/excels/LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx');

const sheet = wb.Sheets['Table 1'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

console.log('📊 ANÁLISIS COMPLETO DEL EXCEL DE PLANES');
console.log('Total filas:', data.length);
console.log('\n');

// Mostrar todas las filas relevantes
data.forEach((row, i) => {
  if (row && row.length > 0) {
    const cells = row.slice(0, 10).map(c => c !== undefined ? String(c).trim() : '');
    const nonEmpty = cells.filter(c => c !== '');
    
    if (nonEmpty.length > 0) {
      // Es un título de sección?
      const text = cells.join(' ');
      if (text.includes('Planes ') || text.includes('PLAY') || text.includes('Play') || 
          text.includes('TV') || text.includes('Claro') || text.includes('Código') ||
          text.includes('COBRE') || text.includes('GPON') || text.includes('LISTADO') ||
          text.includes('Complemento') || text.includes('Lineas Adicionales')) {
        console.log(`\n[${i}] ===== ${text.substring(0, 80)} =====`);
      }
    }
  }
});
