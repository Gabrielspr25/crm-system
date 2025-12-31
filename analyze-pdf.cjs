const { PdfReader } = require('pdfreader');
const fs = require('fs');

const pdfPath = 'c:\\Users\\Gabriel\\Dropbox\\Boletines Vigentes PYMES\\Fijo\\Estructura de planes\\LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.pdf';

console.log('=== ANÁLISIS COMPLETO DEL PDF ===\n');

let allText = '';
let rows = {};
let currentPage = 0;

new PdfReader().parseFileItems(pdfPath, (err, item) => {
  if (err) {
    console.error('Error:', err);
  } else if (!item) {
    // Fin del documento - procesar
    console.log('=== TEXTO COMPLETO ===\n');
    console.log(allText);
    
    // Buscar estructura de planes con patrón más preciso
    // Formato: CÓDIGO DESCRIPCIÓN PRECIO ALFA_CODE INSTALACIONES PENALIDAD
    const planPattern = /([A-Z]?\d{3,4})\s+([A-Z0-9\s\-\(\)\/]+?)\s+\$(\d+\.\d{2})\s+([A-Z0-9\-]+)\s+\$?([\d\.]+)/g;
    
    console.log('\n=== PLANES DETECTADOS ===\n');
    
    let match;
    let plans = [];
    while ((match = planPattern.exec(allText)) !== null) {
      plans.push({
        jobCode: match[1],
        description: match[2].trim(),
        price: match[3],
        alfaCode: match[4]
      });
    }
    
    // Buscar códigos tipo A### o ####
    const codePattern = /\b([A-Z]?\d{3,4})\s+([A-Z][A-Z0-9\s\-\(\)\/]{5,50})\s+\$(\d+\.\d{2})/g;
    while ((match = codePattern.exec(allText)) !== null) {
      if (!plans.find(p => p.jobCode === match[1])) {
        plans.push({
          jobCode: match[1],
          description: match[2].trim(),
          price: match[3]
        });
      }
    }
    
    console.log('Total planes encontrados:', plans.length);
    console.log('\nPrimeros 50 planes:\n');
    plans.slice(0, 50).forEach((p, i) => {
      console.log(`${i+1}. ${p.jobCode} | $${p.price} | ${p.description} | ${p.alfaCode || ''}`);
    });
    
    // Buscar secciones/títulos
    console.log('\n=== SECCIONES/TÍTULOS ===\n');
    const sections = allText.match(/[A-Z][A-Z\s]{10,50}(?=\s+0 MESES)/g) || [];
    [...new Set(sections)].forEach(s => console.log('📁', s.trim()));
    
  } else if (item.text) {
    allText += item.text + ' ';
  }
});
