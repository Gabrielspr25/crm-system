# 🚀 INSTRUCCIONES PARA SUBIR A GITHUB

## Paso 1: Crear repositorio en GitHub
1. Ve a https://github.com
2. Click "New Repository"
3. Nombre: momvision-cms
4. Descripción: 🚀 Sistema de Gestión de Contenidos para MOM Vision - React + Node.js
5. Público o Privado (tu elección)
6. NO marcar "Initialize with README"
7. Click "Create Repository"

## Paso 2: Conectar repositorio local con GitHub
Después de crear el repo, GitHub te dará una URL. Usa estos comandos:

```bash
# Agregar el remote origin (reemplaza con tu URL de GitHub)
git remote add origin https://github.com/TU-USUARIO/momvision-cms.git

# Cambiar nombre de la rama principal a main (estándar actual)
git branch -M main

# Subir el código a GitHub
git push -u origin main
```

## Paso 3: Verificar
- Ve a tu repositorio en GitHub
- Deberías ver todos los archivos subidos
- El README.md se mostrará automáticamente

## 🔄 Para futuros cambios:
```bash
# Después de hacer cambios en el código
git add .
git commit -m "Descripción del cambio"
git push origin main
```

## 📁 Estructura subida:
✅ Frontend React completo
✅ Backend Node.js con API
✅ Servidor demo funcional  
✅ Sistema de autenticación
✅ Panel de administración
✅ Configuración visual
✅ Documentación completa

## 🌐 Deploy posterior:
Una vez en GitHub, podrás hacer deploy en:
- Vercel (recomendado para React)
- Netlify  
- Railway (full-stack)
- Tu servidor actual

¡El código está listo para producción!