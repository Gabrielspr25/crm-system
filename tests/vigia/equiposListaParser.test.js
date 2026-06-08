import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parsearExcel } from '../../src/backend/controllers/equiposListaController.js';

const excelPath = path.resolve(
  'Planes para web',
  'Ofertas con fecha',
  'Lista de Precios 28 de mayo al 31 de julio de 2026-PYM-CORP.xlsx'
);

describe('parser de lista de precios de equipos', () => {
  test('lee el Excel real de PYMES/CORP sin perder hojas principales', () => {
    const buffer = fs.readFileSync(excelPath);
    const { items, sheetNames } = parsearExcel(buffer);

    expect(sheetNames).toContain('Finan Equipos Móvil');
    expect(sheetNames).toContain('Finan Modems- Tablets-Routers');
    expect(sheetNames).toContain('Accesorios');
    expect(items.length).toBeGreaterThan(200);
    expect(items.some((item) => item.item_code === '33750H' && item.categoria === 'celular')).toBe(true);
    expect(items.some((item) => item.item_code === '33578H' && item.categoria === 'modem')).toBe(true);
    expect(items.some((item) => item.item_code === '31298H' && item.categoria === 'accesorio')).toBe(true);
  });
});
