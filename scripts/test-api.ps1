& {
    # Cole este bloco inteiro no Windows PowerShell 5.1. Não cole linhas de else isoladas.
    $api = 'http://localhost:3000'
    if ($env:TEST_API_URL) { $api = $env:TEST_API_URL }
    $resultados = New-Object 'System.Collections.Generic.List[object]'
    $criados = New-Object 'System.Collections.Generic.List[int]'
    $marcador = 'Auditoria PS ' + [guid]::NewGuid().ToString()
    $payload = @{ nome=$marcador; categoria='Turismo'; descricao='Teste CRUD PowerShell'; localizacao=@{ cidade='Balsas'; estado='MA' }; tags=@(); distanciaCentroKm=3 }

    function Requisicao($metodo, $caminho, $corpo) {
        $req = [System.Net.HttpWebRequest]::Create($api + $caminho)
        $req.Method = $metodo
        if ($metodo -in @('POST','PUT','PATCH','DELETE')) { $req.Headers['Authorization'] = 'Bearer ' + $env:API_WRITE_TOKEN }
        $req.Timeout = 10000
        if ($null -ne $corpo) {
            $req.ContentType = 'application/json; charset=utf-8'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes(($corpo | ConvertTo-Json -Depth 10 -Compress))
            $req.ContentLength = $bytes.Length
            $stream = $req.GetRequestStream()
            try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Close() }
        }
        $resp = $null
        try { $resp = $req.GetResponse() } catch [System.Net.WebException] {
            $resp = $_.Exception.Response
            if ($null -eq $resp) { throw 'Sem resposta HTTP: conexão indisponível ou timeout' }
        }
        try {
            $leitor = New-Object System.IO.StreamReader($resp.GetResponseStream())
            try { $texto = $leitor.ReadToEnd() } finally { $leitor.Close() }
            $json = $null
            if ($texto) { try { $json = ConvertFrom-Json -InputObject $texto } catch { } }
            if ($metodo -eq 'POST' -and [int]$resp.StatusCode -eq 201 -and $json.nome -eq $marcador -and $json.id -gt 0) {
                $criados.Add([int]$json.id)
            }
            return [pscustomobject]@{ Codigo=[int]$resp.StatusCode; Texto=$texto; Json=$json }
        } finally { $resp.Close() }
    }
    function Conferir($condicao, $mensagem) { if (-not $condicao) { throw $mensagem } }
    function VerificarSQL($modo, $idSql, $descricaoSql) {
        $nomes = @('BALSAS_TEST_MODE','BALSAS_TEST_ID','BALSAS_TEST_NAME','BALSAS_TEST_DESCRIPTION')
        $anteriores = @{}
        foreach ($nomeEnv in $nomes) { $anteriores[$nomeEnv] = [Environment]::GetEnvironmentVariable($nomeEnv, 'Process') }
        try {
            $env:BALSAS_TEST_MODE = $modo
            $env:BALSAS_TEST_ID = [string]$idSql
            $env:BALSAS_TEST_NAME = $marcador
            $env:BALSAS_TEST_DESCRIPTION = $descricaoSql
            # Código enviado ao Node por stdin; não cria arquivos nem mostra DATABASE_URL.
            $jsSql = @'
let client;
try {
  await import('dotenv/config');
  const { default: pg } = await import('pg');
  client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  const { rows } = await client.query('SELECT nome, descricao FROM atracoes WHERE id=$1', [Number(process.env.BALSAS_TEST_ID)]);
  const ok = process.env.BALSAS_TEST_MODE === 'ausente' ? rows.length === 0 : rows.length === 1 && rows[0].nome === process.env.BALSAS_TEST_NAME && rows[0].descricao === process.env.BALSAS_TEST_DESCRIPTION;
  console.log(JSON.stringify({ resultado: ok ? 'APROVADO' : 'REPROVADO', detalhes: ok ? 'Consulta SQL independente confirmou ' + process.env.BALSAS_TEST_MODE : 'Dados SQL divergem do esperado' }));
} catch (erro) {
  console.log(JSON.stringify({ resultado: 'NAO_VERIFICADO', detalhes: 'Consulta SQL indisponivel: ' + (erro.code ?? erro.name) }));
} finally { if (client) await client.end(); }
'@
            $saidaSql = $jsSql | & node --input-type=module
            if ($LASTEXITCODE -ne 0) { throw 'Node não conseguiu executar a consulta SQL' }
            $verificacao = ($saidaSql -join "`n") | ConvertFrom-Json
            $situacaoSql = $verificacao.resultado
            if ($situacaoSql -eq 'NAO_VERIFICADO') { $situacaoSql = 'NÃO VERIFICADO' }
            $resultados.Add([pscustomobject]@{ Metodo='SQL'; Endpoint=('/atracoes/' + $idSql + ' (' + $modo + ')'); HTTP=$null; Resultado=$situacaoSql; Detalhes=$verificacao.detalhes })
        } catch {
            $resultados.Add([pscustomobject]@{ Metodo='SQL'; Endpoint=('/atracoes/' + $idSql); HTTP=$null; Resultado='NÃO VERIFICADO'; Detalhes='Consulta SQL não executada; execute na pasta do package.json com Node e pg instalados' })
        } finally {
            foreach ($nomeEnv in $nomes) { [Environment]::SetEnvironmentVariable($nomeEnv, $anteriores[$nomeEnv], 'Process') }
        }
    }
    function Testar($metodo, $caminho, $esperado, $corpo, $validar) {
        $r = $null
        try {
            $r = Requisicao $metodo $caminho $corpo
            Conferir ($r.Codigo -eq $esperado) ('Esperado HTTP ' + $esperado + '; recebido ' + $r.Codigo + '; ' + $r.Texto)
            if ($esperado -ge 400) { Conferir ($null -ne $r.Json.erro) 'Resposta não contém erro JSON' }
            if ($null -ne $validar) { & $validar $r }
            $detalhes = 'HTTP e conteúdo verificados'
            if ($esperado -ge 400) { $detalhes = $r.Texto }
            $resultados.Add([pscustomobject]@{ Metodo=$metodo; Endpoint=$caminho; HTTP=$r.Codigo; Resultado='APROVADO'; Detalhes=$detalhes })
        } catch {
            $codigo = $null
            if ($null -ne $r) { $codigo = $r.Codigo }
            $resultados.Add([pscustomobject]@{ Metodo=$metodo; Endpoint=$caminho; HTTP=$codigo; Resultado='REPROVADO'; Detalhes=$_.Exception.Message })
        }
    }
    try {
        Testar 'GET' '/' 200 $null { param($r) Conferir ($r.Json.nome -eq 'Balsas Experience API') 'Identificação incorreta' }
        Testar 'GET' '/health' 200 $null { param($r) Conferir ($r.Json.banco -eq 'conectado') 'Banco não confirmou conexão' }
        Testar 'GET' '/atracoes' 200 $null { param($r) Conferir ($r.Texto.Trim().StartsWith('[')) 'Listagem não é array JSON' }
        Testar 'POST' '/atracoes' 400 @{nome='';categoria='';descricao=''} $null
        Testar 'POST' '/atracoes' 400 @{nome='Teste';descricao='Sem categoria'} $null
        Testar 'POST' '/atracoes' 201 $payload { param($r) Conferir ($r.Json.id -gt 0 -and $r.Json.nome -eq $marcador) 'Registro não criado corretamente' }
        if ($criados.Count -gt 0) {
            $id = $criados[0]
            $caminho = '/atracoes/' + $id
            Testar 'GET' $caminho 200 $null { param($r) Conferir ($r.Json.nome -eq $marcador -and $r.Json.categoria -eq 'Turismo') 'Dados criados não persistiram' }
            Testar 'GET' '/atracoes' 200 $null { param($r) Conferir (@($r.Json | Where-Object { $_.id -eq $id -and $_.nome -eq $marcador }).Count -eq 1) 'Registro ausente da listagem' }
            $put = $payload.Clone()
            $put.descricao = 'Atualização PUT'
            Testar 'PUT' $caminho 200 $put { param($r) Conferir ($r.Json.descricao -eq 'Atualização PUT') 'PUT não retornou atualização' }
            Testar 'GET' $caminho 200 $null { param($r) Conferir ($r.Json.descricao -eq 'Atualização PUT') 'PUT não persistiu' }
            Testar 'PUT' $caminho 400 @{nome=$marcador} $null
            Testar 'PATCH' $caminho 200 @{descricao='Atualização PATCH'} { param($r) Conferir ($r.Json.descricao -eq 'Atualização PATCH') 'PATCH não retornou atualização' }
            Testar 'GET' $caminho 200 $null { param($r) Conferir ($r.Json.descricao -eq 'Atualização PATCH' -and $r.Json.nome -eq $marcador -and $r.Json.categoria -eq 'Turismo' -and $r.Json.localizacao.cidade -eq 'Balsas' -and $r.Json.localizacao.estado -eq 'MA' -and $r.Json.distanciaCentroKm -eq 3 -and @($r.Json.tags).Count -eq 0) 'PATCH não persistiu ou alterou campos omitidos' }
            VerificarSQL 'presente' $id 'Atualização PATCH'
            Testar 'PATCH' $caminho 400 @{nome=$null} $null
            Testar 'PATCH' $caminho 400 @{campoInvalido=1} $null
            Testar 'DELETE' $caminho 204 $null { param($r) Conferir ($r.Texto -eq '') 'DELETE deve retornar corpo vazio' }
            Testar 'GET' $caminho 404 $null $null
            VerificarSQL 'ausente' $id ''
            Testar 'PUT' $caminho 404 $payload $null
            Testar 'PATCH' $caminho 404 @{descricao='Teste'} $null
            Testar 'DELETE' $caminho 404 $null $null
        } else {
            foreach ($metodo in @('GET','PUT','PATCH','DELETE')) {
                $resultados.Add([pscustomobject]@{ Metodo=$metodo; Endpoint='/atracoes/:id'; HTTP=$null; Resultado='NÃO EXECUTADO'; Detalhes='POST não criou um registro temporário' })
            }
        }
        foreach ($metodo in @('GET','PUT','PATCH','DELETE')) {
            $corpo = $null
            if ($metodo -eq 'PUT') { $corpo = $payload }
            if ($metodo -eq 'PATCH') { $corpo = @{descricao='Teste'} }
            Testar $metodo '/atracoes/abc' 400 $corpo $null
        }
        Testar 'GET' '/atracoes/2147483648' 400 $null $null
        Testar 'GET' '/atracoes?ate=Infinity' 400 $null $null
        Testar 'GET' '/categorias' 200 $null { param($r) Conferir ($r.Texto.Trim().StartsWith('[')) 'Categorias não são array JSON' }
        Testar 'GET' '/abc' 404 $null $null
    } finally {
        foreach ($idCriado in $criados) {
            try {
                $caminho = '/atracoes/' + $idCriado
                $r = Requisicao 'GET' $caminho $null
                if ($r.Codigo -eq 200 -and $r.Json.nome -eq $marcador) {
                    $exclusao = Requisicao 'DELETE' $caminho $null
                    Conferir ($exclusao.Codigo -eq 204) 'Limpeza do registro temporário falhou'
                    $confirmacao = Requisicao 'GET' $caminho $null
                    Conferir ($confirmacao.Codigo -eq 404) 'Exclusão temporária não confirmada'
                } elseif ($r.Codigo -ne 404) { throw 'Não foi possível confirmar propriedade do registro temporário' }
            } catch {
                $resultados.Add([pscustomobject]@{ Metodo='DELETE'; Endpoint=('/atracoes/' + $idCriado); HTTP=$null; Resultado='REPROVADO'; Detalhes=('Limpeza pendente: ' + $_.Exception.Message) })
            }
        }
        $resultados | Format-Table Metodo,Endpoint,HTTP,Resultado,Detalhes -AutoSize -Wrap
        foreach ($situacao in @('APROVADO','REPROVADO','NÃO EXECUTADO','NÃO VERIFICADO')) {
            Write-Output ($situacao + ': ' + @($resultados | Where-Object { $_.Resultado -eq $situacao }).Count)
        }
        Write-Output ('TOTAL: ' + $resultados.Count)
    }
}
