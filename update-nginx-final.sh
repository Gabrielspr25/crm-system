#!/bin/bash
CONF="/etc/nginx/sites-available/crmp.ss-group.cloud"

echo "Updating Nginx config at $CONF..."

# Backup
cp "$CONF" "$CONF.bak_$(date +%s)"

# Remove existing timeout directives to avoid duplicates/conflicts
sed -i '/proxy_read_timeout/d' "$CONF"
sed -i '/proxy_connect_timeout/d' "$CONF"
sed -i '/proxy_send_timeout/d' "$CONF"
sed -i '/send_timeout/d' "$CONF"
sed -i '/client_max_body_size/d' "$CONF"

# Insert new timeout directives inside the /api location block
# We look for 'location /api {' and append lines after it
sed -i '/location \/api {/a \        proxy_read_timeout 3600s;\n        proxy_connect_timeout 3600s;\n        proxy_send_timeout 3600s;\n        send_timeout 3600s;' "$CONF"

# Insert client_max_body_size in the server block (e.g., after server_name)
sed -i '/server_name/a \    client_max_body_size 100M;' "$CONF"

# Test configuration
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration valid. Reloading Nginx..."
    systemctl reload nginx
    echo "✅ Nginx updated successfully with 1 hour timeouts."
else
    echo "❌ Configuration invalid. Restoring backup..."
    cp "$CONF.bak_*" "$CONF"
    systemctl reload nginx
    exit 1
fi
