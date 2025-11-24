
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';

const filePath = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';

if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}

const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });

const headers = data[0];
console.log('Headers:', headers);

// Identify columns
const nameIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('nombre'));
const businessIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('razon social'));
const banIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('ban'));
const baseIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('base'));

console.log('Indices:', { nameIdx, businessIdx, banIdx, baseIdx });

let targetRows = [];
let baseValues = {};

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const name = nameIdx >= 0 ? row[nameIdx] : '';
  const business = businessIdx >= 0 ? row[businessIdx] : '';
  const ban = banIdx >= 0 ? row[banIdx] : '';
  const base = baseIdx >= 0 ? row[baseIdx] : '';
  
  const hasName = (name && name.toString().trim()) || (business && business.toString().trim());
  const hasBan = ban && ban.toString().trim();

  // Buscamos las filas que tienen BAN pero NO tienen nombre
  if (!hasName && hasBan) {
    const sub = row[1]; // SUB column
    const hasSub = sub && sub.toString().trim();
    
    targetRows.push({ 
        row: i + 1, 
        hasSub: !!hasSub,
        sub: sub
    });
  }
}

const rowsWithSub = targetRows.filter(r => r.hasSub).length;
console.log('Total filas con BAN pero SIN Nombre:', targetRows.length);
console.log('De estas, cuántas tienen SUSCRIPTOR (Columna B):', rowsWithSub);
console.log('Ejemplos de Suscriptores:', targetRows.slice(0, 5).map(r => r.sub));
