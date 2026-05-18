/**
 * Seed: Metas de Negocio — Abril 2026
 * Ejecutar con: node src/backend/scripts/seed-business-goals-2026-04.js
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://gabriel:control360@localhost:5432/cuartel',
});

// UUIDs de productos según goalsController.js + products table
// Para MPLS se busca dinámicamente por nombre
const GOALS = [
  { name: 'Fijo New',   product_id: '3d755ef6-a81b-490e-a79f-b5c8b843481e', amount: 1000 },
  { name: 'Fijo Ren',   product_id: '24f824d6-c71c-4e2c-8207-955081aa42f4', amount: 3000 },
  { name: 'Movil New',  product_id: '69819de8-53ba-4553-8a1a-01c2b24f1f42', amount: 60   },
  { name: 'Movil Ren',  product_id: '68a2aad0-ee4b-41bc-abfa-eac7a5e40099', amount: 100  },
  { name: 'Claro TV',   product_id: 'cc180630-5eba-4070-a201-6f8ce644bcf1', amount: 10   },
  // MPLS — se busca por nombre a continuación
];

const PERIOD_YEAR  = 2026;
const PERIOD_MONTH = 4;

async function run() {
  const client = await pool.connect();
  try {
    // Crear tabla si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_goals (
        id            BIGSERIAL PRIMARY KEY,
        product_id    TEXT        NOT NULL,
        period_year   INT         NOT NULL,
        period_month  INT         NOT NULL,
        target_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
        CONSTRAINT business_goals_unique UNIQUE (product_id, period_year, period_month)
      )
    `);
    console.log('✅ Tabla business_goals lista');

    // Buscar UUID de MPLS en products
    const mplsRow = await client.query(
      `SELECT id::text FROM products WHERE UPPER(TRIM(name)) LIKE '%MPLS%' LIMIT 1`
    );
    if (mplsRow.rows.length > 0) {
      GOALS.push({ name: 'MPLS', product_id: mplsRow.rows[0].id, amount: 2000 });
      console.log(`✅ MPLS encontrado con ID: ${mplsRow.rows[0].id}`);
    } else {
      console.warn('⚠️  MPLS no encontrado en tabla products — se omite');
    }

    // Insertar / actualizar cada meta
    for (const g of GOALS) {
      await client.query(`
        INSERT INTO business_goals (product_id, period_year, period_month, target_amount, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (product_id, period_year, period_month)
        DO UPDATE SET target_amount = EXCLUDED.target_amount, updated_at = NOW()
      `, [g.product_id, PERIOD_YEAR, PERIOD_MONTH, g.amount]);
      console.log(`  ✅ ${g.name.padEnd(12)} $${g.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    }

    // Verificar
    const check = await client.query(`
      SELECT bg.product_id, p.name AS product_name, bg.target_amount
        FROM business_goals bg
        LEFT JOIN products p ON p.id::text = bg.product_id
       WHERE bg.period_year=$1 AND bg.period_month=$2
       ORDER BY p.name
    `, [PERIOD_YEAR, PERIOD_MONTH]);

    console.log('\n📊 Metas guardadas en BD:');
    check.rows.forEach(r => {
      console.log(`  ${(r.product_name || r.product_id).padEnd(20)} $${Number(r.target_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    });

    console.log('\n✅ Seed completado correctamente.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
