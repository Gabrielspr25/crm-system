#!/bin/bash
cat > /etc/nginx/sites-available/crmp.ss-group.cloud << 'NGINX_EOF'
server {
    server_name crmp.ss-group.cloud www.crmp.ss-group.cloud;
    root /var/www/crmp/dist;
    index index.html index.htm;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API proxy (must be before location /)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets directory (must be before location /)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Cache static assets by extension (must be before location /)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Handle client-side routing for React
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "CRM-AI2 is healthy\n";
        add_header Content-Type text/plain;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ \.(ini|conf|sql|sh)$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/crmp.ss-group.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crmp.ss-group.cloud/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = crmp.ss-group.cloud) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name crmp.ss-group.cloud www.crmp.ss-group.cloud;
    return 404;
}
NGINX_EOF

nginx -t && systemctl reload nginx && echo "Nginx configurado correctamente"

