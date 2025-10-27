import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const serverUrl = 'http://142.93.176.195:3001';

async function uploadToServer() {
  console.log('🚀 SUBIENDO ARCHIVOS AL SERVIDOR');
  console.log('=' .repeat(50));
  
  try {
    // 1. Verificar que el servidor está funcionando
    console.log('\n🌐 Paso 1: Verificando servidor...');
    const healthRes = await fetch(`${serverUrl}/api/health`);
    
    if (!healthRes.ok) {
      console.log('❌ Servidor no responde');
      return;
    }
    
    console.log('✅ Servidor funcionando');
    
    // 2. Verificar archivos locales
    console.log('\n📁 Paso 2: Verificando archivos locales...');
    const distPath = './dist';
    
    if (!fs.existsSync(distPath)) {
      console.log('❌ Carpeta dist no existe');
      return;
    }
    
    const files = fs.readdirSync(distPath, { recursive: true });
    console.log('✅ Archivos encontrados:');
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    
    // 3. Crear instrucciones de subida
    console.log('\n📋 Paso 3: Creando instrucciones de subida...');
    
    const uploadCommands = `
# 🚀 COMANDOS PARA SUBIR ARCHIVOS

## Método 1: SCP (Recomendado)
\`\`\`bash
# Subir archivos principales
scp dist/index.html user@142.93.176.195:/var/www/dist/

# Subir archivos de assets
scp -r dist/assets/* user@142.93.176.195:/var/www/dist/assets/

# Configurar permisos
ssh user@142.93.176.195 "sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx"
\`\`\`

## Método 2: Comando único
\`\`\`bash
# Subir todo de una vez
scp -r dist/* user@142.93.176.195:/var/www/dist/ && ssh user@142.93.176.195 "sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx"
\`\`\`

## Método 3: Usando el ZIP
\`\`\`bash
# Subir el ZIP
scp crmp-deploy-2025-10-26T02-14-09.zip user@142.93.176.195:/tmp/

# En el servidor
ssh user@142.93.176.195
cd /var/www
unzip /tmp/crmp-deploy-2025-10-26T02-14-09.zip -d temp_dist/
cp -r temp_dist/* dist/
rm -rf temp_dist
sudo chown -R www-data:www-data /var/www/dist
sudo chmod -R 755 /var/www/dist
sudo systemctl reload nginx
\`\`\`
`;

    fs.writeFileSync('UPLOAD_COMMANDS.txt', uploadCommands);
    console.log('✅ Comandos guardados en UPLOAD_COMMANDS.txt');
    
    // 4. Verificar que el frontend actual
    console.log('\n🌍 Paso 4: Verificando frontend actual...');
    const frontendRes = await fetch('https://crmp.ss-group.cloud');
    
    if (!frontendRes.ok) {
      console.log('❌ Frontend no accesible:', frontendRes.status);
      return;
    }
    
    console.log('✅ Frontend accesible');
    
    // 5. Mostrar resumen
    console.log('\n🎯 RESUMEN:');
    console.log('1. ✅ Archivos listos para subir');
    console.log('2. ✅ Servidor funcionando');
    console.log('3. ✅ Frontend accesible');
    console.log('4. 📋 Comandos de subida creados');
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Ejecutar los comandos de UPLOAD_COMMANDS.txt');
    console.log('2. Verificar en https://crmp.ss-group.cloud');
    console.log('3. Navegar a la sección "Productos"');
    console.log('4. Deberías ver 21 productos con categorías');
    
    console.log('\n⚡ COMANDO RÁPIDO:');
    console.log('scp -r dist/* user@142.93.176.195:/var/www/dist/ && ssh user@142.93.176.195 "sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx"');
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

uploadToServer();
