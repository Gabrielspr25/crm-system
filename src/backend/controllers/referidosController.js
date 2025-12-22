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
