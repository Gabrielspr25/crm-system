const xlsx = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  ssl: false
});

async function importarPlanes() {
  const client = await pool.connect();
  
  try {
    console.log('📊 IMPORTANDO PLANES DESDE EXCEL (filas 0-121)\n');
    
    const wb = xlsx.readFile('./elementos_extra/excels/LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx');
    const sheet = wb.Sheets['Table 1'];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });
    
    // Solo hasta fila 121
    const rows = data.slice(0, 122);
    
    await client.query('BEGIN');
    
    // Primero borrar datos existentes
    console.log('🗑️  Limpiando datos anteriores...');
    await client.query('DELETE FROM plans');
    await client.query('DELETE FROM plan_categories');
    
    // 1. Crear las categorías necesarias
    console.log('📁 Creando categorías...');
    const categories = [
      { code: 'MEDIDOS', name: 'Planes Medidos', description: 'Planes de telefonía medidos', color: 'orange', order: 1 },
      { code: '1PLAY', name: '1Play', description: 'Planes de voz fija (1 Play)', color: 'blue', order: 2 },
      { code: '2PLAY', name: '2Play', description: 'Planes Internet + Voz (2 Play)', color: 'cyan', order: 3 },
      { code: 'TV', name: 'Claro TV', description: 'Planes de televisión Claro TV+', color: 'pink', order: 4 },
    ];
    
    const categoryIds = {};
    for (const cat of categories) {
      const res = await client.query(
        `INSERT INTO plan_categories (name, code, description, color, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [cat.name, cat.code, cat.description, cat.color, cat.order]
      );
      categoryIds[cat.code] = res.rows[0].id;
      console.log(`  ✅ ${cat.name} (ID: ${res.rows[0].id})`);
    }
    
    // 2. Parsear y crear los planes
    console.log('\n📋 Importando planes...\n');
    
    let currentCategory = null;
    let currentTechnology = null;
    let plansInserted = 0;
    let inTVSection = false;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const cells = row.map(c => c !== undefined ? String(c).trim() : '');
      const text = cells.join(' ').toLowerCase();
      const firstCell = cells[0];
      const secondCell = cells[1];
      const thirdCell = cells[2];
      const fourthCell = cells[3];
      
      // Detectar categoría
      if (text.includes('planes medidos') && text.includes('telefonía')) {
        currentCategory = 'MEDIDOS';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: Planes Medidos`);
        continue;
      }
      if (text.includes('planes ilimitado pr') && text.includes('telefonía') && !text.includes('internet')) {
        currentCategory = '1PLAY';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: 1Play - Ilimitado PR`);
        continue;
      }
      if (text.includes('tele entry service')) {
        currentCategory = '1PLAY';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: 1Play - Tele Entry`);
        continue;
      }
      if (text.includes('remote call forward')) {
        currentCategory = '1PLAY';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: 1Play - Remote Call Forward`);
        continue;
      }
      if (text.includes('pqt ilimitado pr/us')) {
        currentCategory = '1PLAY';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: 1Play - PQT Ilimitado`);
        continue;
      }
      if ((text.includes('2 play') || text.includes('2play')) && text.includes('ilimitado')) {
        currentCategory = '2PLAY';
        currentTechnology = null;
        inTVSection = false;
        console.log(`\n📁 [${i}] CATEGORÍA: 2Play`);
        continue;
      }
      if (text.includes('lineas adicionales') && text.includes('bundle')) {
        // Líneas adicionales 2Play
        currentCategory = '2PLAY';
        console.log(`\n📁 [${i}] CATEGORÍA: 2Play - Líneas Adicionales`);
        continue;
      }
      if (text.includes('planes televisión') || (text.includes('1 play') && text.includes('tv'))) {
        currentCategory = 'TV';
        currentTechnology = null;
        inTVSection = true;
        console.log(`\n📁 [${i}] CATEGORÍA: Claro TV`);
        continue;
      }
      if (text.includes('complementos televisión')) {
        currentCategory = 'TV';
        inTVSection = true;
        console.log(`\n📁 [${i}] CATEGORÍA: Claro TV - Complementos`);
        continue;
      }
      
      // Detectar tecnología
      if (thirdCell === 'COBRE/VRAD' || firstCell === 'COBRE/VRAD') {
        currentTechnology = 'COBRE/VRAD';
        continue;
      }
      if (thirdCell === 'GPON' || firstCell === 'GPON') {
        currentTechnology = 'GPON';
        continue;
      }
      
      // Saltar filas de encabezado
      if (text.includes('código') && (text.includes('precio') || text.includes('alfa'))) {
        continue;
      }
      if (text.includes('producto tv:')) {
        continue;
      }
      
      // ---- PARSEO DE PLANES ----
      let code, name, priceStr, alphaCode, installStr;
      
      if (inTVSection) {
        // En sección TV: estructura [código, null, nombre, null, precio, null, alfa_code, ...]
        code = cells[0];
        name = cells[2];
        priceStr = cells[4];
        alphaCode = cells[6];
      } else {
        // Estructura típica: [vacío, código, vacío, nombre, vacío, precio, vacío, alfa_code, vacío, instalación]
        code = secondCell || firstCell;
        name = fourthCell || thirdCell;
        priceStr = cells[5] || cells[4];
        alphaCode = cells[7] || cells[6];
        installStr = cells[9] || cells[8];
      }
      
      // Validar que es un plan válido
      if (!code || !name || code === '' || name === '') continue;
      if (code.toLowerCase() === 'código' || name.toLowerCase().includes('código')) continue;
      if (name.length < 3) continue;
      
      // Parsear precio
      let price = null;
      if (priceStr) {
        const cleanPrice = priceStr.replace(/[^0-9.-]/g, '');
        price = parseFloat(cleanPrice);
        if (isNaN(price)) price = null;
      }
      
      // Parsear instalación
      let installation = null;
      if (installStr && installStr !== '-' && installStr !== 'OTC') {
        const cleanInstall = installStr.replace(/[^0-9.-]/g, '');
        installation = parseFloat(cleanInstall);
        if (isNaN(installation)) installation = null;
      }
      
      if (!currentCategory || !categoryIds[currentCategory]) continue;
      
      try {
        await client.query(
          `INSERT INTO plans (category_id, code, name, alpha_code, price, technology, installation_0m, is_active, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
          [categoryIds[currentCategory], code, name, alphaCode || null, price, currentTechnology, installation, plansInserted + 1]
        );
        plansInserted++;
        console.log(`  ✅ [${i}] ${code} - ${name} ($${price || 'N/A'}) [${currentTechnology || 'N/A'}]`);
      } catch (err) {
        if (!err.message.includes('duplicate')) {
          console.log(`  ⚠️ [${i}] Error: ${err.message}`);
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ IMPORTACIÓN COMPLETADA`);
    console.log(`   Categorías: ${Object.keys(categoryIds).length}`);
    console.log(`   Planes: ${plansInserted}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importarPlanes();
