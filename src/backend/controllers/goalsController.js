import { query } from '../database/db.js';

// Product column mapping: product UUID → sales_history column name
const PRODUCT_COLUMN_MAP = {
  '24f824d6-c71c-4e2c-8207-955081aa42f4': 'fijo_ren',
  '3d755ef6-a81b-490e-a79f-b5c8b843481e': 'fijo_new',
  '69819de8-53ba-4553-8a1a-01c2b24f1f42': 'movil_nueva',
  '68a2aad0-ee4b-41bc-abfa-eac7a5e40099': 'movil_renovacion',
  'cc180630-5eba-4070-a201-6f8ce644bcf1': 'claro_tv',
  'a3234ba9-4651-476d-95e1-8efa89ff892b': 'cloud',
};

const PRODUCT_NAMES = {
  '24f824d6-c71c-4e2c-8207-955081aa42f4': 'Fijo Ren',
  '3d755ef6-a81b-490e-a79f-b5c8b843481e': 'Fijo New',
  '69819de8-53ba-4553-8a1a-01c2b24f1f42': 'Movil New',
  '68a2aad0-ee4b-41bc-abfa-eac7a5e40099': 'Movil Ren',
  'cc180630-5eba-4070-a201-6f8ce644bcf1': 'Claro TV',
  'a3234ba9-4651-476d-95e1-8efa89ff892b': 'Cloud',
};

