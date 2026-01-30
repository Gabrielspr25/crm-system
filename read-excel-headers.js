
import XLSX from 'xlsx';

function readHeaders(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = jsonData[0];
        console.log('--- COLUMNS FOUND ---');
        console.log(JSON.stringify(headers));

        console.log('\n--- SAMPLE DATA (FIRST ROW) ---');
        console.log(JSON.stringify(jsonData[1]));
    } catch (error) {
        console.error('Error reading excel:', error);
    }
}

const filePath = 'c:\\Users\\Gabriel\\Documentos\\Programas\\VentasProui\\DOCUMENTACION-PROFESOR\\Copia de COM-001-001-D.xlsx';
readHeaders(filePath);
