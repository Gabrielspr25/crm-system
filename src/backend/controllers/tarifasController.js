import { query, getClient } from '../database/db.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');
const pdfParse = pdfParseLib.default || pdfParseLib;

// ==================== CATEGORÍAS ====================
export const getCategories = async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM plan_categories WHERE is_active = true ORDER BY display_order'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error getCategories:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== PLANES ====================
export const getPlans = async (req, res) => {
  try {
    const { category, search, active_only } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name, c.code as category_code, c.color as category_color
      FROM plans p
      LEFT JOIN plan_categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (active_only !== 'false') {
      sql += ' AND p.is_active = true';
    }
    if (category) {
      params.push(category);
      sql += ` AND c.code = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    sql += ' ORDER BY c.display_order, p.display_order, p.price';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error getPlans:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT p.*, c.name as category_name, c.code as category_code
       FROM plans p
       LEFT JOIN plan_categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error getPlanById:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const {
      category_id, name, code, alpha_code, description, price, price_autopay,
      technology, data_included, voice_included, sms_included, hotspot, roaming_info,
      installation_0m, installation_12m, installation_24m, penalty,
      min_lines, max_lines, notes, is_convergent_only, display_order
    } = req.body;

    const rows = await query(
      `INSERT INTO plans (
        category_id, name, code, alpha_code, description, price, price_autopay,
        technology, data_included, voice_included, sms_included, hotspot, roaming_info,
        installation_0m, installation_12m, installation_24m, penalty,
        min_lines, max_lines, notes, is_convergent_only, display_order, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [category_id, name, code, alpha_code, description, price, price_autopay,
        technology, data_included, voice_included, sms_included, hotspot, roaming_info,
        installation_0m, installation_12m, installation_24m, penalty,
        min_lines, max_lines, notes, is_convergent_only, display_order, req.user?.id]
    );

    // Registrar en historial
    await query(
      `INSERT INTO plan_history (table_name, record_id, action, new_values, changed_by)
       VALUES ('plans', $1, 'CREATE', $2, $3)`,
      [rows[0].id, JSON.stringify(rows[0]), req.user?.id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error createPlan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // Obtener valores anteriores
    const oldRows = await query('SELECT * FROM plans WHERE id = $1', [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const updates = [];
    const values = [];
    let paramCount = 0;

    Object.keys(fields).forEach(key => {
      if (key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(fields[key]);
      }
    });

    paramCount++;
    values.push(id);
    values.push(req.user?.id);

    const sql = `UPDATE plans SET ${updates.join(', ')}, updated_at = NOW(), updated_by = $${paramCount + 1} WHERE id = $${paramCount} RETURNING *`;

    const rows = await query(sql, values);

    // Registrar en historial
    await query(
      `INSERT INTO plan_history (table_name, record_id, action, old_values, new_values, changed_by)
       VALUES ('plans', $1, 'UPDATE', $2, $3, $4)`,
      [id, JSON.stringify(oldRows[0]), JSON.stringify(rows[0]), req.user?.id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updatePlan:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete
    await query('UPDATE plans SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);

    await query(
      `INSERT INTO plan_history (table_name, record_id, action, changed_by)
       VALUES ('plans', $1, 'DELETE', $2)`,
      [id, req.user?.id]
    );

    res.json({ message: 'Plan eliminado' });
  } catch (error) {
    console.error('Error deletePlan:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== OFERTAS ====================
export const getOffers = async (req, res) => {
  try {
    const { category, active_only, current_only } = req.query;
    let sql = `
      SELECT o.*, c.name as category_name, c.code as category_code, c.color as category_color
      FROM offers o
      LEFT JOIN plan_categories c ON o.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (active_only !== 'false') {
      sql += ' AND o.is_active = true';
    }
    if (current_only === 'true') {
      sql += ' AND o.start_date <= CURRENT_DATE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)';
    }
    if (category) {
      params.push(category);
      sql += ` AND c.code = $${params.length}`;
    }

    sql += ' ORDER BY o.start_date DESC, o.created_at DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error getOffers:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createOffer = async (req, res) => {
  try {
    const {
      title, description, category_id, offer_type, discount_type, discount_value,
      applicable_plans, conditions, start_date, end_date,
      is_convergent_only, is_new_customer_only, is_portability_only,
      bulletin_reference, attachment_url
    } = req.body;

    const rows = await query(
      `INSERT INTO offers (
        title, description, category_id, offer_type, discount_type, discount_value,
        applicable_plans, conditions, start_date, end_date,
        is_convergent_only, is_new_customer_only, is_portability_only,
        bulletin_reference, attachment_url, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [title, description, category_id, offer_type, discount_type, discount_value,
        applicable_plans, conditions, start_date, end_date,
        is_convergent_only, is_new_customer_only, is_portability_only,
        bulletin_reference, attachment_url, req.user?.id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error createOffer:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    Object.keys(fields).forEach(key => {
      if (key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(fields[key]);
      }
    });

    paramCount++;
    values.push(id);

    const sql = `UPDATE offers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const rows = await query(sql, values);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updateOffer:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE offers SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Oferta eliminada' });
  } catch (error) {
    console.error('Error deleteOffer:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== BENEFICIOS ====================
export const getBenefits = async (req, res) => {
  try {
    const { category, active_only } = req.query;
    let sql = 'SELECT * FROM benefits WHERE 1=1';
    const params = [];

    if (active_only !== 'false') {
      sql += ' AND is_active = true';
    }
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ' ORDER BY display_order, title';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error getBenefits:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createBenefit = async (req, res) => {
  try {
    const {
      title, description, benefit_type, value, value_convergent,
      category, requirements, legal_terms, start_date, end_date, display_order
    } = req.body;

    const rows = await query(
      `INSERT INTO benefits (
        title, description, benefit_type, value, value_convergent,
        category, requirements, legal_terms, start_date, end_date, display_order, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [title, description, benefit_type, value, value_convergent,
        category, requirements, legal_terms, start_date, end_date, display_order, req.user?.id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error createBenefit:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateBenefit = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    Object.keys(fields).forEach(key => {
      if (key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(fields[key]);
      }
    });

    paramCount++;
    values.push(id);

    const sql = `UPDATE benefits SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const rows = await query(sql, values);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updateBenefit:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteBenefit = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE benefits SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Beneficio eliminado' });
  } catch (error) {
    console.error('Error deleteBenefit:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GUÍAS DE VENTA ====================
export const getSalesGuides = async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM sales_guides WHERE is_active = true';
    const params = [];

    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ' ORDER BY display_order, title';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error getSalesGuides:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createSalesGuide = async (req, res) => {
  try {
    const { title, category, content, steps, attachments, tags, display_order } = req.body;

    const rows = await query(
      `INSERT INTO sales_guides (title, category, content, steps, attachments, tags, display_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [title, category, content, steps, attachments, tags, display_order, req.user?.id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error createSalesGuide:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateSalesGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    Object.keys(fields).forEach(key => {
      if (key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(fields[key]);
      }
    });

    paramCount++;
    values.push(id);

    const sql = `UPDATE sales_guides SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    const rows = await query(sql, values);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updateSalesGuide:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteSalesGuide = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE sales_guides SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Guía eliminada' });
  } catch (error) {
    console.error('Error deleteSalesGuide:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== HISTORIAL ====================
export const getPlanHistory = async (req, res) => {
  try {
    const { table_name, record_id } = req.query;
    let sql = `
      SELECT h.*, u.name as changed_by_name
      FROM plan_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (table_name) {
      params.push(table_name);
      sql += ` AND h.table_name = $${params.length}`;
    }
    if (record_id) {
      params.push(record_id);
      sql += ` AND h.record_id = $${params.length}`;
    }

    sql += ' ORDER BY h.changed_at DESC LIMIT 100';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error getPlanHistory:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== ESTADÍSTICAS ====================
export const getTarifasStats = async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        (SELECT COUNT(*) FROM plans WHERE is_active = true) as total_plans,
        (SELECT COUNT(*) FROM offers WHERE is_active = true AND start_date <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active_offers,
        (SELECT COUNT(*) FROM benefits WHERE is_active = true) as total_benefits,
        (SELECT COUNT(*) FROM sales_guides WHERE is_active = true) as total_guides
    `);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error getTarifasStats:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== PARSEO DE DOCUMENTOS (PDF/Excel) ====================
export const parseDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const extension = originalname.toLowerCase().split('.').pop();
    let plans = [];

    console.log(`Procesando archivo: ${originalname}, tipo: ${mimetype}`);

    if (extension === 'pdf') {
      plans = await parsePdfBuffer(buffer);
    } else if (['xlsx', 'xls', 'csv'].includes(extension)) {
      plans = await parseExcelBuffer(buffer, extension);
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Use PDF, XLSX, XLS o CSV.' });
    }

    console.log(`Planes encontrados: ${plans.length}`);
    res.json({
      success: true,
      fileName: originalname,
      totalPlans: plans.length,
      plans
    });
  } catch (error) {
    console.error('Error parseDocument:', error);
    res.status(500).json({ error: error.message });
  }
};

// Parser PDF usando pdf-parse (mejor para tablas)
async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;

  console.log('PDF Text Length:', text.length);
  console.log('PDF Sample:', text.substring(0, 500));

  return extractPlansFromPdfText(text);
}

// Parser Excel usando xlsx
async function parseExcelBuffer(buffer, extension) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  return extractPlansFromRows(rows);
}

// Extraer planes del texto PDF - VERSIÓN COMPLETA
function extractPlansFromPdfText(text) {
  const plans = [];
  const seenCodes = new Set();

  // Dividir por líneas y limpiar
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('Total lines:', lines.length);

  let currentCategory = '1PLAY';
  let currentTechnology = 'GPON';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar categorías por sección
    if (line.includes('1PLAY') || line.includes('1 PLAY')) currentCategory = '1PLAY';
    else if (line.includes('2PLAY') || line.includes('2 PLAY')) currentCategory = '2PLAY';
    else if (line.includes('3PLAY') || line.includes('3 PLAY')) currentCategory = '3PLAY';

    // Detectar tecnología
    if (line.includes('GPON')) currentTechnology = 'GPON';
    else if (line.includes('COBRE') || line.includes('VRAD')) currentTechnology = 'COBRE';

    // Patrón principal: Job Code al inicio de línea (A155, 7203, etc.)
    const jobCodeMatch = line.match(/^([A-Za-z]?\d{3,4}[A-Za-z]?)\s/);
    if (!jobCodeMatch) continue;

    const jobCode = jobCodeMatch[1].toUpperCase();
    if (seenCodes.has(jobCode)) continue;

    // Buscar precio en esta línea o las siguientes
    let fullText = line;
    let j = i + 1;
    while (j < lines.length && j < i + 5) {
      if (lines[j].match(/^[A-Za-z]?\d{3,4}[A-Za-z]?\s/)) break;
      fullText += ' ' + lines[j];
      j++;
    }

    // Extraer renta (precio mensual)
    const rentaMatch = fullText.match(/\$(\d+\.?\d*)/);
    const renta = rentaMatch ? parseFloat(rentaMatch[1]) : 0;

    // Extraer descripción del servicio
    let description = '';
    const descMatch = fullText.match(/(?:GPON|BUS|PYME|NEG|CLARO|TEL|INT|PR|US)[A-Z0-9\s\-\/\+\(\)]+/i);
    if (descMatch) {
      description = descMatch[0].trim();
    } else {
      // Tomar texto después del código y antes del precio
      const afterCode = fullText.substring(jobCodeMatch[0].length);
      const beforePrice = afterCode.split('$')[0];
      description = beforePrice.trim().substring(0, 100);
    }

    // Extraer Alfa Code (código corto como G-BMLADPQT, BPRU5M, etc.)
    const alfaMatch = fullText.match(/([A-Z][\-]?[A-Z0-9]{4,15})/g);
    let alfaCode = '';
    if (alfaMatch) {
      // Buscar el que parece alfa code (no el job code)
      for (const m of alfaMatch) {
        if (m !== jobCode && m.length >= 5 && m.length <= 15) {
          alfaCode = m;
          break;
        }
      }
    }

    // Extraer instalación (formato: $0.00 / $0.00 / $0.00)
    const installMatch = fullText.match(/\$(\d+\.?\d*)\s*\/\s*\$(\d+\.?\d*)\s*\/\s*\$(\d+\.?\d*)/);
    let inst0m = 0, inst12m = 0, inst24m = 0;
    if (installMatch) {
      inst0m = parseFloat(installMatch[1]) || 0;
      inst12m = parseFloat(installMatch[2]) || 0;
      inst24m = parseFloat(installMatch[3]) || 0;
    }

    // Extraer penalidad (último precio de la línea)
    const allPrices = fullText.match(/\$(\d+\.?\d*)/g);
    let penalty = 0;
    if (allPrices && allPrices.length > 1) {
      penalty = parseFloat(allPrices[allPrices.length - 1].replace('$', '')) || 0;
    }

    // Determinar categoría del plan por descripción
    let planCategory = currentCategory;
    if (description.includes('2PLAY') || description.includes('2 PLAY')) planCategory = '2PLAY';
    else if (description.includes('3PLAY') || description.includes('3 PLAY')) planCategory = '3PLAY';
    else if (description.includes('TV') || description.includes('CLARO TV')) planCategory = 'TV';
    else if (description.includes('MOVIL') || description.includes('MÓVIL')) planCategory = 'MOVIL';

    // Determinar tecnología
    let planTech = currentTechnology;
    if (description.includes('GPON') || jobCode.startsWith('A') || alfaCode.startsWith('G-')) {
      planTech = 'GPON';
    } else if (description.includes('COBRE') || description.includes('VRAD')) {
      planTech = 'COBRE';
    }

    // Extraer velocidad si está presente
    const speedMatch = description.match(/(\d+)M/);
    const speed = speedMatch ? parseInt(speedMatch[1]) : null;

    seenCodes.add(jobCode);

    plans.push({
      code: jobCode,
      description: description || `Plan ${jobCode}`,
      price: renta,
      alpha_code: alfaCode,
      category: planCategory,
      technology: planTech,
      speed_download: speed,
      speed_upload: speed ? Math.floor(speed / 10) || 1 : null,
      installation_0m: inst0m,
      installation_12m: inst12m,
      installation_24m: inst24m,
      penalty: penalty
    });
  }

  console.log(`Planes extraídos: ${plans.length}`);

  // Si no encontramos planes, intentar patrón alternativo más flexible
  if (plans.length === 0) {
    console.log('Intentando patrón alternativo...');
    const altPattern = /([A-Z]?\d{3,4})\s+\$(\d+\.?\d+)\s+([A-Z][A-Z0-9\s\-\/]+)/g;
    let match;
    while ((match = altPattern.exec(text)) !== null) {
      const code = match[1];
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);

      plans.push({
        code,
        description: match[3].trim(),
        price: parseFloat(match[2]),
        alpha_code: '',
        category: '1PLAY',
        technology: 'GENERAL',
        installation_0m: 0,
        installation_12m: 0,
        installation_24m: 0,
        penalty: 0
      });
    }
  }

  return plans;
}

// Función legacy para compatibilidad
function extractPlansFromText(text) {
  return extractPlansFromPdfText(text);
}

// Extraer planes de filas Excel
function extractPlansFromRows(rows) {
  const plans = [];
  let currentCategory = 'GENERAL';
  let currentTechnology = 'GENERAL';

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;

    const firstCell = String(row[0] || '').toUpperCase();

    // Detectar categoría
    if (firstCell.includes('MÓVIL') || firstCell.includes('MOVIL')) currentCategory = 'MOVIL';
    else if (firstCell.includes('1PLAY') || firstCell.includes('1 PLAY')) currentCategory = '1PLAY';
    else if (firstCell.includes('2PLAY') || firstCell.includes('2 PLAY')) currentCategory = '2PLAY';
    else if (firstCell.includes('3PLAY') || firstCell.includes('3 PLAY')) currentCategory = '3PLAY';
    else if (firstCell.includes('TV')) currentCategory = 'TV';

    // Detectar tecnología
    if (firstCell.includes('GPON')) currentTechnology = 'GPON';
    else if (firstCell.includes('COBRE')) currentTechnology = 'COBRE/VRAD';

    // Detectar filas de planes (código numérico o alfanumérico al inicio)
    const codePattern = /^[A-Z]?\d{3,4}[A-Z]?$/;
    if (codePattern.test(firstCell) || (row[0] && row[1] && !isNaN(parseFloat(String(row[1]).replace('$', ''))))) {
      const priceCell = row.find(cell => {
        const val = String(cell || '').replace('$', '').replace(',', '');
        return !isNaN(parseFloat(val)) && parseFloat(val) > 0;
      });

      const price = priceCell ? parseFloat(String(priceCell).replace('$', '').replace(',', '')) : 0;

      plans.push({
        code: String(row[0] || ''),
        price: price,
        description: String(row[2] || row[1] || ''),
        alpha_code: String(row[3] || ''),
        category: currentCategory,
        technology: currentTechnology,
        installation_0m: parseFloat(String(row[4] || '0').replace('$', '')) || 0,
        installation_12m: parseFloat(String(row[5] || '0').replace('$', '')) || 0,
        installation_24m: parseFloat(String(row[6] || '0').replace('$', '')) || 0,
        penalty: parseFloat(String(row[7] || '0').replace('$', '')) || 0
      });
    }
  });

  return plans;
}
