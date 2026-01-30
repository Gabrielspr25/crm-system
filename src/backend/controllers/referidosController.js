import { query } from '../database/db.js';

export const getReferidos = async (req, res) => {
    try {
        const rows = await query('SELECT * FROM referidos ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error getting referidos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const createReferido = async (req, res) => {
    const { nombre, email, tipo, suscriptor, modelo, color, vendedor, notas, imei, estado, fecha } = req.body;
    try {
        const sql = `
            INSERT INTO referidos (nombre, email, tipo, suscriptor, modelo, color, vendedor, notas, imei, estado, fecha)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        const values = [nombre, email, tipo || 'Masivo', suscriptor, modelo, color, vendedor, notas, imei || '', estado || 'Pendiente', fecha || new Date()];
        const rows = await query(sql, values);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating referido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const updateReferido = async (req, res) => {
    const { id } = req.params;
    const { estado, notas, imei, modelo, color, suscriptor, nombre, email, tipo, vendedor, fecha } = req.body;
    
    try {
        // Actualización flexible de campos
        const sql = `
            UPDATE referidos 
            SET estado = COALESCE($1, estado),
                notas = COALESCE($2, notas),
                imei = COALESCE($3, imei),
                modelo = COALESCE($4, modelo),
                color = COALESCE($5, color),
                suscriptor = COALESCE($6, suscriptor),
                nombre = COALESCE($7, nombre),
                email = COALESCE($8, email),
                tipo = COALESCE($9, tipo),
                vendedor = COALESCE($10, vendedor),
                fecha = COALESCE($11, fecha),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
        `;
        const values = [estado, notas, imei, modelo, color, suscriptor, nombre, email, tipo, vendedor, fecha, id];
        const rows = await query(sql, values);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Referido no encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating referido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const deleteReferido = async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM referidos WHERE id = $1', [id]);
        res.json({ message: 'Referido eliminado' });
    } catch (error) {
        console.error('Error deleting referido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Búsqueda inteligente de clientes, BANs y suscriptores
export const searchClientsBANsSubscribers = async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
        return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    
    try {
        // Buscar en clientes
        const clients = await query(`
            SELECT 
                'client' as type,
                id,
                name,
                contact_name,
                phone,
                email,
                salesperson_id
            FROM clients 
            WHERE 
                name ILIKE $1 
                OR contact_name ILIKE $1 
                OR phone ILIKE $1
            LIMIT 10
        `, [searchTerm]);

        // Buscar en BANs
        const bans = await query(`
            SELECT 
                'ban' as type,
                b.id,
                b.ban_number,
                b.address,
                c.name as client_name,
                c.id as client_id
            FROM bans b
            LEFT JOIN clients c ON b.client_id = c.id
            WHERE 
                b.ban_number ILIKE $1 
                OR b.address ILIKE $1
            LIMIT 10
        `, [searchTerm]);

        // Buscar en suscriptores
        const subscribers = await query(`
            SELECT 
                'subscriber' as type,
                s.id,
                s.phone,
                s.imei,
                b.ban_number,
                c.name as client_name,
                c.id as client_id
            FROM subscribers s
            LEFT JOIN bans b ON s.ban_id = b.id
            LEFT JOIN clients c ON b.client_id = c.id
            WHERE 
                s.phone ILIKE $1 
                OR s.imei ILIKE $1
            LIMIT 10
        `, [searchTerm]);

        // Combinar resultados
        const results = [...clients, ...bans, ...subscribers];
        res.json(results);
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
};

// Creación rápida de cliente y referido
export const createClientQuick = async (req, res) => {
    const { nombre, contacto, telefono, email, tax_id, ban_number, salesperson_id, notas } = req.body;
    
    if (!nombre || !telefono) {
        return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    try {
        // Crear cliente
        const clientResult = await query(`
            INSERT INTO clients (name, contact_name, phone, email, tax_id, salesperson_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [nombre, contacto || nombre, telefono, email, tax_id, salesperson_id]);

        const client = clientResult[0];

        // Si viene BAN, crear BAN también
        if (ban_number) {
            await query(`
                INSERT INTO bans (client_id, ban_number)
                VALUES ($1, $2)
            `, [client.id, ban_number]);
        }

        // Crear referido automáticamente
        const referidoResult = await query(`
            INSERT INTO referidos (nombre, email, tipo, suscriptor, vendedor, notas, estado, fecha)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [nombre, email, 'Cliente Nuevo', telefono, salesperson_id, notas || 'Cliente creado desde referidos', 'Pendiente', new Date()]);

        res.status(201).json({
            client,
            referido: referidoResult[0]
        });
    } catch (error) {
        console.error('Error creating quick client:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
};

