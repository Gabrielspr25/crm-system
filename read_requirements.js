
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';

const filePath = 'CAMPOS A SOLICITAR.xlsx';

if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}

const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Headers:', data[0]);
console.log('First 5 rows:');
for (let i = 1; i < Math.min(data.length, 6); i++) {
    console.log(data[i]);
}
