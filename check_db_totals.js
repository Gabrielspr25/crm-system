import { query } from './src/backend/database/db.js';

console.log('🔍 Verificando totales en la base de datos...\n');

try {
  // 1. Total de BANs activos
  const activosResult = await query(`
    SELECT COUNT(DISTINCT ban_number) as total
    FROM bans
    WHERE status = 'A'
  `);

  // 2. BANs activos con datos en subscribers (nombre, apellido o empresa)
  const activosConDatosResult = await query(`
    SELECT COUNT(DISTINCT b.ban_number) as total
    FROM bans b
    INNER JOIN subscribers s ON b.id = s.ban_id
    WHERE b.status = 'A'
      AND (
        (s.nombre IS NOT NULL AND s.nombre != '' AND s.nombre != 'NULL')
        OR (s.apellido IS NOT NULL AND s.apellido != '' AND s.apellido != 'NULL')
        OR (s.empresa IS NOT NULL AND s.empresa != '' AND s.empresa != 'NULL')
      )
  `);

  // 3. BANs activos sin datos (ningún suscriptor tiene nombre, apellido o empresa)
  const activosSinDatosResult = await query(`
    SELECT COUNT(DISTINCT b.ban_number) as total
    FROM bans b
    WHERE b.status = 'A'
      AND NOT EXISTS (
        SELECT 1 FROM subscribers s 
        WHERE s.ban_id = b.id 
          AND (
            (s.nombre IS NOT NULL AND s.nombre != '' AND s.nombre != 'NULL')
            OR (s.apellido IS NOT NULL AND s.apellido != '' AND s.apellido != 'NULL')
            OR (s.empresa IS NOT NULL AND s.empresa != '' AND s.empresa != 'NULL')
          )
      )
  `);

  // 4. Total de BANs cancelados
  const canceladosResult = await query(`
    SELECT COUNT(DISTINCT ban_number) as total
    FROM bans
    WHERE status = 'C'
  `);

  // 5. Total de suscriptores
  const suscriptoresResult = await query(`
    SELECT COUNT(*) as total
    FROM subscribers
  `);

  // 6. Total de BANs únicos
  const totalBansResult = await query(`
    SELECT COUNT(DISTINCT ban_number) as total
    FROM bans
  `);

  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ COMPARACIÓN: EXCEL vs BASE DE DATOS                                │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ BANs activos con datos:                                            │`);
  console.log(`│   Excel:  1,282                                                    │`);
  console.log(`│   BD:     ${String(activosConDatosResult[0].total).padStart(5)}                                                   │`);
  console.log(`│                                                                    │`);
  console.log(`│ BANs activos sin datos:                                            │`);
  console.log(`│   Excel:  355                                                      │`);
  console.log(`│   BD:     ${String(activosSinDatosResult[0].total).padStart(5)}                                                     │`);
  console.log(`│                                                                    │`);
  console.log(`│ BANs cancelados:                                                   │`);
  console.log(`│   Excel:  1,999                                                    │`);
  console.log(`│   BD:     ${String(canceladosResult[0].total).padStart(5)}                                                   │`);
  console.log(`│                                                                    │`);
  console.log(`│ Total BANs activos:                                                │`);
  console.log(`│   Excel:  1,637                                                    │`);
  console.log(`│   BD:     ${String(activosResult[0].total).padStart(5)}                                                   │`);
  console.log(`│                                                                    │`);
  console.log(`│ Total BANs únicos:                                                 │`);
  console.log(`│   Excel:  3,636                                                    │`);
  console.log(`│   BD:     ${String(totalBansResult[0].total).padStart(5)}                                                   │`);
  console.log(`│                                                                    │`);
  console.log(`│ Total suscriptores:                                                │`);
  console.log(`│   Excel:  6,641                                                    │`);
  console.log(`│   BD:     ${String(suscriptoresResult[0].total).padStart(5)}                                                   │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Verificar el problema de "Incompletos"
  console.log('🔍 Investigando el problema del tab "Incompletos"...\n');

  // Consulta actual del sistema (basada en clients.name)
  const incompletosActualResult = await query(`
    SELECT COUNT(DISTINCT c.id) as total
    FROM clients c 
    WHERE (c.name IS NULL OR c.name = '' OR c.name = 'NULL')
  `);

  // Consulta correcta (basada en subscribers sin datos)
  const incompletosCorrectaResult = await query(`
    SELECT COUNT(DISTINCT c.id) as total
    FROM clients c
    WHERE EXISTS (
      SELECT 1 FROM bans b 
      WHERE b.client_id = c.id AND b.status = 'A'
        AND NOT EXISTS (
          SELECT 1 FROM subscribers s 
          WHERE s.ban_id = b.id 
            AND (
              (s.nombre IS NOT NULL AND s.nombre != '' AND s.nombre != 'NULL')
              OR (s.apellido IS NOT NULL AND s.apellido != '' AND s.apellido != 'NULL')
              OR (s.empresa IS NOT NULL AND s.empresa != '' AND s.empresa != 'NULL')
            )
        )
    )
  `);

  console.log(`Clientes "Incompletos" (consulta actual del sistema): ${incompletosActualResult[0].total}`);
  console.log(`Clientes con BANs activos sin datos (consulta correcta): ${incompletosCorrectaResult[0].total}`);

  console.log('\n✅ Verificación completada');
  process.exit(0);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
