# Prisma 7.10.0 e Neon

Estado vigente em 13/10/2026: [relatório final](relatorio-final-pendencias-publicacao.md) e [plano remoto](plano-integracao-remota.md). Local: 196 casos aprovados, validate/generate/check e status de duas migrações atualizado. Neon: conector READ ONLY confirma public vazio/ledger ausente/role runtime inexistente; transporte TLS aprovado sem autenticação do aplicativo. DIRECT_URL privada vazia: CREDENCIAL_NEON_PENDENTE. Nenhuma migração/carga/grant remoto executado. Pooler desabilitado: conexão direta inicialmente; runtime precisa de role própria. Token privado preparado; CORS_ORIGINS=none sem frontend publicado; DATABASE_URL remota ausente. .env/SQL/dados locais preservados. Registros/procedimentos datados abaixo são históricos; diagnósticos antigos de projeto/arquivo ausente ou executor restrito não representam o bloqueio atual.


Estado vigente em 13/10/2026: ver a [auditoria final das pendências](relatorio-final-pendencias-publicacao.md). 192 testes locais passaram; URL privada continua vazia, portanto autenticação local ao Neon está BLOQUEADA. Transporte TLS e consultas pelo conector passaram separadamente; schema/ledger remotos ausentes. As seções de rodadas anteriores são registros históricos. O relatório vigente inclui regressões dos loaders, snapshots e limpeza, resultados reais, prioridades e plano futuro das duas migrações.

CLI configurada em prisma7.config.ts: schema prisma/schema.prisma, migrations prisma/migrations e url DIRECT_URL || DATABASE_URL. Schema contém provider postgresql; URL não fica no datasource Prisma. Runtime instancia PrismaClient com PrismaPg(configurarBanco()), usando DATABASE_URL; pool/timeouts são do driver pg, não parâmetros v6 na URL.

Versões CLI, Client e adapter fixadas em 7.10.0. Gerador prisma-client-js foi mantido; o Client é gerado no build. Configuração pooled runtime e direta operador está preparada nos exemplos. Node pg por TCP é adequado ao Web Service; não é necessário substituir por WebSocket/serverless.

Migrações existentes: 20261011200553_init e 20261012140000_categorias_avaliacoes. Seus bytes/checksums são preservados pelo atributo -text no Git. Não editar arquivos já aplicados. validate/status são somente leitura; migrate deploy escreve e exige aprovação de destino.

Escolha de importação e grants mínimos detalhada no [guia de publicação](guia-publicacao-final.md): restore completo em vazio preserva schema/dados/ledger e precede status; migrate deploy em vazio é alternativa sem transferência. Não rodar ambos para recriar o mesmo schema.

TLS real, versão PostgreSQL remota, certificado, quotas, pooler, memberships e ownership serão confirmados na infraestrutura autorizada futura. Os loaders administrativos locais são restritos ao cluster local e não devem ser usados para Neon.

## Verificação de configuração — 13/10/2026

Inspeção sanitizada de `.env` e das credenciais de isolamento principal/testes: todas as URLs existentes apontam para loopback PostgreSQL local, sem `sslmode`. Nenhuma URL Neon apareceu no ambiente do processo; nenhum arquivo `.neon` foi encontrado no projeto. Os arquivos `.env.render.example` e `.env.migration.example` são modelos com placeholders. Isso não prova ausência de projeto na conta Neon; prova ausência de destino Neon verificável nas configurações examinadas. Nenhuma conexão remota foi tentada, nenhuma tabela remota foi declarada presente.

Prisma CLI, Client e adapter-pg estão fixados em 7.10.0; pg em 8.16.3. A configuração atual preserva Express/Prisma/pg por TCP. Runtime usa `DATABASE_URL`; CLI usa `DIRECT_URL || DATABASE_URL`. Neste projeto, `DATABASE_URL_UNPOOLED` não é consumida: a URL direta obtida do Neon precisa ser armazenada como `DIRECT_URL` no ambiente privado do operador. Não colocar esse segredo no serviço Render.

Produção remota exige `sslmode=verify-full`. O parser instalado do pg habilita TLS sem desativar validação de certificado/hostname nesse modo; a negociação real só pode ser confirmada com o destino. A validação da aplicação aceita apenas `schema`, `sslmode`, `application_name` e `connect_timeout`; não copiar `channel_binding=require`, `pgbouncer=true` ou parâmetros de pool do Prisma 6. Não contornar certificados usando `rejectUnauthorized=false` ou `NODE_TLS_REJECT_UNAUTHORIZED=0`. A URL local sem TLS não valida a segurança remota.

## Procedimento Neon somente leitura

