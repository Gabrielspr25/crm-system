import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, '2025 1 al 17 de DICIEMBRE');
const offersFile = path.join(folderPath, 'Tabla Ofertas Financiamiento 1ro al 17 de diciembre de 2025 - PYMES.xlsx');
const outputFile = path.join(__dirname, 'src/react-app/data/plans-data.json');

// Asegurar que el directorio de salida existe
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function extractKnowledge() {
    console.log('Extrayendo conocimiento de Excel...');
    
    if (!fs.existsSync(offersFile)) {
        console.error(`Error: Archivo de entrada no encontrado en ${offersFile}`);
        return;
    }

    const workbook = XLSX.readFile(offersFile);

    // 1. Extraer Planes
    const plansSheet = workbook.Sheets['Planes de Lista'];
    const plansData = XLSX.utils.sheet_to_json(plansSheet, { header: 1, range: 1 }); // Saltar fila de título
    
    const plans = [];
    // Encontrar índice de fila de encabezado
    let headerRowIndex = -1;
    for(let i=0; i<plansData.length; i++) {
        const row = plansData[i];
        if (row.includes('Codigo') && row.includes('Renta Mensual')) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex !== -1) {
        const headers = plansData[headerRowIndex];
        const codeIdx = headers.indexOf('Codigo');
        const rentIdx = headers.indexOf('Renta Mensual');
        const descIdx = headers.indexOf('PLANES NACIONALES INDIVIDUALES'); // Or similar

        for(let i = headerRowIndex + 1; i < plansData.length; i++) {
            const row = plansData[i];
            if (!row[codeIdx] || !row[rentIdx]) continue;

            plans.push({
                code: row[codeIdx],
                price: parseFloat(row[rentIdx]),
                description: row[descIdx] || '',
                name: `Plan $${row[rentIdx]} (${row[codeIdx]})`
            });
        }
    }

    // 2. Extraer Ofertas de Equipos Gratis
    const freeOffersSheet = workbook.Sheets['Ofertas Equipos en Portafolio'];
    const freeOffersData = XLSX.utils.sheet_to_json(freeOffersSheet, { header: 1 });
    
    const freeDevices = [];
    // Lógica de extracción simple - buscar filas con "Plan de..." y nombres de equipos
    let currentPlan = '';
    
    // Encontrar fila de encabezado para ofertas
    let offerHeaderIdx = -1;
    for(let i=0; i<freeOffersData.length; i++) {
        if (freeOffersData[i].includes('PLANES QUE APLICAN') && freeOffersData[i].includes('EQUIPOS QUE APLICAN\r\n(Si alguno)')) {
            offerHeaderIdx = i;
            break;
        }
    }

    if (offerHeaderIdx !== -1) {
        const headers = freeOffersData[offerHeaderIdx];
        const planIdx = headers.indexOf('PLANES QUE APLICAN');
        const deviceIdx = headers.indexOf('EQUIPOS QUE APLICAN\r\n(Si alguno)');

        for(let i = offerHeaderIdx + 1; i < freeOffersData.length; i++) {
            const row = freeOffersData[i];
            if (!row || row.length === 0) continue;

            const planText = row[planIdx];
            const devicesText = row[deviceIdx];

            if (planText) currentPlan = planText.replace(/\r\n/g, ' ').trim();
            
            if (devicesText && currentPlan) {
                const devices = devicesText.split(/\r\n|\n/).map(d => d.trim()).filter(d => d);
                devices.forEach(device => {
                    freeDevices.push({
                        plan_requirement: currentPlan,
                        device_name: device,
                        type: 'FREE',
                        details: 'Equipo GRATIS en financiamiento'
                    });
                });
            }
        }
    }

    const knowledgeBase = {
        generated_at: new Date().toISOString(),
        source_file: 'Tabla Ofertas Financiamiento 1ro al 17 de diciembre de 2025 - PYMES.xlsx',
        plans: plans,
        offers: freeDevices
    };

    fs.writeFileSync(outputFile, JSON.stringify(knowledgeBase, null, 2));
    console.log(`Base de conocimientos guardada en ${outputFile}`);
    console.log(`Se extrajeron ${plans.length} planes y ${freeDevices.length} ofertas de equipos gratis.`);
}

extractKnowledge();
