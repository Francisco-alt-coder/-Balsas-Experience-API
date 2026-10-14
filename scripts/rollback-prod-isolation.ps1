# Padrao somente leitura. -Apply exige autorizacao separada de rollback.
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$pidRecord = Get-Content -LiteralPath 'backups/isolamento-principal/api-pid.json' -Raw | ConvertFrom-Json
$evidence = Get-Content -LiteralPath 'docs/isolamento-principal-processo.json' -Raw | ConvertFrom-Json
$apiProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($pidRecord.pid)"
$entrypointPattern = if ($pidRecord.entrypoint -eq 'scripts/start-runtime-private.mjs') { 'scripts[/\\]start-runtime-private\.mjs(?:\s|$|")' } elseif (-not $pidRecord.entrypoint -or $pidRecord.entrypoint -eq 'src/app.js') { 'src[/\\]app\.js(?:\s|$|")' } else { throw 'Entrypoint nao autorizado' }
if (-not $apiProcess -or $pidRecord.pid -ne $evidence.pid -or $apiProcess.CreationDate.ToUniversalTime().ToString('o') -ne $evidence.creationTime -or $apiProcess.ExecutablePath -ne $pidRecord.executable -or $apiProcess.CommandLine -notmatch $entrypointPattern) { throw 'Identidade do processo nao comprovada: nao encerrar' }
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $pidRecord.port | Where-Object OwningProcess -eq $pidRecord.pid)
if ($listeners.Count -ne 1) { throw 'Listener divergente: nao encerrar' }
# Confirma snapshots antes de parar apenas o PID conhecido.
node scripts/isolation-prod-control.mjs rollback-check
if ($LASTEXITCODE -ne 0) { throw 'Dados/estado divergentes: exigir revisao antes do rollback' }
if (-not $Apply) { Write-Output 'Dry-run aprovado: credencial vigente e dados conferem; nenhum processo parado ou SQL de rollback executado.'; exit 0 }
Stop-Process -Id $pidRecord.pid -ErrorAction Stop
node scripts/isolation-prod-control.mjs rollback
if ($LASTEXITCODE -ne 0) { throw 'Rollback interrompido; nao tentar restauracao destrutiva' }
node scripts/isolation-prod-control.mjs start-rollback
if ($LASTEXITCODE -ne 0) { throw 'Configuracao anterior restaurada; inicializacao requer diagnostico' }
Write-Output 'Rollback operacional concluido; HBA restritivo mantido, dados preservados.'
