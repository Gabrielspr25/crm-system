
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
const nameIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('nombre'));
const businessIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('razon social'));
const banIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('ban'));

console.log('Indices:', { nameIdx, businessIdx, banIdx });

let targetRows = [];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const name = nameIdx >= 0 ? row[nameIdx] : '';
  const business = businessIdx >= 0 ? row[businessIdx] : '';
  const ban = banIdx >= 0 ? row[banIdx] : '';
  
  const hasName = (name && name.toString().trim()) || (business && business.toString().trim());
  const hasBan = ban && ban.toString().trim();

  if (!hasName && hasBan) {
    targetRows.push(ban);
  }
}

console.log(`Found ${targetRows.length} rows.`);
console.log('Sample BANs:', targetRows.slice(0, 20));

// Check if they contain digits
const validBans = targetRows.filter(b => {
    const s = String(b).trim().replace(/[^0-9]/g, '');
    return s.length > 0;
});

console.log(`Valid numeric BANs: ${validBans.length}`);
