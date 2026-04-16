import { query } from '../database/db.js';
import { serverError, notFound, badRequest } from '../middlewares/errorHandler.js';

/**
 * GET /api/sales-history?client_id=X
 * Obtiene el historial de ventas de un cliente específico
 */
export const getSalesHistory = async (req, res) => {
    const { client_id } = req.query;
    const role = String(req.user?.role || '').trim().toLowerCase();
    const salespersonId = req.user?.salespersonId == null ? '' : String(req.user.salespersonId).trim();

    if (!client_id) {
        return badRequest(res, 'client_id es requerido');
    }

    try {
        if (role === 'vendedor' && !salespersonId) {
            return res.json([]);
        }

        const params = [client_id];
        const vendorScope = role === 'vendedor'
            ? `AND (sh.salesperson_id::text = $2 OR c.salesperson_id::text = $2)`
            : '';

        if (vendorScope) {
            params.push(salespersonId);
        }

        const sql = `
            SELECT 
                sh.id,
                sh.client_id,
                sh.prospect_id,
                sh.subscriber_id,
                sh.company_name,
                sh.vendor_id,
                v.name as vendor_name,
                sh.salesperson_id,
                sp.name as salesperson_name,
                sh.total_amount,
                sh.monthly_value,
                sh.fijo_ren,
                sh.fijo_new,
                sh.movil_nueva,
                sh.movil_renovacion,
                sh.claro_tv,
                sh.cloud,
                sh.mpls,
                sh.sale_date,
                sh.notes,
                sh.created_at,
                sh.updated_at
            FROM sales_history sh
            LEFT JOIN clients c ON c.id = sh.client_id
            LEFT JOIN vendors v ON sh.vendor_id = v.id
            LEFT JOIN salespeople sp ON sh.salesperson_id = sp.id
            WHERE sh.client_id = $1
              ${vendorScope}
            ORDER BY sh.sale_date DESC, sh.created_at DESC
        `;

        const results = await query(sql, params);
        res.json(results);
    } catch (error) {
        serverError(res, error, 'Error obteniendo historial de ventas');
    }
};

/**
 * POST /api/sales-history
 * Crea un nuevo registro en el historial de ventas
 * Body: { client_id, subscriber_id, company_name, salesperson_id, monthly_value, sale_date, ... }
 */
export const createSalesHistory = async (req, res) => {
    const {
        client_id,
        subscriber_id = null,
        prospect_id = null,
        company_name,
        vendor_id = null,
        salesperson_id = null,
        total_amount = 0,
        monthly_value = 0,
        fijo_ren = 0,
        fijo_new = 0,
        movil_nueva = 0,
        movil_renovacion = 0,
        claro_tv = 0,
        cloud = 0,
        mpls = 0,
        sale_date,
        notes = null
    } = req.body;

    if (!client_id || !company_name || !sale_date) {
        return badRequest(res, 'client_id, company_name y sale_date son requeridos');
    }

    try {
        const sql = `
            INSERT INTO sales_history (
                client_id, prospect_id, subscriber_id, company_name,
                vendor_id, salesperson_id, total_amount, monthly_value,
                fijo_ren, fijo_new, movil_nueva, movil_renovacion,
                claro_tv, cloud, mpls, sale_date, notes,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
            )
            RETURNING *
        `;

        const values = [
            client_id, prospect_id, subscriber_id, company_name,
            vendor_id, salesperson_id, total_amount, monthly_value,
            fijo_ren, fijo_new, movil_nueva, movil_renovacion,
            claro_tv, cloud, mpls, sale_date, notes
        ];

        const result = await query(sql, values);

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando registro de historial de ventas');
    }
};

/**
 * POST /api/sales-history/sync-from-reports
 * Sincroniza historial desde subscriber_reports (ventas completadas)
 * Busca subscribers con follow_up_prospects completados y crea registros en sales_history si no existen
 */
