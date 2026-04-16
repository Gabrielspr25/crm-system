import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as campaignController from '../controllers/campaignController.js';

const router = express.Router();

// Configurar multer para uploads temporales
const uploadDir = path.join(process.cwd(), 'uploads', 'campaign-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Crear nueva campaña
router.post('/', campaignController.createCampaign);

// Listar todas las campañas
router.get('/', campaignController.getCampaigns);

// Obtener detalles de una campaña
router.get('/:id', campaignController.getCampaignDetails);

// Subir attachments
router.post('/:id/attachments', upload.array('attachments', 10), campaignController.uploadAttachments);

// Descargar attachment
router.get('/attachments/:attachmentId/download', campaignController.downloadAttachment);

// Iniciar envío de campaña
router.post('/:id/send', campaignController.sendCampaign);

// Eliminar campaña (solo draft)
router.delete('/:id', campaignController.deleteCampaign);

export default router;
