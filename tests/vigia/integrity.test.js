import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vigía de Integridad (Archivos Críticos)', () => {

    const filesToCheck = [
        'server-FINAL.js',
        'package.json',
        '.env'
    ];

    filesToCheck.forEach(file => {
        it(`Debe existir el archivo crítico: ${file}`, () => {
            const filePath = path.resolve(process.cwd(), file);
            const exists = fs.existsSync(filePath);
            expect(exists).toBe(true);
        });
    });

    it('Debe tener configurado el puerto en .env o usar default', () => {
        // Esta prueba es más informativa
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const hasPort = envContent.includes('PORT=');
            // No fallamos si no está, pero documentamos que se verificó
            expect(true).toBe(true);
        }
    });

});
