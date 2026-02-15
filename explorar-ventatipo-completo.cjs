const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function explorarVentatipo() {
  try {
    console.log('🔍 EXPLORANDO ESTRUCTURA DE ventatipo\n');

    // 1. Ver todas las columnas de ventatipo
    console.log('📋 COLUMNAS EN ventatipo:');
    const colsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ventatipo'
      ORDER BY ordinal_position
    `;
    const cols = await legacyPool.query(colsQuery);
    console.table(cols.rows);

    // 2. Listar todos los ventatipo con TODOS los campos
    console.log('\n📊 TODOS LOS VENTATIPO (con todos los campos):');
    const todosQuery = `
      SELECT * FROM ventatipo
      ORDER BY ventatipoid
    `;
    const todos = await legacyPool.query(todosQuery);
    console.log(`Total registros: ${todos.rows.length}\n`);
    
    // Mostrar los primeros 10
    console.log('Primeros 10 registros:');
    console.table(todos.rows.slice(0, 10));

    // 3. Si hay algún campo de categoría o segmento, mostrarlo
    if (todos.rows[0].categoria || todos.rows[0].segmento || todos.rows[0].tipocliente) {
      console.log('\n📊 AGRUPACIÓN POR CATEGORÍA/SEGMENTO:');
      const categoriaQuery = `
        SELECT 
          categoria,
          segmento,
          tipocliente,
          COUNT(*) as total
        FROM ventatipo
        GROUP BY categoria, segmento, tipocliente
      `;
      const categorias = await legacyPool.query(categoriaQuery);
      console.table(categorias.rows);
    }

    // 4. Listar todos con sus nombres para que el usuario identifique cuáles son PYMES
    console.log('\n📋 LISTA COMPLETA DE TIPOS (para identificar PYMES):');
    const listaQuery = `
      SELECT 
        ventatipoid,
        nombre,
        activo,
        (SELECT COUNT(*) FROM venta v WHERE v.ventatipoid = vt.ventatipoid AND v.activo = true) as ventas
      FROM ventatipo vt
      ORDER BY ventas DESC, ventatipoid
    `;
    const lista = await legacyPool.query(listaQuery);
    console.table(lista.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

explorarVentatipo();