const hasVendorSalespersonMappingTable = async () => {
  try {
    const rows = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_salesperson_mapping'
      ) AS exists
    `);
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
};

const getGoalsVendorQueryConfig = async (role, salespersonId, year, month) => {
  const hasMappingTable = await hasVendorSalespersonMappingTable();

  if (hasMappingTable) {
    return {
      text: `
        SELECT DISTINCT
          v.id AS vendor_id,
          v.name AS vendor_name,
          v.commission_percentage,
          COALESCE(vsm.salesperson_id, sp_fallback.id) AS salesperson_id
        FROM product_goals pg
        JOIN vendors v ON v.id = pg.vendor_id
        LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
        LEFT JOIN salespeople sp_map ON sp_map.id = vsm.salesperson_id
        LEFT JOIN salespeople sp_fallback
          ON sp_map.id IS NULL
         AND UPPER(TRIM(sp_fallback.name)) = UPPER(TRIM(v.name))
        WHERE COALESCE(v.is_active, 1) = 1
          AND pg.period_year = $1
          AND pg.period_month = $2
          AND COALESCE(pg.is_active, 1) = 1
          AND COALESCE(vsm.salesperson_id, sp_fallback.id) IS NOT NULL
          ${role === 'vendedor' ? 'AND COALESCE(vsm.salesperson_id, sp_fallback.id) = $3' : ''}
        ORDER BY v.name
      `,
      params: role === 'vendedor' ? [year, month, salespersonId] : [year, month],
    };
  }

  return {
    text: `
      SELECT DISTINCT
        v.id AS vendor_id,
        v.name AS vendor_name,
        v.commission_percentage,
        s.id AS salesperson_id
      FROM product_goals pg
      JOIN vendors v ON v.id = pg.vendor_id
      LEFT JOIN salespeople s ON UPPER(TRIM(v.name)) = UPPER(TRIM(s.name))
      WHERE COALESCE(v.is_active, 1) = 1
        AND pg.period_year = $1
        AND pg.period_month = $2
        AND COALESCE(pg.is_active, 1) = 1
        AND s.id IS NOT NULL
        ${role === 'vendedor' ? 'AND s.id = $3' : ''}
      ORDER BY v.name
    `,
    params: role === 'vendedor' ? [year, month, salespersonId] : [year, month],
  };
};

const getLatestGoalPeriodQueryConfig = async (role, salespersonId) => {
  const hasMappingTable = await hasVendorSalespersonMappingTable();

  if (hasMappingTable) {
    return {
      text: `
        SELECT
          pg.period_year,
          pg.period_month
        FROM product_goals pg
        JOIN vendors v ON v.id = pg.vendor_id
        LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
        LEFT JOIN salespeople sp_map ON sp_map.id = vsm.salesperson_id
        LEFT JOIN salespeople sp_fallback
          ON sp_map.id IS NULL
         AND UPPER(TRIM(sp_fallback.name)) = UPPER(TRIM(v.name))
        WHERE COALESCE(pg.is_active, 1) = 1
          AND COALESCE(v.is_active, 1) = 1
          AND COALESCE(vsm.salesperson_id, sp_fallback.id) IS NOT NULL
          ${role === 'vendedor' ? 'AND COALESCE(vsm.salesperson_id, sp_fallback.id) = $1' : ''}
        ORDER BY pg.period_year DESC, pg.period_month DESC
        LIMIT 1
      `,
      params: role === 'vendedor' ? [salespersonId] : [],
    };
  }

  return {
    text: `
      SELECT
        pg.period_year,
        pg.period_month
      FROM product_goals pg
      JOIN vendors v ON v.id = pg.vendor_id
      LEFT JOIN salespeople s ON UPPER(TRIM(v.name)) = UPPER(TRIM(s.name))
      WHERE COALESCE(pg.is_active, 1) = 1
        AND COALESCE(v.is_active, 1) = 1
        AND s.id IS NOT NULL
        ${role === 'vendedor' ? 'AND s.id = $1' : ''}
      ORDER BY pg.period_year DESC, pg.period_month DESC
      LIMIT 1
    `,
    params: role === 'vendedor' ? [salespersonId] : [],
  };
};

const getProductGoalsQueryConfig = async (salespersonId, year, month) => {
  const hasMappingTable = await hasVendorSalespersonMappingTable();

  if (hasMappingTable) {
    return {
      text: `
        SELECT
          pg.id,
          v.name AS vendor_name,
          p.id AS product_id,
          p.name AS product_name,
          pg.target_revenue AS target_amount,
          pg.period_year,
          pg.period_month
        FROM product_goals pg
        JOIN vendors v ON pg.vendor_id = v.id
        LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
        LEFT JOIN salespeople sp_map ON sp_map.id = vsm.salesperson_id
        LEFT JOIN salespeople sp_fallback
          ON sp_map.id IS NULL
         AND UPPER(TRIM(sp_fallback.name)) = UPPER(TRIM(v.name))
        LEFT JOIN products p ON pg.product_id::text = p.id::text
        WHERE COALESCE(vsm.salesperson_id, sp_fallback.id) = $1
          AND pg.period_year = $2
          AND pg.period_month = $3
          AND COALESCE(pg.is_active, 1) = 1
        ORDER BY p.name
      `,
      params: [salespersonId, year, month],
    };
  }

  return {
    text: `
      SELECT
        pg.id,
        v.name AS vendor_name,
        p.id AS product_id,
        p.name AS product_name,
        pg.target_revenue AS target_amount,
        pg.period_year,
        pg.period_month
      FROM product_goals pg
      JOIN vendors v ON pg.vendor_id = v.id
      LEFT JOIN salespeople s ON UPPER(TRIM(v.name)) = UPPER(TRIM(s.name))
      LEFT JOIN products p ON pg.product_id::text = p.id::text
      WHERE s.id = $1
        AND pg.period_year = $2
        AND pg.period_month = $3
        AND COALESCE(pg.is_active, 1) = 1
      ORDER BY p.name
    `,
    params: [salespersonId, year, month],
  };
};

export async function getLatestPeriod(req, res) {
  try {
    const { role, salespersonId } = req.user;
    const latestPeriodQuery = await getLatestGoalPeriodQueryConfig(role, salespersonId);
    const result = await query(latestPeriodQuery.text, latestPeriodQuery.params);
    const latest = result[0];

    if (!latest) {
      return res.json({ period: null });
    }

    return res.json({
      period: `${latest.period_year}-${String(latest.period_month).padStart(2, '0')}`,
    });
  } catch (error) {
    console.error('[goalsController] Error in getLatestPeriod:', error);
    return res.status(500).json({
      error: 'Error al obtener el último periodo con metas',
      details: error.message,
    });
  }
};

/**
 * GET /api/goals/performance
 * Calcula el rendimiento de metas vs comisiones ganadas
 * Comisiones salen de sales_history
 * Incluye desglose por producto, retención 10%, y neto
 */
export async function getPerformance(req, res) {
  try {
    const { role, salespersonId } = req.user;
    const monthParam = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);

    // 1. Obtener vendedores con metas del mes usando el mapeo real vendedor ↔ salesperson
    const vendorsQuery = await getGoalsVendorQueryConfig(role, salespersonId, year, month);
    const vendorsResult = await query(vendorsQuery.text, vendorsQuery.params);

    const performanceData = [];

    for (const vendor of vendorsResult) {
      // 2. Metas por producto para este vendedor/mes
      const goalsQuery = `
        SELECT pg.description as product_id, pg.target_revenue as target_amount
        FROM product_goals pg
        WHERE pg.vendor_id = $1
          AND pg.period_year = $2
          AND pg.period_month = $3
          AND COALESCE(pg.is_active, 1) = 1
      `;
      const goalsResult = await query(goalsQuery, [vendor.vendor_id, year, month]);
      const goalsMap = {};
      for (const g of goalsResult) {
        goalsMap[g.product_id] = parseFloat(g.target_amount || 0);
      }

      // 3. Comisiones de sales_history para este vendedor/mes
      // Nueva lógica: solo sumar columnas materializadas de sales_history, sin joins ni conteo de filas
      const commissionsQuery = `
        SELECT
          COALESCE(SUM(fijo_ren), 0) as fijo_ren,
          COALESCE(SUM(fijo_new), 0) as fijo_new,
          COALESCE(SUM(movil_nueva), 0) as movil_nueva,
          COALESCE(SUM(movil_renovacion), 0) as movil_renovacion,
          COALESCE(SUM(claro_tv), 0) as claro_tv,
          COALESCE(SUM(cloud), 0) as cloud,
          COALESCE(SUM(mpls), 0) as mpls,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COALESCE(SUM(monthly_value), 0) as monthly_value,
          COUNT(*) as sale_count
        FROM sales_history
        WHERE vendor_id = $1
          AND EXTRACT(YEAR FROM sale_date) = $2
          AND EXTRACT(MONTH FROM sale_date) = $3
      `;
      const commResult = await query(commissionsQuery, [vendor.vendor_id, year, month]);
      const comm = commResult[0] || {};

      // 4. Build product breakdown
      const products = [];
      let totalGoal = 0;
      let totalEarned = 0;

      for (const [productId, productName] of Object.entries(PRODUCT_NAMES)) {
        const colName = PRODUCT_COLUMN_MAP[productId];
        const goal = goalsMap[productId] || 0;
        const earned = parseFloat(comm[colName] || 0);
        totalGoal += goal;
        totalEarned += earned;
        products.push({
          product_id: productId,
          product_name: productName,
          goal,
          earned,
          percentage: goal > 0 ? parseFloat(((earned / goal) * 100).toFixed(1)) : 0,
        });
      }

      // Si los campos por producto están en 0 pero total_amount tiene valor,
      // usar total_amount como "earned" general
      const rawTotal = parseFloat(comm.total_amount || 0);
      if (totalEarned === 0 && rawTotal > 0) {
        totalEarned = rawTotal;
      }

      const retention = parseFloat((totalEarned * 0.10).toFixed(2));
      const net = parseFloat((totalEarned - retention).toFixed(2));
      const percentage = totalGoal > 0 ? parseFloat(((totalEarned / totalGoal) * 100).toFixed(1)) : 0;

      performanceData.push({
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_name,
        salesperson_id: vendor.salesperson_id,
        commission_percentage: parseFloat(vendor.commission_percentage || 50),
        products,
        total_goal: totalGoal,
        total_earned: totalEarned,
        retention,
        net,
        percentage,
        remaining: Math.max(0, totalGoal - totalEarned),
        sale_count: parseInt(comm.sale_count || 0),
        monthly_value: parseFloat(comm.monthly_value || 0),
        period: monthParam,
      });
    }

    // Global summary
    const summary = {
      total_goal: performanceData.reduce((s, v) => s + v.total_goal, 0),
      total_earned: performanceData.reduce((s, v) => s + v.total_earned, 0),
      total_retention: performanceData.reduce((s, v) => s + v.retention, 0),
      total_net: performanceData.reduce((s, v) => s + v.net, 0),
      total_percentage: 0,
    };
    if (summary.total_goal > 0) {
      summary.total_percentage = parseFloat(((summary.total_earned / summary.total_goal) * 100).toFixed(1));
    }

    res.json({
      period: monthParam,
      summary: role === 'admin' ? summary : null,
      vendors: performanceData,
    });

  } catch (error) {
    console.error('[goalsController] Error in getPerformance:', error);
    res.status(500).json({ 
      error: 'Error al obtener rendimiento de metas',
      details: error.message 
    });
  }
}

/**
 * GET /api/goals/products/:salespersonId
 * Obtiene el desglose de metas por producto para un vendedor específico
 */
export async function getProductGoals(req, res) {
  try {
    const { salespersonId } = req.params;
    const { role, salespersonId: userSalespersonId } = req.user;
    const monthParam = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);

    // Vendedores solo pueden ver sus propias metas
    if (role === 'vendedor' && salespersonId !== userSalespersonId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const goalsQuery = await getProductGoalsQueryConfig(salespersonId, year, month);
    const result = await query(goalsQuery.text, goalsQuery.params);

    res.json({
      period: monthParam,
      salesperson_id: salespersonId,
      goals: result.map(row => ({
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name || 'Producto desconocido',
        target_amount: parseFloat(row.target_amount || 0),
        period_year: row.period_year,
        period_month: row.period_month
      }))
    });

  } catch (error) {
    console.error('[goalsController] Error in getProductGoals:', error);
    res.status(500).json({ 
      error: 'Error al obtener metas por producto',
      details: error.message 
    });
  }
}

/**
 * GET /api/goals/by-period
 * Obtiene todas las metas de un periodo específico
 * Query params: year, month
 */
export async function getByPeriod(req, res) {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'year y month son requeridos' });
    }

    const goalsQuery = `
      SELECT
        pg.id,
        pg.vendor_id,
        pg.description as product_id,
        pg.target_revenue as target_amount,
        pg.period_year,
        pg.period_month,
        v.name as vendor_name,
        p.name as product_name
      FROM product_goals pg
      LEFT JOIN vendors v ON pg.vendor_id = v.id
      LEFT JOIN products p ON pg.description = p.id::text
      WHERE pg.period_year = $1
        AND pg.period_month = $2
        AND COALESCE(pg.is_active, 1) = 1
      ORDER BY v.name, p.name
    `;

    const result = await query(goalsQuery, [parseInt(year), parseInt(month)]);

    res.json(result.map(row => ({
      id: row.id,
      vendor_id: row.vendor_id,
      product_id: row.product_id,
      target_amount: parseFloat(row.target_amount || 0),
      period_year: row.period_year,
      period_month: row.period_month,
      vendor_name: row.vendor_name,
      product_name: row.product_name
    })));

  } catch (error) {
    console.error('[goalsController] Error in getByPeriod:', error);
    res.status(500).json({ 
      error: 'Error al obtener metas del periodo',
      details: error.message 
    });
  }
}

/**
 * POST /api/goals/save
 * Guarda o actualiza una meta individual
 * Body: { vendor_id, product_id, period_year, period_month, target_amount }
 */
export async function saveGoal(req, res) {
  try {
    const { vendor_id, product_id, period_year, period_month, target_amount } = req.body;

    if (!vendor_id || !product_id || !period_year || !period_month) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const amount = parseFloat(target_amount);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    // Convertir UUID a INTEGER usando hash
    const productIdInt = Math.abs(product_id.split('').reduce((acc, char) => 
      ((acc << 5) - acc) + char.charCodeAt(0), 0
    )) % 2147483647;

    // Si el monto es 0, eliminamos la meta
    if (amount === 0) {
      await query(`
        DELETE FROM product_goals
        WHERE vendor_id = $1
          AND product_id = $2
          AND period_year = $3
          AND period_month = $4
      `, [vendor_id, productIdInt, period_year, period_month]);

      return res.json({ success: true, message: 'Meta eliminada' });
    }

    // Upsert: insertar o actualizar
    const result = await query(`
      INSERT INTO product_goals (
        vendor_id,
        product_id,
        period_type,
        period_year,
        period_month,
        target_revenue,
        is_active,
        description,
        created_at,
        updated_at
      ) VALUES ($1, $2, 'monthly', $3, $4, $5, 1, $6, NOW(), NOW())
      ON CONFLICT (vendor_id, product_id, period_year, period_month)
      WHERE vendor_id IS NOT NULL
      DO UPDATE SET
        target_revenue = EXCLUDED.target_revenue,
        is_active = 1,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING *
    `, [vendor_id, productIdInt, period_year, period_month, amount, product_id]);

    res.json({ 
      success: true, 
      goal: result[0]
    });

  } catch (error) {
    console.error('[goalsController] Error in saveGoal:', error);
    res.status(500).json({ 
      error: 'Error al guardar meta',
      details: error.message 
    });
  }
}
