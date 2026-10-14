# Balsas Experience API 2.0.0

API REST de atrações turísticas de Balsas-MA com Node.js 24, Express 5.2.1, Prisma 7.10.0 e PostgreSQL. Estado local: **FUNCIONAL LOCALMENTE**; publicação **BLOQUEADA POR DEPENDÊNCIA EXTERNA**, em 13/10/2026. **196 testes aprovados**, com preservação dos dados e do .env. DIRECT_URL privada continua vazia e o schema Neon está ausente. Transporte TLS 1.3/certificado/hostname passaram sem autenticação da aplicação. Não houve publicação. Veja a [auditoria final das pendências](docs/relatorio-final-pendencias-publicacao.md).

O [relatório de prontidão](docs/estado-publicacao.md) registra os resultados atuais. O [guia de publicação](docs/guia-publicacao-final.md) define ações futuras sujeitas a autorização; a [rotação administrativa](docs/estado-publicacao.md) já foi comprovada.

O conector Neon confirmou organização Wesley (Free), projeto `balsas-experience-api` (`little-surf-82939047`), branch `main`, database `balsas_experience`, PostgreSQL 18.6 e pooler desabilitado. As consultas READ ONLY retornaram public vazio e nenhum ledger Prisma. Suítes atuais: 47 unitários, 80 integração, 39 Lab08 e 30 PowerShell; repetições não são somadas. A [matriz acadêmica](docs/matriz-rastreabilidade-academica.md) registra os requisitos dos três PDFs e as diferenças do contrato existente.

A revisão de organização está registrada em [auditoria de limpeza](docs/auditoria-limpeza.md). Código, migrações, backups e evidências acadêmicas foram preservados; somente logs npm antigos foram removidos. Essa revisão não autoriza publicação.

## Arquitetura e dados

Express → routes → validação/Bearer → controllers → cliente Prisma único com PrismaPg → PostgreSQL. `Atracao` pertence a `Categoria`; `Tag` se relaciona a atrações por `AtracaoTag`, com chave composta; `Avaliacao` pertence a uma atração e é excluída em cascata. Categoria possui nome e chave normalizada únicos, e não pode ser excluída enquanto tiver atrações relacionadas. Nota possui CHECK de 1 a 5 no banco.

A coluna textual categoria permanece durante a transição; respostas conservam categoria string, tags string[] e localizacao aninhada. A relação categoriaRelacao e categoriaId é usada na escrita e no filtro. Distância continua Float nullable para preservar o contrato existente; o PDF utiliza Int nullable. A N:N explícita, as datas existentes e a migração inicial foram preservadas.

## Configuração local

Na pasta deste package.json:

```powershell
npm ci --include=dev
# Em instalação nova, copie .env.example para .env e configure DATABASE_URL.
# O .env do ambiente auditado é privado e não acompanha o pacote público.
# Gere o segredo em um gerenciador privado, sem imprimi-lo no terminal.
# Guarde o segredo gerado somente em API_WRITE_TOKEN no .env.
npm run prisma:generate
npx prisma validate --config prisma7.config.ts
# Em banco novo e somente após autorização: migrações via DIRECT_URL privada do operador.
npm start
```

Antes de migrar banco existente, gere e valide backup completo. A migração desta entrega já foi aplicada após restauração isolada validada. Nunca use reset ou db push para substituir o histórico. db:migrate usa migrate dev para novas mudanças; db:migrate:deploy aplica arquivos existentes. db:seed insere registros ausentes do JSON por ID e preserva os existentes; não cria avaliações. Não é necessário executá-lo no banco atual.

Variáveis: DATABASE_URL (segredo), API_WRITE_TOKEN (segredo aleatório de pelo menos 32 caracteres, sem espaços), PORT (1..65535; padrão 3000), HOST (padrão 127.0.0.1 em desenvolvimento; 0.0.0.0 em produção), NODE_ENV e CORS_ORIGINS (origens exatas separadas por vírgula; obrigatória em produção). Sem frontend publicado, use explicitamente `CORS_ORIGINS=none`: clientes sem Origin funcionam e origens de navegador recebem 403. Quando houver frontend, configure sua origem HTTPS real. A inicialização recusa token ausente/trivial em qualquer ambiente. O token compartilhado autoriza operações sem identificar usuários individuais; não o coloque em frontend público.

## Endpoints e validação

