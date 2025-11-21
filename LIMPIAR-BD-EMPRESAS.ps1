# Script para limpiar nombres auto-generados "Empresa BAN XXX"
$query = "UPDATE clients SET business_name = NULL WHERE business_name LIKE 'Empresa BAN%' OR business_name LIKE 'Cliente BAN%';"

ssh root@143.244.191.139 @"
PGPASSWORD='CRM_Seguro_2025!' psql -h 127.0.0.1 -U crm_user -d crm_pro -c `"$query`"
"@

Write-Host "`n✅ Limpieza completada. Los clientes con 'Empresa BAN XXX' ahora tienen business_name = NULL"
