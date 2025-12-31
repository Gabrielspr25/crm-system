
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';

const filePath = 'TABLA DE ACTIVACIONES (005).xlsx';

if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}

const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
// Use header: 1 to get array of arrays
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log("--- First 10 Rows ---");
for (let i = 0; i < 10; i++) {
    console.log(`Row ${i+1} (Index ${i}):`, JSON.stringify(data[i]));
}

console.log("\n--- Specific Cells ---");
// Row 3 (Index 2)
console.log("Row 3 (Index 2):", data[2]);
// Row 5 (Index 4)
console.log("Row 5 (Index 4):", data[4]);
// Row 7 (Index 6)
console.log("Row 7 (Index 6):", data[6]);

console.log("\n--- Cell Values ---");
console.log("C3 (Row 3, Col 3):", data[2] ? data[2][2] : "undefined");
console.log("D3 (Row 3, Col 4):", data[2] ? data[2][3] : "undefined");
console.log("E3 (Row 3, Col 5):", data[2] ? data[2][4] : "undefined");

console.log("C5 (Row 5, Col 3):", data[4] ? data[4][2] : "undefined");
console.log("D5 (Row 5, Col 4):", data[4] ? data[4][3] : "undefined");
console.log("E5 (Row 5, Col 5):", data[4] ? data[4][4] : "undefined");
