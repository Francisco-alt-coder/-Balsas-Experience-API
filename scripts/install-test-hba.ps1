$ErrorActionPreference = 'Stop'
$privateDir = Join-Path $PSScriptRoot '../backups/isolamento-testes'
$baseline = Get-Content -LiteralPath (Join-Path $privateDir 'baseline.json') -Raw | ConvertFrom-Json
$targetPath = [IO.Path]::GetFullPath($baseline.hbaPath)
if ($targetPath -ne 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf') { throw 'HBA fora do caminho revisado' }
$currentHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($currentHash -ne $baseline.hbaHash) { throw 'HBA mudou desde a revisao; interromper' }
$proposedPath = Join-Path $privateDir 'hba-proposed.conf'
if ((Get-FileHash -LiteralPath $proposedPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $baseline.hbaProposedHash) { throw 'Proposta mudou' }
$original = [IO.File]::ReadAllBytes($targetPath)
$proposed = [IO.File]::ReadAllBytes($proposedPath)
if ($proposed.Length -le $original.Length) { throw 'Proposta invalida' }
$tail = $proposed[($proposed.Length-$original.Length)..($proposed.Length-1)]
if ([Convert]::ToBase64String($tail) -ne [Convert]::ToBase64String($original)) { throw 'Regras existentes modificadas' }
# Preserva ACL do arquivo; somente acrescenta o bloco especifico dos novos papeis.
[IO.File]::WriteAllBytes($targetPath, $proposed)
if ((Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $baseline.hbaProposedHash) { throw 'Falha de verificacao HBA' }
Write-Output 'HBA de testes instalado; regras existentes preservadas integralmente.'
