import express from 'express';
import {
  enviarClienteAPOS,
  verificarClienteExistente,
  testConexionPOS
} from '../controllers/posIntegrationController.js';

const router = express.Router();

/**
 * POST /api/pos/enviar-cliente
 * Envía un cliente del CRM al sistema POS
 */
router.post('/enviar-cliente', enviarClienteAPOS);

/**
 * POST /api/pos/verificar-cliente
 * Verifica si un cliente ya existe en el POS
 */
router.post('/verificar-cliente', verificarClienteExistente);

/**
 * GET /api/pos/test-conexion
 * Prueba la conexión con la base de datos del POS
 */
router.get('/test-conexion', testConexionPOS);

export default router;
