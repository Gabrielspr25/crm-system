
import { getClient } from '../database/db.js';

// ==========================================
// CATEGORIES
// ==========================================
export const getCategories = async (req, res) => {
    const client = await getClient();
    try {
        const result = await client.query('SELECT * FROM plan_categories ORDER BY display_order ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// ==========================================
// PLANS (CRUD)
// ==========================================
export const getPlans = async (req, res) => {
    const client = await getClient();
    try {
        // Obtenemos planes y sus tablas técnicas si las hubiera disociadas, 
        // pero por ahora asumimos estructura plana en 'plans' o JSON en 'specs'
        // La tabla 'plans' tiene columnas específicas.

        const result = await client.query(`
            SELECT p.*, c.code as category_code, c.name as category_name 
            FROM plans p
            JOIN plan_categories c ON p.category_id = c.id
            WHERE p.is_active = true
            ORDER BY p.display_order ASC
        `);

        // Formatear para que coincida con el frontend si es necesario
        // Frontend espera: { id, title, category, tables: [], ... }
        // La tabla SQL tiene columnas planas. Haremos un mapeo básico.

        const mappedPlans = result.rows.map(row => ({
            id: row.id,
            title: row.name,
            category: row.category_code, // 'MOVIL', 'INTERNET', etc.
            description: row.description,
            price: row.price,
            specs: {
                voice: row.voice_included,
                data: row.data_included,
                sms: row.sms_included,
                technology: row.technology
            },
            // Estructura Legacy del frontend espera 'tables'. 
            // Si migramos a SQL completo, esto debería venir de otra tabla 'plan_tables' 
            // o guardarse como JSON. Por simplicidad en MVP, si existe col 'notes' la usaremos.
            tables: [],
            isSpecialOffer: false // Por defecto
        }));

        res.json(mappedPlans);
    } catch (error) {
        console.error('Error getting plans:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

export const createPlan = async (req, res) => {
    const client = await getClient();
    try {
        const { title, category, description, price, specs } = req.body;

        // 1. Buscar ID de categoría
        const catRes = await client.query('SELECT id FROM plan_categories WHERE code = $1', [category]);
        if (catRes.rowCount === 0) return res.status(400).json({ error: 'Categoría inválida' });
        const categoryId = catRes.rows[0].id;

        const result = await client.query(`
            INSERT INTO plans (
                name, category_id, description, price, 
                voice_included, data_included, sms_included, technology
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, name
        `, [
            title, categoryId, description, price,
            specs?.voice, specs?.data, specs?.sms, specs?.technology
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating plan:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

export const updatePlan = async (req, res) => {
    const client = await getClient();
    const { id } = req.params;
    try {
        const { title, description, price, specs } = req.body;

        const result = await client.query(`
            UPDATE plans SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                price = COALESCE($3, price),
                voice_included = COALESCE($4, voice_included),
                data_included = COALESCE($5, data_included),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [title, description, price, specs?.voice, specs?.data, id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Plan no encontrado' });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating plan:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

export const deletePlan = async (req, res) => {
    const client = await getClient();
    const { id } = req.params;
    try {
        // Soft delete
        const result = await client.query('UPDATE plans SET is_active = false WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Plan no encontrado' });
        res.json({ message: 'Plan eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting plan:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};
