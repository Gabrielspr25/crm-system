
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';

const filePath = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';
const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Searching for "dispon" in the entire file...');

let foundCount = 0;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const rowStr = JSON.stringify(row).toLowerCase();
  if (rowStr.includes('dispon')) {
    console.log(`Row ${i+1}:`, row);
    foundCount++;
    if (foundCount >= 5) break;
  }
}

if (foundCount === 0) {
  console.log('No "dispon" found anywhere.');
}
