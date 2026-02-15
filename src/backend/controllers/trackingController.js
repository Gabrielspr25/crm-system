import { query, pool } from '../database/db.js';

// ==========================================
// TRACKING PIXEL (Apertura de email)
// ==========================================
export async function trackPixel(req, res) {
  const { recipientId } = req.params;

  try {
    // Verificar si ya fue registrado como abierto
    const recipientResult = await pool.query(
      `SELECT id, status, campaign_id FROM email_recipients WHERE id = $1`,
      [recipientId]
    );

    if (recipientResult.rows.length === 0) {
      // Retornar pixel transparente aunque no exista el recipient
      return sendTransparentPixel(res);
    }

    const recipient = recipientResult.rows[0];

    // Solo marcar como abierto si status es 'sent' (primera vez)
    if (recipient.status === 'sent') {
      await pool.query(
        `UPDATE email_recipients 
         SET status = 'opened', opened_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [recipientId]
      );

      // Actualizar contador en campaña
      await pool.query(
        `UPDATE email_campaigns 
         SET opened_count = opened_count + 1
         WHERE id = $1`,
        [recipient.campaign_id]
      );
    }

    // Registrar evento (incluso si ya había sido abierto)
    await pool.query(
      `INSERT INTO email_tracking_events (recipient_id, event_type, user_agent, ip_address)
       VALUES ($1, 'open', $2, $3)`,
      [
        recipientId,
        req.headers['user-agent'] || 'Unknown',
        req.ip || req.connection.remoteAddress
      ]
    );

    // Retornar pixel transparente 1x1
    sendTransparentPixel(res);

  } catch (error) {
    console.error('Error tracking pixel:', error);
    sendTransparentPixel(res);
  }
}

// ==========================================
// TRACKING CLICK (Clicks en links)
// ==========================================
export async function trackClick(req, res) {
  const { recipientId } = req.params;
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL no proporcionada' });
  }

  try {
    // Obtener recipient
    const recipientResult = await pool.query(
      `SELECT id, status, campaign_id FROM email_recipients WHERE id = $1`,
      [recipientId]
    );

    if (recipientResult.rows.length > 0) {
      const recipient = recipientResult.rows[0];

      // Actualizar status a 'clicked' si aún no lo estaba
      if (recipient.status === 'sent' || recipient.status === 'opened') {
        await pool.query(
          `UPDATE email_recipients 
           SET status = 'clicked', clicked_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [recipientId]
        );

        // Actualizar contador en campaña (solo la primera vez)
        if (recipient.status !== 'clicked') {
          await pool.query(
            `UPDATE email_campaigns 
             SET clicked_count = clicked_count + 1
             WHERE id = $1`,
            [recipient.campaign_id]
          );
        }
      }

      // Registrar evento de click
      await pool.query(
        `INSERT INTO email_tracking_events (recipient_id, event_type, link_url, user_agent, ip_address)
         VALUES ($1, 'click', $2, $3, $4)`,
        [
          recipientId,
          url,
          req.headers['user-agent'] || 'Unknown',
          req.ip || req.connection.remoteAddress
        ]
      );
    }

    // Redirigir al URL original
    res.redirect(url);

  } catch (error) {
    console.error('Error tracking click:', error);
    // Redirigir aunque haya error
    res.redirect(url);
  }
}

// Helper: Enviar pixel transparente 1x1
function sendTransparentPixel(res) {
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache'
  });

  res.send(pixel);
}
