import { query, pool } from '../database/db.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CREATE CAMPAIGN
// ==========================================
export async function createCampaign(req, res) {
  const { name, subject, body_html, client_ids, scheduled_at } = req.body;
  const sender_id = req.user.id;

  if (!name || !subject || !body_html || !client_ids || client_ids.length === 0) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear campaña
    const campaignResult = await client.query(
      `INSERT INTO email_campaigns (name, subject, body_html, sender_id, total_recipients, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, subject, body_html, sender_id, client_ids.length, scheduled_at || null, scheduled_at ? 'scheduled' : 'draft']
    );

    const campaign = campaignResult.rows[0];

    // Obtener datos de clientes seleccionados
    const clientsResult = await client.query(
      `SELECT id, name, email, contact_person FROM clients WHERE id = ANY($1::uuid[])`,
      [client_ids]
    );

    // Crear recipients
    const recipientInserts = clientsResult.rows
      .filter(c => c.email && c.email.trim() !== '')
      .map(c => 
        client.query(
          `INSERT INTO email_recipients (campaign_id, client_id, email, client_name, status)
           VALUES ($1, $2, $3, $4, 'queued')`,
          [campaign.id, c.id, c.email, c.contact_person || c.name]
        )
      );

    await Promise.all(recipientInserts);

    await client.query('COMMIT');

    res.json({ campaign, message: 'Campaña creada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando campaña:', error);
    res.status(500).json({ error: 'Error al crear la campaña' });
  } finally {
    client.release();
  }
}

// ==========================================
// GET ALL CAMPAIGNS
// ==========================================
export async function getCampaigns(req, res) {
  try {
    const result = await pool.query(
      `SELECT 
        c.*,
        s.name as sender_name,
        s.email as sender_email
       FROM email_campaigns c
       LEFT JOIN users_auth u ON c.sender_id = u.id
       LEFT JOIN salespeople s ON u.salesperson_id = s.id
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo campañas:', error);
    res.status(500).json({ error: 'Error al obtener campañas' });
  }
}

