-- Migración 11: Sistema de Campañas de Email
-- Fecha: 2026-02-07
-- Descripción: Tablas para gestión de campañas masivas con tracking

-- Tabla principal de campañas
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, sending, completed, failed
    sender_id UUID REFERENCES users_auth(id) ON DELETE SET NULL,
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    opened_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de destinatarios por campaña
CREATE TABLE IF NOT EXISTS email_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'queued', -- queued, sending, sent, opened, clicked, failed, bounced
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    failed_reason TEXT,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de adjuntos de campaña
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de eventos de tracking
CREATE TABLE IF NOT EXISTS email_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES email_recipients(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- open, click
    link_url TEXT,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_sender ON email_campaigns(sender_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON email_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON email_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON email_recipients(status);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON email_recipients(email);
CREATE INDEX IF NOT EXISTS idx_recipients_client ON email_recipients(client_id);

CREATE INDEX IF NOT EXISTS idx_attachments_campaign ON email_attachments(campaign_id);

CREATE INDEX IF NOT EXISTS idx_tracking_recipient ON email_tracking_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tracking_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON email_tracking_events(created_at DESC);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-actualizar updated_at
CREATE TRIGGER trigger_update_email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_email_campaigns_updated_at();

COMMENT ON TABLE email_campaigns IS 'Campañas de email marketing/comunicaciones masivas';
COMMENT ON TABLE email_recipients IS 'Destinatarios individuales de cada campaña con tracking';
COMMENT ON TABLE email_attachments IS 'Archivos adjuntos (PDF, imágenes, etc) asociados a campañas';
COMMENT ON TABLE email_tracking_events IS 'Eventos de apertura y clicks para analytics';