1. Selecionar um projeto, branch, endpoint e database existentes e confirmar o destino no console Neon. Não criar recursos nesta etapa. Obter a URL privada de uma role existente com CONNECT, USAGE no schema e SELECT nas tabelas/metadados necessários, preferencialmente sem grants de escrita. Se não existir essa role, sua criação exige autorização separada.
2. Fornecer `NEON_READONLY_URL` ao processo por mecanismo privado de ambiente, sem colar segredo em comandos, chat, logs ou arquivos públicos. Usar URL PostgreSQL Neon com `sslmode=verify-full`; preferir endpoint direto. O script não lê `.env`, não substitui `DATABASE_URL` e não usa backups locais.
3. Da raiz da API, executar `node scripts/verify-neon-readonly.mjs`. Sem variável, ele falha antes de conectar. Destino local, host fora de `ep-*.neon.tech`, parâmetros incompatíveis e TLS inadequado são recusados. Remover a variável privada da sessão depois do uso.
4. O script abre `BEGIN READ ONLY`, limita consultas a 10 segundos, confirma `transaction_read_only` e TLS em `pg_stat_ssl`, verifica as cinco tabelas do schema Prisma e `_prisma_migrations`, e compara o ledger com SHA-256 dos dois arquivos SQL locais. Encerra com ROLLBACK. Não executa DDL/DML, seed, restore ou comandos Prisma de migração. Não consulta linhas da aplicação nem imprime URL/usuário/senha.
5. Código 0: tabelas esperadas e migrações concluídas com checksum correspondente. Código 2: tabelas/ledger ausentes ou migração divergente/inacabada. Código 1: variável, validação, acesso ou conexão falhou; a saída contém somente código sanitizado. Presença de tabelas/ledger não comprova equivalência completa de colunas, constraints, grants ou integridade dos dados; essas verificações continuam necessárias antes da publicação. O probe pode acordar compute suspenso e consumir pequena quota, embora não altere dados persistentes.

Não executar `migrate dev`, `migrate deploy`, `db push`, seed ou restore para corrigir um resultado durante esta verificação. As migrações locais são `20261011200553_init` e `20261012140000_categorias_avaliacoes`; sua existência local não demonstra aplicação remota.

## Configurações que faltam para Neon e Render Free

| Configuração | Situação / ação necessária |
|---|---|
| Destino Neon | Identificar projeto/branch/database/endpoint existentes; nenhum foi verificado nesta rodada |
| `DATABASE_URL` remota | URL real da role runtime, preferencialmente pooled (`-pooler`), com `sslmode=verify-full`, no ambiente privado Render |
| `DIRECT_URL` remota | URL direta e role de migração, somente no ambiente privado do operador; necessária para o fluxo seguro de migrações futuras |
| `NEON_READONLY_URL` | URL privada apenas para o probe; não é variável necessária da API nem do Render |
| Schema/grants remotos | Confirmar tabelas, ledger/checksums e permissões; qualquer criação ou transferência exige autorização separada |
| `API_WRITE_TOKEN` | Gerar/configurar segredo forte exclusivo de produção, pelo menos 32 caracteres; não reutilizar token local |
| `CORS_ORIGINS` | Substituir placeholder pelas origens HTTPS reais autorizadas |
| Configuração Render | Selecionar conta, região, repositório e raiz que contém package.json; modelo assume raiz de repositório dedicado |
| Runtime Render | `NODE_ENV=production`, `HOST=0.0.0.0`, `NODE_VERSION=24.20.0`; PORT fornecida pela plataforma |
| Pool/timeouts | Defaults já preparados: 10 conexões, conexão 5000 ms, consulta 10000 ms; medir cold start remoto antes de ajustar |
| Build/start/health | `npm ci --include=dev && npm run build`; `npm start`; `/health`; modelo `render.yaml.example` permanece inativo |

