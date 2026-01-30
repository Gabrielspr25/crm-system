
import XLSX from 'xlsx';

function inspectExcel(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        console.log('Sheets:', workbook.SheetNames);

        workbook.SheetNames.forEach(name => {
            console.log(`\n--- Inspecting Sheet: ${name} ---`);
            const worksheet = workbook.Sheets[name];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
                console.log(`Row ${i}:`, JSON.stringify(jsonData[i]));
            }
        });
    } catch (error) {
        console.error('Error inspecting excel:', error);
    }
}

const filePath = 'c:\\Users\\Gabriel\\Documentos\\Programas\\VentasProui\\DOCUMENTACION-PROFESOR\\Copia de COM-001-001-D.xlsx';
inspectExcel(filePath);
