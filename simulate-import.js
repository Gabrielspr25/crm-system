
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';

const filePath = 'final UNIFICADO_CLIENTES_HERNAN.xlsx';
const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = utils.sheet_to_json(sheet, { header: 1, defval: '' });

const headers = data[0];
const nameIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('nombre'));
const businessIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('razon social'));
const banIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('ban'));

console.log('Indices:', { nameIdx, businessIdx, banIdx });

let omittedCount = 0;
let omittedSamples = [];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const name = nameIdx >= 0 ? row[nameIdx] : '';
  const business = businessIdx >= 0 ? row[businessIdx] : '';
  const ban = banIdx >= 0 ? row[banIdx] : '';

  // Simulate server logic
  const clientData = { name, business_name: business };
  const banData = { ban_number: ban };

  let normalizedBan = null;
  if (banData.ban_number) {
    normalizedBan = String(banData.ban_number).trim().replace(/[^0-9]/g, '').slice(0, 9);
    if (!normalizedBan || normalizedBan.length === 0) {
      normalizedBan = null;
    }
  }

  if (!normalizedBan) {
    if (!clientData.business_name && !clientData.name) {
      omittedCount++;
      if (omittedSamples.length < 5) {
        omittedSamples.push({ row: i + 1, ban, normalizedBan, name, business });
      }
    }
  }
}

console.log('Simulated Omitted Count:', omittedCount);
console.log('Samples:', omittedSamples);
