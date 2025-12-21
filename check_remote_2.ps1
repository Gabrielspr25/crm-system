$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$plinkPath = "C:\Program Files\PuTTY\plink.exe"

Write-Host "Checking first 5 lines..."
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "head -n 5 /tmp/deploy-remote.sh | cat -A"

Write-Host "Running script manually..."
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash /tmp/deploy-remote.sh"
