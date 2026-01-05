#!/usr/bin/env pwsh

Write-Host "🗑️  BORRANDO DATOS EN SERVIDOR REMOTO" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

$commands = @"
su - postgres -c 'psql -d crm_pro -c \"DELETE FROM subscribers;\"'
su - postgres -c 'psql -d crm_pro -c \"DELETE FROM bans;\"'
su - postgres -c 'psql -d crm_pro -c \"DELETE FROM clients;\"'
su - postgres -c 'psql -d crm_pro -c \"SELECT '\''clients'\'' as tabla, COUNT(*) FROM clients UNION ALL SELECT '\''bans'\'', COUNT(*) FROM bans UNION ALL SELECT '\''subscribers'\'', COUNT(*) FROM subscribers;\"'
"@

ssh root@143.244.191.139 $commands

Write-Host "`n✅ Proceso completado" -ForegroundColor Green
