
#!/bin/bash
CONF="/etc/nginx/sites-available/crmp.ss-group.cloud"

echo "Updating Nginx config to disable caching for index.html..."

# Backup
cp "$CONF" "$CONF.bak_cache"

# Add Cache-Control header to location / block
# We use a temporary file to construct the new config because sed multiline is tricky
# We will look for 'try_files $uri $uri/ /index.html;' and append the header after it

sed -i '/try_files $uri $uri\/ \/index.html;/a \        add_header Cache-Control "no-store, no-cache, must-revalidate";' "$CONF"

# Test configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration valid. Reloading Nginx..."
    systemctl reload nginx
    echo "✅ Nginx updated."
else
    echo "❌ Configuration invalid. Restoring backup..."
    cp "$CONF.bak_cache" "$CONF"
    systemctl reload nginx
    exit 1
fi