| Método | Caminho | Resultado |
|---|---|---|
| GET | / | Identificação 200 |
| GET | /health | SELECT 1 real; 200 conectado, 500 indisponível |
| GET | /live | Liveness 200; não indica saúde do banco |
| GET | /atracoes | Lista; filtros categoria, tag, cidade, ate, q |
| GET | /atracoes/:id | Detalhe com avaliações, notaMedia e totalAvaliacoes |
| POST | /atracoes | Bearer; criação 201 e Location |
| PUT | /atracoes/:id | Bearer; substituição 200, tags substituídas |
| PATCH | /atracoes/:id | Bearer; altera apenas campos enviados |
| DELETE | /atracoes/:id | Bearer; exclusão 204, avaliações em cascata |
| GET | /categorias | [{id,nome,atracoes}], incluindo contagem zero |
| GET | /categorias?formato=nomes | Lista de nomes de compatibilidade |
| POST | /atracoes/:id/avaliacoes | Bearer; avaliação 201 e Location do detalhe |

GET permanece público. Bearer ausente/inválido recebe 401 e WWW-Authenticate. Campos/tipos/IDs inválidos recebem 400; recurso ausente 404; conflitos Prisma 409; JSON acima de 100 KB 413; codificação não suportada 415; falhas internas 500 genérico. Logs não incluem corpos nem credenciais. CORS não substitui autenticação.

q busca no nome e na descrição com contains/insensitive no PostgreSQL, elimina espaços externos, ignora vazio e trata %, _ e barra invertida literalmente. Não remove acentos. Filtros combinam por AND. ordem=nome, pagina e tamanho mantêm o contrato anterior (padrões 1 e 3 quando paginação é solicitada); tamanho e offset devem caber em inteiro PostgreSQL. Sem paginação, retorna lista completa. Não há rate limiting nem teto operacional pequeno de página.

POST/PUT exigem nome, categoria e descricao textuais não vazios. localizacao aceita cidade e/ou estado textuais; tags deve ser lista de textos; distância deve ser finita >=0 ou null. Avaliação exige visitante textual não vazio e nota inteira de 1 a 5; comentário aceita string, null ou omissão. Os PDFs não fixam comprimentos de texto: aplica-se limite JSON global de 100 KB. NUL e campos internos são rejeitados.

