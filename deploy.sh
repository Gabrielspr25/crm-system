#!/bin/bash

# Script de despliegue para DigitalOcean
# Asegúrate de configurar las variables de entorno antes de ejecutar

set -e

echo "🚀 Iniciando despliegue del CRM System..."

# Variables
SERVER_IP="138.197.66.85"
SERVER_USER="root"
APP_NAME="crm-system"
DOCKER_IMAGE="crm-system:latest"
CONTAINER_NAME="crm-app"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Construyendo imagen Docker...${NC}"
docker build -t $DOCKER_IMAGE .

echo -e "${BLUE}📤 Exportando imagen...${NC}"
docker save $DOCKER_IMAGE | gzip > crm-system.tar.gz

echo -e "${BLUE}⬆️  Subiendo archivos al servidor...${NC}"
scp crm-system.tar.gz $SERVER_USER@$SERVER_IP:/tmp/
scp docker-compose.prod.yml $SERVER_USER@$SERVER_IP:/opt/crm/docker-compose.yml
scp .env.production $SERVER_USER@$SERVER_IP:/opt/crm/.env

echo -e "${BLUE}🔧 Ejecutando comandos en el servidor...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    # Cargar imagen Docker
    echo "📥 Cargando imagen Docker..."
    docker load < /tmp/crm-system.tar.gz
    rm /tmp/crm-system.tar.gz
    
    # Navegar al directorio de la aplicación
    cd /opt/crm
    
    # Detener contenedores existentes
    echo "🛑 Deteniendo contenedores existentes..."
    docker-compose down || true
    
    # Ejecutar migraciones de base de datos
    echo "🗄️  Ejecutando migraciones..."
    docker-compose run --rm crm-app npx prisma migrate deploy
    
    # Iniciar nuevos contenedores
    echo "▶️  Iniciando nuevos contenedores..."
    docker-compose up -d
    
    # Limpiar imágenes no utilizadas
    echo "🧹 Limpiando imágenes no utilizadas..."
    docker image prune -f
    
    echo "✅ Despliegue completado"
ENDSSH

echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo -e "${BLUE}🌐 La aplicación está disponible en: http://$SERVER_IP:3000${NC}"

# Limpiar archivos temporales locales
rm crm-system.tar.gz

echo -e "${GREEN}✨ ¡Todo listo!${NC}"