Render Free não oferece pre-deploy command; eventual preparação autorizada do schema deve ser feita separadamente, nunca no build/start. Serviços gratuitos suspendem após inatividade e têm cotas; são adequados à demonstração conforme os limites vigentes, sem garantia de disponibilidade contínua. Referências: [Render Free](https://render.com/docs/free), [Express no Render](https://render.com/docs/deploy-node-express-app), [Prisma no Neon](https://neon.com/docs/guides/prisma).

Nesta rodada não foram alterados código de runtime, schema, migrações, configurações privadas ou testes. Os 173 resultados anteriores permanecem como evidência histórica da auditoria local, sem alegação de reexecução integral ou validação remota. Não houve criação/substituição de banco, migração de dados, commit, push ou deploy.

## Tentativa de integração com destino existente — 13/10/2026

Classificação: **BLOQUEADA por ausência de destino/credenciais Neon acessíveis**, sem evidência de falha do serviço Neon.

A nova busca sanitizada incluiu `.env`, arquivos de credenciais em backups administrativos e de isolamento, modelos e ambiente do processo. Somente conexões locais foram encontradas; os modelos continuam placeholders. Neon CLI não foi encontrado no PATH. O conector Neon respondeu `[]` tanto a `list_projects({search: "balsas", limit: 20})` quanto a `list_projects({limit: 50})`. Isso descreve o acesso da conexão atual, não prova que o projeto do operador inexista em outra conta/organização.

Comandos executados: `node --check scripts/verify-neon-readonly.mjs` (sucesso) e `node scripts/verify-neon-readonly.mjs` (código 1, `NEON_READONLY_URL_MISSING`, antes de qualquer conexão). Não foi configurada URL fictícia nem substituída a URL local para aparentar integração. Não foram executados Prisma migrate status remoto, introspecção, comparação de schema ou GETs contra uma instância conectada ao Neon, pois dependem do destino confirmado.

Render foi conferido por inspeção: build/start do modelo correspondem ao package.json; app usa `process.env.PORT`, host de produção 0.0.0.0 e `/health` com SELECT 1. Prisma CLI/Client/adapter permanecem 7.10.0. A exigência TLS verify-full permanece ativa. Token exclusivo e origens reais de produção não foram fornecidos/configurados nesta rodada. Nenhum serviço Render foi criado.

Para retomar: operador informa o caminho privado das URLs e os identificadores não secretos do projeto/branch/database/endpoint, ou disponibiliza essas configurações em ambiente privado acessível. Usar ambientes separados para runtime e operador, preservando `.env` local. Primeiro confirmar destino/TLS e metadados; depois verificar permissões, identificação do banco e compatibilidade completa de colunas/constraints, status Prisma e leituras da API. O probe atual cobre TLS, presença de tabelas e checksums locais; não cobre sozinho todos esses requisitos. Se houver divergência, registrar diferenças, backup/plano de recuperação e proposta de correção antes de solicitar autorização para migração. Nenhuma escrita remota está autorizada nesta rodada.

Verificação adicional executada: `node --test tests/production-database.test.mjs tests/health.test.mjs tests/runtime-env.test.mjs` — **9 testes passaram, zero falhas**. Cobrem configuração de TLS/pooling, remoção de segredos administrativos e health/erros com cliente simulado (falha sanitizada 500; live 200). Não constituem prova de conectividade Neon nem reexecução dos 173 testes históricos.

## Preparação solicitada nos anexos — 13/10/2026

Os dois anexos recebidos eram idênticos. A conexão Neon foi conferida novamente: plugin instalado/habilitado; `list_organizations` identificou Wesley com `plan: free`. `list_projects({limit: 50})` e nova consulta com organização explícita retornaram `[]`. A autenticação para esses metadados funciona, mas não há projeto acessível; não é possível distinguir projeto inexistente de projeto em outra conta/organização ou fora do escopo dessa conexão. Permissão de criação não foi exercida. O navegador de automação retornou lista vazia, portanto o painel não pôde ser inspecionado. Nenhuma infraestrutura foi criada.

### Plano concreto para criação futura, ainda não autorizado

| Campo | Proposta |
|---|---|
| Organização | Wesley, plano Free informado pela API |
| Projeto | `balsas-experience-api` |
| Database | `balsas_experience` |
| Branch | `main` |
| PostgreSQL | 18, suportado pelo Neon e mesmo major do ambiente local histórico; minor gerenciado pelo Neon |
| Região | `aws-us-east-1` (N. Virginia), disponível na consulta autenticada; futuro Render em Virginia |
| Compute | 0.25 CU inicial, suspensão após 300 s de inatividade; sem desabilitar scale-to-zero |
| Recursos | Somente Postgres e endpoint padrão; sem ativar serviços adicionais ou mudar o plano |

Antes da execução, confirmar no painel que a organização permanece Free, há quota disponível e as opções não exigem upgrade. A documentação pública consultada informa 100 projetos, 100 CU-h/mês por projeto e 1 GB de armazenamento por projeto; a disponibilidade efetiva da conta continua sujeita ao painel. [Neon Pricing](https://neon.com/pricing), [versões PostgreSQL](https://neon.com/docs/postgresql/postgres-version-support), [regiões Render](https://render.com/docs/regions). A proposta de região aproxima os dois provedores; latência real será medida posteriormente. Se houver projeto já existente em outra conta, priorizar sua identificação antes de criar um duplicado.

A autorização de criação deverá abranger somente o projeto, branch, database e endpoint padrão acima. Migrações, grants/roles adicionais e transferência de dados continuam operações separadas. Após criar ou localizar o destino: confirmar IDs, plano, versão, região e estado do compute, configurar segredos em ambientes privados separados e executar o probe. Role runtime deve ter somente os direitos necessários de leitura/escrita nas tabelas e USAGE nas sequências, sem ownership/DDL/TRUNCATE/administração; migrador separado, limitado ao schema da API. Uma role de auditoria pode usar somente CONNECT, USAGE e SELECT quando disponível. Não reutilizar senha local nem publicar a credencial owner no runtime.

### Estrutura existente e migrações preservadas

| Tabela | Colunas / chaves |
|---|---|
| `atracoes` | id SERIAL PK; nome/categoria/descricao/cidade/estado TEXT; categoriaId INTEGER FK obrigatória; distanciaCentroKm DOUBLE PRECISION opcional; criadoEm/atualizadoEm TIMESTAMP(3). Índices categoria, categoriaId, cidade |
| `categorias` | id SERIAL PK; nome/chave TEXT únicos; referenciada por atracoes, DELETE RESTRICT |
| `avaliacoes` | id SERIAL PK; visitante TEXT; nota INTEGER CHECK 1..5; comentario TEXT opcional; criadaEm TIMESTAMP(3); atracaoId INTEGER FK/índice, DELETE CASCADE |
| `tags` | id SERIAL PK; nome TEXT único |
| `atracao_tags` | PK composta atracaoId/tagId; duas FKs DELETE CASCADE, índice tagId; associação N:N explícita |

As FKs usam UPDATE CASCADE. Datas, defaults e nullability permanecem conforme SQL e schema. `_prisma_migrations` é o ledger do Prisma, não uma entidade da aplicação. Check adicional da nota está no SQL histórico e não é representado diretamente no modelo Prisma.

| Migração | SHA-256 dos bytes locais |
|---|---|
| `20261011200553_init` | `d7850ea6c25a735a435e99e65bc54d503057b85a135800c9769afb189746539e` |
| `20261012140000_categorias_avaliacoes` | `b4fd8165612a4eb2895ddaaca143a6534331173f340c99636bd6d2fe2f41fea2` |

A primeira cria atrações/tags/associação; a segunda cria categorias/avaliações e normaliza categorias existentes por INSERT/UPDATE antes de tornar categoriaId obrigatório. Nenhum SQL histórico foi alterado. Se o destino estiver vazio, após autorização específica aplicar as duas migrações com `npm run db:migrate:deploy` no ambiente privado direto; não executar seed/restore junto automaticamente. Banco vazio conectado continua com integração PENDENTE. Se houver tabelas, comparar catálogo, ledger e checksums; divergências exigem proposta revisada, backup e autorização antes de qualquer escrita. Não usar reset, force-reset, db push, edição de migrações aplicadas ou baseline fictício para mascarar divergências.

### Probe ampliado e resultados locais atuais

O script continua sem carregar `.env` ou executar DML/DDL. Usa `BEGIN READ ONLY`, `SET LOCAL statement_timeout`, consultas de metadados e `ROLLBACK`. Agora verifica também `socket.authorized`, certificado/hostname com `tls.checkServerIdentity`, database correspondente à URL, versão PostgreSQL, capacidades da role, permissões de tabelas e sequências, colunas/constraints/índices e migrações inesperadas. `NEON_EXPECTED_DATABASE` opcional permite confirmar o nome esperado independentemente da URL. Recusa `NODE_TLS_REJECT_UNAUTHORIZED=0`. Não imprime nome de usuário, senha, URL ou conteúdo de linhas da aplicação; os relatórios operacionais devem permanecer privados, especialmente se defaults remotos contiverem informações privadas.

O parser pg instalado habilita TLS e conserva validação para verify-full; o driver envia servername ao Node TLS. Isso foi inspecionado no código instalado, e os controles de recusa foram testados com pg simulado. Não há prova de handshake real. Código 0 confirma metadados básicos, não aprova sozinho grants mínimos, schema completo ou integração API; o relatório mantém `INVENTORY_REQUIRES_SCHEMA_REVIEW`. Código 2 também sinaliza falta de SELECT/USAGE ou migrações inesperadas. Schema completo e capacidades herdadas exigem revisão antes de aprovar permissões. Identificadores de projeto/branch devem ser confirmados pela API Neon, não deduzidos somente da URL SQL.

| Comando efetivamente executado nesta tarefa | Resultado |
|---|---|
| `node node_modules/prisma/build/index.js validate --config prisma7.config.ts` | Schema válido, código 0 |
| `node node_modules/prisma/build/index.js generate --config prisma7.config.ts` | Client 7.10.0 gerado, código 0; sem alteração de banco |
| `npm run check` | Sintaxe aprovada, código 0 |
| `node --test tests/*.test.mjs` | 24 passaram, zero falhas; sem testes destrutivos remotos |
| `node --check scripts/verify-neon-readonly.mjs` | Sintaxe aprovada |
| `node scripts/verify-neon-readonly.mjs` | Código 1, NEON_READONLY_URL_MISSING, sem conexão |
| `node tmp/neon-probe-qa/run.mjs` | 3 cenários simulados passaram: certificado não autorizado/hostname divergente recusados; banco vazio reportou conectado em simulação e código 2, sem ledger/tabelas |

Os arquivos QA ficam em `tmp/` ignorado pelo Git, usam uma URL fictícia e driver simulado sem acesso de rede. Os 24 testes atuais e os 3 cenários adicionais não substituem os 173 resultados históricos nem comprovam TLS remoto. Não foi executado status Prisma remoto, inventário remoto, migração ou leitura HTTP conectada ao Neon.

### Relatório de preparação

| Verificação | Resultado | Evidência |
|---|---|---|
| Autenticação Neon | APROVADO | Organização Wesley e regiões retornadas, sem erro |
| Projeto Neon | BLOQUEADO | Zero projetos globais e na organização explícita |
| Plano gratuito | APROVADO para organização / PENDENTE no painel | API informou Free; quotas públicas consultadas; nenhum projeto criado |
| Branch / database / endpoint / compute / versão remota | NÃO VERIFICADO | Dependem de projeto acessível |
| Conexão PostgreSQL remota | BLOQUEADO | URL remota ausente; probe recusou antes de conectar |
| TLS remoto | NÃO VERIFICADO | Apenas inspeção do driver e testes simulados |
| Prisma Client | APROVADO localmente | Client gerado e schema válido, versão 7.10.0 preservada |
| Migrações | APROVADO localmente / NÃO VERIFICADO remotamente | Dois arquivos e hashes preservados |
| Tabelas / permissões / compatibilidade schema remoto | NÃO VERIFICADO | Catálogo remoto indisponível |
| Render | PENDENTE | Build/start/PORT/health preparados; Linux real, serviço, segredos e CORS ainda pendentes |
| Segurança | APROVADO nos controles locais / NÃO VERIFICADO remotamente | 24 testes; probe sem escritas; sem credenciais públicas introduzidas; GitHub remoto não auditado nesta tarefa |

Render continuará com `DATABASE_URL` runtime pooled TLS, `API_WRITE_TOKEN` exclusivo, `CORS_ORIGINS` HTTPS reais, `NODE_ENV=production`, `HOST=0.0.0.0`, `NODE_VERSION=24.20.0` e limites DB já definidos. PORT da plataforma, sem DIRECT_URL no serviço. Build `npm ci --include=dev && npm run build`, start `npm start`, health `/health`; runtime não depende de ferramentas administrativas Windows. Execução Linux não foi comprovada. Free é para demonstração/testes, suspende por inatividade e tem cotas; não equivale a garantia de produção. [Render Free](https://render.com/docs/free).

## Projeto criado pelo operador: verificação atual em 13/10/2026

Esta seção substitui o diagnóstico anterior de ausência de projeto. Nenhum projeto foi criado por esta tarefa.

| Identificador não secreto | Valor confirmado pela API Neon |
|---|---|
| Organização / plano | Wesley / Free |
| Projeto | `balsas-experience-api` / `little-surf-82939047` |
| Branch principal e default | `main` / `br-steep-violet-b8t7my2h`, estado ready |
| Database / role disponível | `balsas_experience` / `balsas_experience_owner` |
| Endpoint direto | `ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech` |
| Endpoint ID / região | `ep-patient-brook-b88gj2rm` / `aws-us-east-1` |
| Compute | read_write, active, enabled, min/max 0.25 CU |
| Pooler | `pooler_enabled=false`, modo anunciado transaction; não habilitado nem testado nesta tarefa |
| Suspensão | API retornou `suspend_timeout_seconds=0`; efeito real na política Free não foi testado nem modificado |
| PostgreSQL | projeto major 18; SQL retornou `18.6 (c021049)` |

Foram consultados describe_project, list_branches, list_postgres_databases, list_postgres_endpoints, list_postgres_roles e list_organizations. A URL foi obtida pelo get_connection_string oficial sem ser impressa. O resultado apontou ao hostname pooled apesar de pooler_enabled=false e incluía channel_binding. Foi preparado em memória o hostname direto confirmado pela API, mantendo database/role/credencial oficial, removendo channel_binding (não suportado pelo validador atual) e usando sslmode=verify-full. Nenhuma configuração remota foi alterada para resolver essa divergência. DATABASE_URL futura deverá ser direta enquanto o pooler permanecer desabilitado; pooled somente após autorização/configuração e verificação independente de funcionamento.

### SQL remoto realmente executado, sem escritas

Duas transações do conector usaram `SET TRANSACTION READ ONLY` e `SET LOCAL statement_timeout = '10s'`, seguidas apenas de SELECTs de metadados. As consultas verificaram current_database, server_version, identidade owner, transaction_read_only, has_database_privilege, has_schema_privilege, pg_stat_ssl, pg_class/pg_namespace, to_regclass, pg_roles e pg_auth_members. Não executaram DDL/DML ou leitura de registros da aplicação.

Resultados: database correto; transaction_read_only=on; CONNECT/CREATE de banco e USAGE/CREATE no public disponíveis. O único schema de usuário encontrado foi public, com zero tabelas, views, materialized views, sequências e foreign tables. `_prisma_migrations` está ausente. Logo as cinco tabelas esperadas e o ledger ainda não existem, e não há checksums remotos para comparar. As duas migrações locais documentadas acima permanecem pendentes em ordem cronológica. Não há divergência de schema existente a corrigir: há estrutura a criar futuramente, após autorização específica.

A role disponível é owner, sem superuser direto, mas com CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS e membership neon_superuser. Serve para diagnóstico privado do operador; não é a credencial final adequada ao runtime. Nenhuma role/grant foi criada ou alterada. Permissões mínimas da aplicação, separação efetiva de identidades e direitos de tabela/sequência não podem ser aprovados enquanto a estrutura/roles correspondentes estiverem ausentes.

pg_stat_ssl retornou `ssl=false`, version null, na sessão do conector. A conexão usada pelo conector não fornece evidência da sessão TCP do driver pg da aplicação nem da validação do certificado/hostname nesse driver. Não desabilitar TLS com base nesse resultado. A configuração da aplicação continua exigindo verify-full.

Foi realizada uma verificação independente real de transporte, fora do sandbox e **sem enviar usuário ou senha**: conexão net na porta 5432 do host direto confirmado, SSLRequest gerado por pg-protocol, resposta SSL suportada, tls.connect com servername, rejectUnauthorized=true e configuração SSL extraída do pg.Client usando configurarBanco/verify-full. O resultado foi TCP=true, TLSv1.3, certificateAuthorized=true, hostnameVerified=true e authenticationSent=false. O hostname foi reconferido com tls.checkServerIdentity. Assim o transporte/certificado/hostname do endpoint direto está APROVADO, mas a autenticação PostgreSQL e o SQL pelo probe local continuam não comprovados. O ssl=false do conector não foi usado para contornar segurança; o teste direto comprovou separadamente a disponibilidade de TLS no endpoint.

### Limitação do executor e procedimento preciso para retomar

O probe existente foi revisado: somente controles de transação e consultas de catálogo; nenhuma escrita remota. Uma tentativa real local, com credencial oficial mantida em memória privada, endpoint direto e verify-full, terminou em código 1 / EACCES. Isso é bloqueio de acesso do executor restrito, não evidência de senha inválida ou falha do Neon; o teste TCP/TLS independente fora do sandbox passou. A tentativa de salvar privadamente pela sessão sandbox encontrou EPERM. O envio subsequente por entrada de terminal foi rejeitado pela revisão automática porque poderia incluir a credencial no registro da ferramenta. A ação não foi repetida nem contornada. Nenhum arquivo de credencial foi salvo e as referências temporárias ao segredo foram descartadas; o helper de entrada foi encerrado.

A pasta `backups/neon` foi preparada com ACL Windows protegida, sem herança e com acesso do operador atual; backups é ignorado pelo Git. Ela permanece sem credencial. Não modificar o `.env` PostgreSQL local para este teste.

1. No console Neon oficial, selecionar exatamente projeto/branch/database/role identificados acima. Em Connect, desmarcar pooling; conferir o host direto. Não copiar a URL por chat ou linha de comando com segredo.
2. Pelo editor local do operador, criar `backups/neon/operator-credentials.private.json` no diretório protegido, usando o formato abaixo. Substituir o placeholder exclusivamente no arquivo privado por URL oficial com `sslmode=verify-full`, mantendo username/password codificados corretamente e removendo `channel_binding`, sem reutilizar senha local. Não carregar esse arquivo no processo Express nem no Render.

```json
{"DIRECT_URL":"<URL DIRETA PRIVADA DO CONSOLE NEON>"}
```

3. Da raiz da API, em terminal local com acesso à rede, executar o comando sem credencial nos argumentos:

```powershell
node scripts/verify-neon-operator-readonly.mjs
```

O novo loader lê somente esse arquivo, valida host/database/TLS, cria um ambiente isolado para verify-neon-readonly e confirma major 18. Não carrega `.env`, não inicia a API, não faz fallback para credenciais locais, não imprime segredo nem o passa por argumentos/linha de comando. No Codex, uma execução com rede fora do sandbox poderá precisar de revisão de aprovação; o arquivo deve existir antes da retomada. Sem arquivo válido, retorna NEON_OPERATOR_FILE_OR_EXECUTION_FAILED. Não contornar EACCES, EPERM ou certificados desabilitando proteções.

4. Resultado esperado no banco ainda vazio: conexão/TLS/identidade confirmados pelo probe, mas código 2 por tabelas/ledger ausentes; integração da API continua PENDENTE. Somente depois de validar TLS e revisar o destino solicitar migração separadamente. Não aplicar migrate deploy, seed, restore ou db push nesta rodada.

Os guards adicionais `NEON_EXPECTED_HOST` e `NEON_EXPECTED_PG_MAJOR` permitem confirmar endpoint e versão no probe; o loader os define para este destino. O script não aprova sozinho compatibilidade completa, grants mínimos ou API em funcionamento.

### Verificações locais desta tarefa e configurações restantes

Executados com sucesso: `node node_modules/prisma/build/index.js validate --config prisma7.config.ts`, `node node_modules/prisma/build/index.js generate --config prisma7.config.ts`, `npm run check`, `node --test tests/*.test.mjs` (**24 aprovados, zero falhas**), `node --check` nos dois probes e `node tmp/neon-probe-qa/run.mjs` (**3 cenários simulados aprovados**). O loader sem arquivo privado falhou preventivamente com código sanitizado. A primeira preparação do harness de testes falhou por codificação de regex Unicode no PowerShell; foi corrigida no comando, e a execução final passou sem alterar testes da API. As 173 verificações anteriores não foram reexecutadas integralmente. Checksums das duas migrações permanecem iguais aos registrados acima.

Arquivos analisados: package.json, prisma7.config.ts, schema/migrations, src/lib/prisma.js, database-config.js, load-runtime-env.js, runtime-env.js, app.js, health.controller.js, exemplos de ambiente, render.yaml.example e documentação. Arquivos alterados: verify-neon-readonly.mjs (guards de endpoint/major), novo verify-neon-operator-readonly.mjs (loader privado), README.md, estado-publicacao.md e este guia. Nenhuma alteração funcional no runtime, schema, migrações, `.env`, dados locais/remotos ou documentos acadêmicos.

Local: DATABASE_URL local e API_WRITE_TOKEN local continuam no ambiente existente; DIRECT_URL local opcional para CLI. Testes de integração/lab usam configurações locais isoladas e TEST_FIXTURE_DATABASE_URL quando aplicável; não executar essas suítes com URL Neon. Produção futura: DATABASE_URL da role runtime (direta inicialmente, pooled somente quando comprovado), API_WRITE_TOKEN exclusivo, CORS_ORIGINS HTTPS reais, NODE_ENV=production, HOST=0.0.0.0, NODE_VERSION=24.20.0; PORT da plataforma. DB_POOL_MAX=10, DB_CONNECTION_TIMEOUT_MS=5000 e DB_QUERY_TIMEOUT_MS=10000 são defaults preparados, a ajustar somente por medição. DIRECT_URL somente no ambiente privado administrativo. Prisma CLI usa DIRECT_URL || DATABASE_URL; runtime usa DATABASE_URL via PrismaPg, sem troca de arquitetura.

Express preserva PORT, health com SELECT 1, resposta sanitizada 500 e encerramento com disconnect em SIGINT/SIGTERM. Build/start existentes: `npm ci --include=dev && npm run build` / `npm start`. Linux/Render e leituras HTTP reais conectadas ao Neon não foram executados. Não houve configuração de Render, alteração do pooler ou suspensão, migração, transferência, commit, push ou deploy.

| Componente | Status | Evidência | Pendência |
|---|---|---|---|
| Projeto Neon | APROVADO | ID/nome/organização confirmados | Nenhuma criação necessária |
| Branch main | APROVADO | ready, primary/default | Nenhuma |
| Database | APROVADO | SQL real identificou balsas_experience | Estrutura da API |
| Compute | APROVADO | active, min/max 0.25 CU | Confirmar política efetiva de suspensão |
| Conexão direta da aplicação | BLOQUEADO | Probe local EACCES | Arquivo privado do operador e execução com rede autorizada |
| Conexão pooled | PENDENTE | pooler_enabled=false | Não selecioná-la; nenhuma habilitação autorizada |
| TLS direto | APROVADO para transporte | Handshake real TLSv1.3, certificado/hostname válidos, sem autenticação | Confirmação também na sessão autenticada do probe |
| Prisma Client | APROVADO localmente | 7.10.0 gerado, schema validado | Validação remota futura |
| Schema remoto | PENDENTE | public vazio comprovado | Aplicação autorizada de estrutura |
| Migrações | PENDENTE | Ledger ausente; dois hashes locais preservados | Aprovação separada das duas migrações |
| Permissões | PENDENTE | Somente owner administrativo disponível | Role runtime/grants mínimos após autorização própria |
| API Express | APROVADO localmente | Sintaxe e unitários, arquitetura preservada | Leituras reais após preparação do Neon |
| Testes locais | APROVADO | 24 unitários + 3 simulações atuais | 173 são históricos |
| Preparação Render | PENDENTE | Comandos/PORT/health preparados | TLS, estrutura, role runtime, segredos/CORS e publicação autorizada |

Integração completa **PENDENTE**, com probe autenticado local **BLOQUEADO**. Transporte TCP/TLS direto e consultas reais via conector foram aprovados separadamente, sem comprovar funcionamento da API contra o Neon. O teste TLS adicional foi executado como JavaScript via `node --input-type=module` lendo o código de stdin, sem credenciais no código, argumentos ou rede de autenticação.

## Verificação de credenciais — 13/10/2026 (estado vigente)

Integração autenticada PENDENTE. O executor restrito retorna NEON_OPERATOR_FILE_PERMISSION_DENIED. Com acesso ampliado, o arquivo backups/neon/operator-credentials.private.json já existe, é legível e contém DIRECT_URL string vazia; tem BOM UTF-8, causa do erro de JSON. Foi preservado sem sobrescrita. Ausência de arquivo não corresponde ao estado encontrado nesta rodada.

Loader corrigido para aceitar BOM e distinguir arquivo ausente, permissão, JSON inválido, propriedade ausente, tipo/valor inválido, protocolo, endpoint/porta, database, autenticação configurada, TLS e parâmetros. Probe mantém BEGIN READ ONLY e ROLLBACK, agora com erros específicos de autenticação, TLS, conexão, permissão e consulta. Caminhos são relativos a import.meta.url; .env não é carregado pelo probe.

Git: check-ignore -v --no-index confirmou .gitignore:12:backups/. git ls-files backups '*private*' '.env' não retornou arquivos rastreados. Nenhuma alteração no .gitignore foi necessária.

Metadados oficiais confirmados pelo conector: Wesley/Free, projeto little-surf-82939047, branch main/br-steep-violet-b8t7my2h, database balsas_experience, PostgreSQL configurado 18, endpoint ep-patient-brook-b88gj2rm, aws-us-east-1, 0.25 CU, pooler desabilitado. Role proprietária existente confirmada por metadados; autenticação TCP dessa role não foi testada. Não há mecanismo verificado para transferir a credencial ao arquivo sem registros de ferramenta; nenhuma URL real foi obtida nesta rodada.

Ação do operador: abrir o JSON privado no editor local e preencher DIRECT_URL com a conexão direta oficial do projeto existente, database correto e sslmode=verify-full. Salvar preferencialmente UTF-8 sem BOM. Não enviar URL/senha ao chat nem colocar em comandos. Executar node scripts/verify-neon-operator-readonly.mjs da raiz da API, em sessão com acesso à pasta privada. Resultado atual com acesso: código 1, NEON_OPERATOR_DIRECT_URL_EMPTY, antes de conectar. Não desabilitar TLS; parâmetros incompatíveis, inclusive channel_binding, continuam recusados conforme o guia existente. Banco vazio pode retornar código 2 após conexão bem-sucedida: schema/ledger pendentes, sem criação automática. Autenticação, TLS, certificado, hostname, versão SQL, consultas, permissões e schema remoto NÃO VERIFICADOS nesta rodada.

Validação: Node 24.20.0; npm ls confirmou Prisma CLI/Client/adapter-pg 7.10.0 e pg 8.16.3. npx --no-install prisma validate --config prisma7.config.ts, npx --no-install prisma generate --config prisma7.config.ts e npm run check aprovados. npm test restrito: 19 passaram/3 falharam por DATABASE_URL inacessível; repetição com acesso ao ambiente local: 24 passaram, zero falhas. Sintaxe dos dois probes validada com node --check. Não foram reexecutados 173 testes históricos, integração, Lab08 ou PowerShell.

Plano futuro sem execução: conferir destino/TLS/schema/ledger e recuperação antes da autorização específica para aplicar as migrações, em ordem:

1. 20261011200553_init. SHA-256 d7850ea6c25a735a435e99e65bc54d503057b85a135800c9769afb189746539e. Cria atracoes, tags e atracao_tags; PKs id/id/composta; índices categoria/cidade/tagId e UNIQUE tags.nome; duas FKs da associação com DELETE/UPDATE CASCADE; sequências SERIAL.
2. 20261012140000_categorias_avaliacoes. SHA-256 b4fd8165612a4eb2895ddaaca143a6534331173f340c99636bd6d2fe2f41fea2. Transação explícita; categorias com PK id e UNIQUE nome/chave; normalização INSERT e UPDATE categoriaId antes de NOT NULL; índice e FK DELETE RESTRICT/UPDATE CASCADE. Avaliacoes com PK id, CHECK nota entre 1 e 5, índice atracaoId e FK DELETE/UPDATE CASCADE.

SQL compatível por análise estática com PostgreSQL 18; execução remota não comprovada. Em banco preenchido, revisar normalização, unicidade, locks e NOT NULL; em vazio não há atrações a transformar. Se houver schema preexistente, avaliar conflitos antes da aplicação. Após futura aplicação autorizada, conferir ledger/checksums/constraints/índices/grants. Não transferir dados locais nem editar migrações existentes. Checksums reconferidos e preservados.

Arquivos alterados: scripts/verify-neon-operator-readonly.mjs, scripts/verify-neon-readonly.mjs, README.md, docs/guia-prisma-neon.md e docs/estado-publicacao.md. Arquivo privado existente preservado; runtime, .env, schema e PostgreSQL local intactos. Nenhuma migração remota, escrita PostgreSQL, transferência, alteração de roles/permissões, commit, push ou deploy.
