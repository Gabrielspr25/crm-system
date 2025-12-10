import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, '2025 1 al 17 de DICIEMBRE');
const priceListFile = path.join(folderPath, 'Lista de Precios 1ro de octubre al 31 de diciembre de 2025-PYM-CORP.xlsx');
const offersFile = path.join(folderPath, 'Tabla Ofertas Financiamiento 1ro al 17 de diciembre de 2025 - PYMES.xlsx');

function analyzeExcel(filePath, label) {
    console.log(`\n--- ANALYZING: ${label} ---`);
    try {
        const workbook = XLSX.readFile(filePath);
        console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);

        workbook.SheetNames.forEach(sheetName => {
            console.log(`\nSheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, defval: '' });
            
            // Print first 10 rows to understand structure
            data.slice(0, 10).forEach((row, index) => {
                console.log(`Row ${index}:`, JSON.stringify(row));
            });
        });
    } catch (error) {
        console.error(`Error reading ${label}:`, error.message);
    }
}

analyzeExcel(priceListFile, 'PRICE LIST');
analyzeExcel(offersFile, 'OFFERS TABLE');