export const syncFromReports = async (req, res) => {
    try {
        // Buscar todos los subscribers con follow_up_prospects completados que aún no están en sales_history
        const sql = `
            SELECT 
                s.id as subscriber_id,
                c.id as client_id,
                c.name as company_name,
                c.salesperson_id,
                vsm.vendor_id,
                s.monthly_value,
                b.ban_number,
                fup.id as prospect_id,
                fup.completed_date,
                s.line_type,
                s.plan,
                s.claro_tv,
                s.cloud,
                s.mpls
            FROM subscribers s
            INNER JOIN bans b ON s.ban_id = b.id
            INNER JOIN clients c ON b.client_id = c.id
            LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
            LEFT JOIN vendor_salesperson_mapping vsm ON sp.id = vsm.salesperson_id
            INNER JOIN LATERAL (
                SELECT fup.id, fup.completed_date
                FROM follow_up_prospects fup
                WHERE fup.client_id = c.id AND fup.completed_date IS NOT NULL
                ORDER BY fup.completed_date DESC
                LIMIT 1
            ) fup ON true
            WHERE NOT EXISTS (
                SELECT 1 FROM sales_history sh 
                WHERE sh.subscriber_id = s.id
                  AND sh.client_id = c.id
                  AND sh.prospect_id = fup.id
            )
            ORDER BY fup.completed_date DESC
        `;

        const subscribers = await query(sql, []);

        if (subscribers.length === 0) {
            return res.json({
                message: 'No hay nuevas ventas para sincronizar',
                synced: 0
            });
        }

        // Mapeo de tipos de producto a columnas materializadas
        const PRODUCT_TYPE_MAP = {
            'FIJO_REN': 'fijo_ren',
            'FIJO_NEW': 'fijo_new',
            'MOVIL_NUEVA': 'movil_nueva',
            'MOVIL_RENOVACION': 'movil_renovacion',
            'CLARO_TV': 'claro_tv',
            'CLOUD': 'cloud',
            'MPLS': 'mpls',
        };

        let synced = 0;
        let unmappedTypes = [];
        for (const sub of subscribers) {
            // Determinar tipo de producto
            let productType = null;
            let productValue = sub.monthly_value || 0;
            let productCol = null;

            // Mapeo estricto para productos legacy y nuevos
            const productTypeRaw = (sub.product_type || sub.plan || '').toUpperCase();
            if (productTypeRaw === 'PYMES UPDATE REN' || productTypeRaw === 'PYMES FIJO REN') {
                productType = 'FIJO_REN';
            } else if (productTypeRaw === 'PYMES UPDATE NEW' || productTypeRaw === 'PYMES FIJO NEW') {
                productType = 'FIJO_NEW';
            } else if (productTypeRaw === 'PYMES MPLS') {
                productType = 'MPLS';
                productValue = sub.monthly_value || 0;
            } else if (productTypeRaw === 'PYMES CLAROTV') {
                productType = 'CLARO_TV';
                productValue = sub.monthly_value || 0;
            } else if (sub.claro_tv) {
                productType = 'CLARO_TV';
                productValue = sub.claro_tv;
            } else if (sub.cloud) {
                productType = 'CLOUD';
                productValue = sub.cloud;
            } else if (sub.mpls) {
                productType = 'MPLS';
                productValue = sub.mpls;
            }

            if (productType && PRODUCT_TYPE_MAP[productType]) {
                productCol = PRODUCT_TYPE_MAP[productType];
            } else {
                unmappedTypes.push({
                    subscriber_id: sub.subscriber_id,
                    line_type: sub.line_type,
                    plan: sub.plan,
                    claro_tv: sub.claro_tv,
                    cloud: sub.cloud,
                    mpls: sub.mpls
                });
            }

            // Construir columnas dinámicamente
            const insertCols = [
                'client_id', 'prospect_id', 'subscriber_id', 'company_name',
                'vendor_id', 'salesperson_id', 'total_amount', 'monthly_value',
                'sale_date', 'notes', 'created_at', 'updated_at'
            ];
            const insertVals = [
                sub.client_id,
                sub.prospect_id,
                sub.subscriber_id,
                sub.company_name,
                sub.vendor_id,
                sub.salesperson_id,
                productValue,
                productValue,
                sub.completed_date,
                `Sincronizado automáticamente desde reportes. BAN: ${sub.ban_number || 'N/A'}`,
                new Date(),
                new Date()
            ];
            let colIdx = insertCols.length;
            let valPlaceholders = insertVals.map((_, i) => `$${i + 1}`);

            // Agregar columna de producto si mapeada
            if (productCol) {
                insertCols.push(productCol);
                insertVals.push(productValue);
                valPlaceholders.push(`$${insertVals.length}`);
            }

            const insertSql = `
                INSERT INTO sales_history (
                    ${insertCols.join(', ')}
                ) VALUES (
                    ${valPlaceholders.join(', ')}
                )
            `;

            await query(insertSql, insertVals);
            synced++;
        }

        res.json({
            message: `${synced} ventas sincronizadas exitosamente`,
            synced,
            total_found: subscribers.length,
            unmappedTypes: unmappedTypes.slice(0, 10),
            unmappedCount: unmappedTypes.length
        });
    } catch (error) {
        serverError(res, error, 'Error sincronizando historial desde reportes');
    }
};
