#!/bin/bash
set -e

echo "--- STOPPING NGINX ---"
systemctl stop nginx || true

echo "--- CLEANING WEB DIR ---"
rm -rf /var/www/crmp/*
mkdir -p /var/www/crmp

echo "--- EXTRACTING FRONTEND ---"
tar -xzf /tmp/frontend.tar.gz -C /var/www/crmp
rm /tmp/frontend.tar.gz

echo "--- SETTING PERMISSIONS ---"
chown -R www-data:www-data /var/www/crmp
chmod -R 755 /var/www/crmp

echo "--- UPDATING BACKEND ---"
cd /opt/crmp
npm install --production

echo "--- RESTARTING PM2 ---"
pm2 restart all || pm2 start server-FINAL.js --name crm-backend

echo "--- STARTING NGINX ---"
systemctl start nginx

echo "--- DEPLOY SCRIPT FINISHED ---"
