$ErrorActionPreference = 'Stop'
$pidRecord = Get-Content -LiteralPath 'backups/isolamento-principal/api-pid.json' -Raw | ConvertFrom-Json
$apiProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($pidRecord.pid)"
$entrypointPattern = if ($pidRecord.entrypoint -eq 'scripts/start-runtime-private.mjs') { 'scripts[/\\]start-runtime-private\.mjs(?:\s|$|")' } elseif (-not $pidRecord.entrypoint -or $pidRecord.entrypoint -eq 'src/app.js') { 'src[/\\]app\.js(?:\s|$|")' } else { throw 'Entrypoint nao autorizado' }
if (-not $apiProcess -or $apiProcess.ExecutablePath -ne $pidRecord.executable -or $apiProcess.CommandLine -notmatch $entrypointPattern) { throw 'PID nao corresponde ao processo iniciado' }
$listener = @(Get-NetTCPConnection -State Listen -LocalPort $pidRecord.port | Where-Object OwningProcess -eq $pidRecord.pid)
if ($listener.Count -ne 1) { throw 'Listener da API nao confirmado' }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$($pidRecord.port)/health" -TimeoutSec 5
if ($health.banco -ne 'conectado') { throw 'Health indisponivel' }
$connections = @(Get-NetTCPConnection -OwningProcess $pidRecord.pid -State Established | Where-Object RemotePort -eq 5432)
if ($connections.Count -lt 1) { throw 'Conexao PostgreSQL do PID nao encontrada' }
$evidence = @{ pid=$pidRecord.pid; port=$pidRecord.port; creationTime=$apiProcess.CreationDate.ToUniversalTime().ToString('o'); matchesRecordedProcess=$true; listenerConfirmed=$true; databaseClientPorts=@($connections | Select-Object -ExpandProperty LocalPort) }
$evidence | ConvertTo-Json | Set-Content -LiteralPath 'docs/isolamento-principal-processo.json' -Encoding UTF8
Write-Output "Processo e listener confirmados; conexoes PostgreSQL mapeadas por PID $($pidRecord.pid)."
