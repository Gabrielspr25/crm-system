import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health/full',
  method: 'GET'
};

console.log('🏥 Ejecutando Diagnóstico de Salud del Sistema...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.success) {
        console.log('\n✅ SISTEMA OPERATIVO');
        console.log('-------------------');
        console.log(`Base de Datos: ${json.results.database.status}`);
        console.log(`Permisos:      ${json.results.permissions.status}`);
        
        let hasErrors = false;
        
        console.log('\nTablas Críticas:');
        json.results.tables.details.forEach(t => {
            const icon = t.status === 'ok' ? '✅' : '❌';
            console.log(`  ${icon} ${t.table.padEnd(20)} (${t.count} registros)`);
            if (t.status !== 'ok') hasErrors = true;
        });

        console.log('\nIntegridad Estructural:');
        json.results.critical_functions.details.forEach(c => {
            const icon = c.status === 'ok' ? '✅' : '❌';
            console.log(`  ${icon} ${c.check.padEnd(30)}`);
            if (c.status !== 'ok') hasErrors = true;
        });

        if (hasErrors) {
            console.log('\n❌ SE ENCONTRARON ERRORES. NO DESPLEGAR.');
            process.exit(1);
        } else {
            console.log('\n✨ Todo correcto. Listo para desplegar.');
            process.exit(0);
        }

      } else {
        console.error('❌ Error en diagnóstico:', json.error);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Error parseando respuesta:', e.message);
      console.log('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error conectando al servidor:', error.message);
  console.log('Asegúrate de que el servidor local esté corriendo (npm start)');
  process.exit(1);
});

req.end();
