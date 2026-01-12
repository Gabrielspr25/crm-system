import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';

export const getSubscribers = async (req, res) => {
    const { ban_id } = req.query;
    try {
        let sql = 'SELECT * FROM subscribers';
        const params = [];
        if (ban_id) {
            sql += ' WHERE ban_id = $1';
            params.push(ban_id);
        }
        sql += ' ORDER BY created_at DESC';

        const subscribers = await query(sql, params);
        res.json(subscribers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo suscriptores');
    }
};

export const createSubscriber = async (req, res) => {
    const {
        ban_id,
        phone,
        plan,
        monthly_value,
        remaining_payments = null,
        contract_term = null,
        contract_end_date = null
    } = req.body;

    if (!ban_id || !phone) {
        return badRequest(res, 'BAN y número de teléfono son obligatorios');
    }

    try {
        // Verificar si ya existe
        const existing = await query('SELECT id FROM subscribers WHERE phone = $1', [phone]);
        if (existing.length > 0) {
            return badRequest(res, 'El número de teléfono ya existe');
        }

        const result = await query(
            `INSERT INTO subscribers
        (ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
            [ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando suscriptor');
    }
};

export const updateSubscriber = async (req, res) => {
    const { id } = req.params;
    const {
        phone,
        plan,
        monthly_value,
        remaining_payments,
        contract_term,
        contract_end_date
    } = req.body;

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        // Convertir strings vacíos a null para permitir actualizaciones
        const cleanPlan = plan?.trim() || null;
        const cleanContractTerm = contract_term !== undefined && contract_term !== '' ? contract_term : null;
        const cleanRemainingPayments = remaining_payments !== undefined && remaining_payments !== '' ? remaining_payments : null;
        const cleanMonthlyValue = monthly_value !== undefined && monthly_value !== '' ? monthly_value : null;
        const cleanContractEndDate = contract_end_date || null;

        const result = await query(
            `UPDATE subscribers
          SET phone = COALESCE($1, phone),
              plan = $2,
              monthly_value = $3,
              remaining_payments = $4,
              contract_term = $5,
              contract_end_date = $6,
              updated_at = NOW()
        WHERE id = $7
        RETURNING *`,
            [
                phone, 
                cleanPlan, 
                cleanMonthlyValue, 
                cleanRemainingPayments, 
                cleanContractTerm, 
                cleanContractEndDate, 
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando suscriptor');
    }
};