// ==========================================
// GET CAMPAIGN DETAILS
// ==========================================
export async function getCampaignDetails(req, res) {
  const { id } = req.params;

  try {
    const campaignResult = await pool.query(
      `SELECT 
        c.*,
        s.name as sender_name,
        s.email as sender_email
       FROM email_campaigns c
       LEFT JOIN users_auth u ON c.sender_id = u.id
       LEFT JOIN salespeople s ON u.salesperson_id = s.id
       WHERE c.id = $1`,
      [id]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const campaign = campaignResult.rows[0];

    // Obtener recipients con stats
    const recipientsResult = await pool.query(
      `SELECT * FROM email_recipients WHERE campaign_id = $1 ORDER BY created_at`,
      [id]
    );

    // Obtener adjuntos
    const attachmentsResult = await pool.query(
      `SELECT * FROM email_attachments WHERE campaign_id = $1`,
      [id]
    );

    // Obtener eventos de tracking recientes
    const trackingResult = await pool.query(
      `SELECT 
        te.*,
        r.email,
        r.client_name
       FROM email_tracking_events te
       JOIN email_recipients r ON te.recipient_id = r.id
       WHERE r.campaign_id = $1
       ORDER BY te.created_at DESC
       LIMIT 100`,
      [id]
    );

    res.json({
      campaign,
      recipients: recipientsResult.rows,
      attachments: attachmentsResult.rows,
      recent_events: trackingResult.rows
    });
  } catch (error) {
    console.error('Error obteniendo detalles de campaña:', error);
    res.status(500).json({ error: 'Error al obtener detalles' });
  }
}

// ==========================================
// START SENDING CAMPAIGN (MAILTO MODE)
// ==========================================
export async function sendCampaign(req, res) {
  const { id } = req.params;

  try {
    // Obtener campaña
    const campaignResult = await pool.query(
      `SELECT * FROM email_campaigns WHERE id = $1`,
      [id]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const campaign = campaignResult.rows[0];

    // Obtener destinatarios
    const recipientsResult = await pool.query(
      `SELECT email FROM email_recipients WHERE campaign_id = $1`,
      [id]
    );

    const emails = recipientsResult.rows.map(r => r.email);

    // Obtener adjuntos si existen
    const attachmentsResult = await pool.query(
      `SELECT id, filename FROM email_attachments WHERE campaign_id = $1`,
      [id]
    );

    const attachments = attachmentsResult.rows;

    // Marcar campaña como ready_to_send
    await pool.query(
      `UPDATE email_campaigns 
       SET status = 'ready_to_send', started_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    // Devolver datos para mailto:
    res.json({
      message: 'Datos de campaña preparados',
      recipients: emails,
      subject: campaign.subject,
      body: campaign.body_html,
      attachments: attachments.length > 0 ? attachments.map(a => ({
        id: a.id,
        filename: a.filename,
        downloadUrl: `/api/campaigns/attachments/${a.id}/download`
      })) : [],
      campaignId: id
    });
  } catch (error) {
    console.error('Error preparando campaña:', error);
    res.status(500).json({ error: 'Error al preparar campaña' });
  }
}

// ==========================================
// BACKGROUND EMAIL SENDING
// ==========================================
async function sendEmailsInBackground(campaignId) {
  const BATCH_SIZE = 10; // Enviar 10 por lote
  const DELAY_BETWEEN_BATCHES = 30000; // 30 segundos entre lotes

  try {
    // Obtener campaña
    const campaignResult = await pool.query(
      `SELECT * FROM email_campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) return;
    const campaign = campaignResult.rows[0];

    // Obtener adjuntos
    const attachmentsResult = await pool.query(
      `SELECT * FROM email_attachments WHERE campaign_id = $1`,
      [campaignId]
    );
    const attachments = attachmentsResult.rows;

    // Configurar transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { ciphers: 'SSLv3' }
    });

    while (true) {
      // Obtener siguiente lote de destinatarios pendientes
      const recipientsResult = await pool.query(
        `SELECT * FROM email_recipients 
         WHERE campaign_id = $1 AND status = 'queued'
         ORDER BY created_at
         LIMIT $2`,
        [campaignId, BATCH_SIZE]
      );

      if (recipientsResult.rows.length === 0) {
        // Todos enviados, marcar campaña como completada
        await pool.query(
          `UPDATE email_campaigns 
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [campaignId]
        );
        break;
      }

      // Enviar lote
      for (const recipient of recipientsResult.rows) {
        try {
          // Insertar pixel de tracking en HTML
          const trackingPixel = `<img src="${process.env.APP_URL || 'https://crmp.ss-group.cloud'}/api/tracking/pixel/${recipient.id}" width="1" height="1" style="display:none" />`;
          const htmlWithTracking = campaign.body_html + trackingPixel;

          // Procesar links para tracking
          const htmlWithLinks = processLinksForTracking(htmlWithTracking, recipient.id);

          // Preparar adjuntos
          const emailAttachments = attachments.map(att => ({
            filename: att.filename,
            path: att.file_path
          }));

          // Enviar email
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipient.email,
            subject: campaign.subject,
            html: htmlWithLinks,
            attachments: emailAttachments
          });

          // Marcar como enviado
          await pool.query(
            `UPDATE email_recipients 
             SET status = 'sent', sent_at = CURRENT_TIMESTAMP, attempts = attempts + 1
             WHERE id = $1`,
            [recipient.id]
          );

          // Actualizar contador en campaña
          await pool.query(
            `UPDATE email_campaigns 
             SET sent_count = sent_count + 1
             WHERE id = $1`,
            [campaignId]
          );

        } catch (error) {
          console.error(`Error enviando a ${recipient.email}:`, error);
          
          // Marcar como fallido
          await pool.query(
            `UPDATE email_recipients 
             SET status = 'failed', failed_reason = $1, attempts = attempts + 1
             WHERE id = $2`,
            [error.message, recipient.id]
          );

          // Actualizar contador de fallos
          await pool.query(
            `UPDATE email_campaigns 
             SET failed_count = failed_count + 1
             WHERE id = $1`,
            [campaignId]
          );
        }
      }

      // Esperar antes del siguiente lote
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }

  } catch (error) {
    console.error('Error en envío background:', error);
    await pool.query(
      `UPDATE email_campaigns 
       SET status = 'failed'
       WHERE id = $1`,
      [campaignId]
    );
  }
}

// Helper: Reemplazar links por tracking URLs
function processLinksForTracking(html, recipientId) {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
  
  return html.replace(linkRegex, (match, url) => {
    if (url.startsWith('http')) {
      const trackingUrl = `${process.env.APP_URL || 'https://crmp.ss-group.cloud'}/api/tracking/click/${recipientId}?url=${encodeURIComponent(url)}`;
      return match.replace(url, trackingUrl);
    }
    return match;
  });
}

// ==========================================
// DELETE CAMPAIGN
// ==========================================
export async function deleteCampaign(req, res) {
  const { id } = req.params;

  try {
    // Solo permitir borrar si está en draft
    const result = await pool.query(
      `DELETE FROM email_campaigns WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Solo se pueden eliminar campañas en borrador' });
    }

    res.json({ message: 'Campaña eliminada' });
  } catch (error) {
    console.error('Error eliminando campaña:', error);
    res.status(500).json({ error: 'Error al eliminar campaña' });
  }
}

// ==========================================
// UPLOAD ATTACHMENTS
// ==========================================
export async function uploadAttachments(req, res) {
  const { id } = req.params; // campaign_id
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No se enviaron archivos' });
  }

  try {
    // Usar ruta absoluta simple en /opt/crmp/uploads
    const uploadsDir = '/opt/crmp/uploads/campaign-attachments';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const attachmentInserts = files.map(file => {
      const newFilename = `${Date.now()}_${file.originalname}`;
      const filePath = path.join(uploadsDir, newFilename);
      
      // Mover archivo a directorio final
      fs.renameSync(file.path, filePath);

      return pool.query(
        `INSERT INTO email_attachments (campaign_id, filename, file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [id, file.originalname, filePath, file.size, file.mimetype]
      );
    });

    await Promise.all(attachmentInserts);

    res.json({ message: 'Archivos subidos exitosamente', count: files.length });
  } catch (error) {
    console.error('Error subiendo attachments:', error);
    res.status(500).json({ error: 'Error al subir archivos' });
  }
}

// ==========================================
// DOWNLOAD ATTACHMENT
// ==========================================
export async function downloadAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT filename, file_path, mime_type FROM email_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const attachment = result.rows[0];

    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ error: 'Archivo no existe en disco' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error descargando adjunto:', error);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
}
