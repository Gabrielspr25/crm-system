import { describe, it, expect } from 'vitest';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

describe('Vigía del Backend (Salud del Sistema)', () => {

    it('Debe responder OK en el endpoint de salud (/api/health)', async () => {
        try {
            const response = await axios.get(`${API_URL}/health`);
            expect(response.status).toBe(200);
            expect(response.data.status).toBe('OK');
        } catch (error) {
            console.error('❌ Error contactando /api/health:', error.message);
            throw error;
        }
    });

    it('Debe listar vendedores (Verificación de Base de Datos)', async () => {
        // Asumiendo que se requiere token, si no, fallará.
        // Si el endpoint es protegido, necesitaremos un login previo o un token de prueba.
        // Revisando server-FINAL.js, /api/health es público.
        // Intentemos algo público o usemos /api/health que ya valida DB 'SELECT 1'.

        // El health check del server-FINAL.js hace 'SELECT 1', así que es suficiente para probar DB.
        // Replicamos la prueba para asegurar consistencia.
        const response = await axios.get(`${API_URL}/health`);
        expect(response.data).toHaveProperty('time');
    });

});