## Exemplos

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/atracoes?q=rio
Invoke-RestMethod http://localhost:3000/categorias
```

Resposta real de categorias:

```json
[
  {"id":1,"nome":"Histórico e Urbano","atracoes":4},
  {"id":2,"nome":"Lazer","atracoes":1},
  {"id":3,"nome":"Natureza e Aventura","atracoes":3}
]
```

Original sem avaliações: avaliacoes=[], notaMedia=null, totalAvaliacoes=0. No teste isolado, notas persistidas 5 e 4 resultaram em média 4.5 e total 2. A média usa aggregate no banco, sem arredondamento adicional.

Exemplo de escrita exclusivamente em banco de testes isolado, com segredo carregado no ambiente do terminal. Não executar na base principal:

```powershell
$headers = @{ Authorization = 'Bearer ' + $env:API_WRITE_TOKEN }
$body = @{ nome='Teste temporário'; categoria='Lazer'; descricao='Teste local'; tags=@() } | ConvertTo-Json
$nova = Invoke-RestMethod http://localhost:3196/atracoes -Method POST -Headers $headers -ContentType application/json -Body $body
$avaliacao = @{ visitante='Visitante teste'; nota=5; comentario=$null } | ConvertTo-Json
Invoke-RestMethod ("http://localhost:3196/atracoes/" + $nova.id + "/avaliacoes") -Method POST -Headers $headers -ContentType application/json -Body $avaliacao
Invoke-RestMethod ("http://localhost:3196/atracoes/" + $nova.id) -Method DELETE -Headers $headers
```

requisicoes.http preserva os exemplos anteriores, acrescenta Bearer ambiental e novas leituras/avaliação apenas no ID temporário. Não criar avaliações fictícias nas atrações originais.

## Testes

```powershell
npm test
npm run check
npm run test:integration
npm run test:lab08
npm run build
npm audit --cache .npm-cache
# Auditoria completa somente com as configurações privadas locais de teste disponíveis:
node scripts/verify-api-readiness.mjs
```

As integrações exigem backups/test-env.json e configuração privada separada de fixtures conforme docs/operacao-credenciais-administrativas.md. A preparação de banco é tarefa administrativa autorizada separadamente e não grava mais identidade administrativa na configuração runtime. Usam exclusivamente banco local com prefixo balsas_lab08_test_. O banco isolado desta entrega já está preparado e migrado. Em instalação nova, prepare backup/restauração e aplique as migrações com DATABASE_URL do banco de teste antes das suítes. Arquivos em backups contêm configuração privada e são ignorados no Git. Banco de teste mantido para reprodução.

Resultados históricos da preparação anterior (12/10/2026): **24 unitários, 80 integração, 39 Lab08 e 30 PowerShell aprovados**, zero falhas finais nas quatro suítes. São 173 casos de suítes parcialmente sobrepostas; repetições em instalação limpa não aumentam esse total. Mais 14 checks da configuração de produção passaram. Instalação limpa/build/schema/dependências e npm audit também aprovados. Evidências e a falha inicial do próprio harness corrigida estão no [relatório de prontidão](docs/estado-publicacao.md).

Na preparação anterior, principal preservada: 8 atrações, 15 tags, 32 associações, 3 categorias, 0 avaliações e duas migrações, hashes/FKs/backups conferidos nesta rodada. A senha administrativa antiga continua rejeitada; nenhuma senha/papel/grant foi alterado nesta preparação.

## Segurança e limitações

CORS exige origens exatas ou a política explícita none em produção; não substitui Bearer. Token é compartilhado, sem identidade individual: nunca colocar em frontend público. JSON limitado a 100 KB, entradas validadas e consultas Prisma parametrizadas. Logs são sanitizados; não configurar DEBUG=prisma* nem imprimir variáveis privadas em produção.

Runtime remove credenciais de administração/migração do ambiente após dotenv. Remote produção exige sslmode=verify-full e rejeita parâmetros URI que sobrescrevem host/identidade/TLS. Driver pg 8.16.3 não interpreta channel_binding=require como obrigação libpq; use o exemplo específico desta aplicação, sem esse parâmetro. TLS/certificado real precisa ser testado no destino.

Não há rate limiting ou teto operacional pequeno de paginação, nem SLA. A causa histórica do ECONNRESET permanece inconclusiva. Free tem suspensão/cold start/limites e não é garantia operacional de produção. Ver [guia](docs/guia-publicacao-final.md).

## Publicação preparada, não executada

O [repositório GitHub](https://github.com/Francisco-alt-coder/-Balsas-Experience-API) está público e vazio. Origin foi configurado localmente para esse destino; branch main, zero commits e index local preparado com 112 arquivos. Pacote e manifesto de 112 arquivos preparados em backups/publicacao/prompt-mestre-20261013, ignorados pelo Git. Commit/push e divulgação aguardam aprovação específica. O JSON público de oito atrações está incluído; PDFs, .env, credenciais, backups e logs privados estão excluídos.

Render preparado: Node 24.20.0, Web Service Free/Virginia, build `npm ci --include=dev && npm run build`, start `npm start`, NODE_ENV=production, HOST=0.0.0.0, PORT da plataforma e health /health. .env.render.example usa CORS_ORIGINS=none. Token novo foi preparado somente no armazenamento privado local. DATABASE_URL de produção e acesso Render ainda faltam. **DIRECT_URL só no operador**, nunca no serviço web. render.yaml.example permanece modelo inativo, sem deploy automático.

Neon requer conexão direta inicialmente, com role runtime própria e TLS verify-full; pooler está desabilitado. Schema/ledger estão ausentes e a role runtime proposta não existe. O [plano remoto](docs/plano-integracao-remota.md) registra revisão SQL, riscos, backup e recuperação necessários antes das autorizações de migração, privilégios e carga. Nenhuma transferência automática do banco local, migração ou seed em build/start.

Prisma validate/generate/check e migrate status local passaram. Codex Security não concluiu; a alternativa ESLint + eslint-plugin-security executou e seus avisos/limitações estão no relatório. O workflow de unitários Linux foi preparado e ainda não executado. Não há URL pública da API validada.

Após eventual deploy autorizado, configurar PUBLIC_API_URL real HTTPS e executar `node scripts/test-public-readonly.mjs`; completar testes remotos de TLS, privilégios, persistência, cold start e sinais. Escritas remotas somente em ambiente autorizado e isolado.

- [Instalação](docs/guia-instalacao.md), [testes](docs/guia-testes.md), [endpoints](docs/endpoints.md) e [recuperação](docs/guia-recuperacao.md).
- [Prisma/Neon](docs/guia-prisma-neon.md), [plano remoto](docs/plano-integracao-remota.md) e [procedimento de publicação](docs/guia-publicacao-final.md).
- [Rastreabilidade acadêmica](docs/matriz-rastreabilidade-academica.md), [uso de IA](docs/registro-uso-ia.md) e [relatório final](docs/relatorio-final-pendencias-publicacao.md).
