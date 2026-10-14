# Estado da publicação — versão 2.0.0

Estado vigente em 13/10/2026: **FUNCIONAL LOCALMENTE**, publicação **BLOQUEADA POR DEPENDÊNCIA EXTERNA**. [Relatório final](relatorio-final-pendencias-publicacao.md): 196/196 casos aprovados na rodada completa (47 unitários, 80 integração, 39 Lab08, 30 PowerShell), build/check/validate e dois smokes production aprovados; dados/.env preservados. Das 16 pendências: 2 RESOLVIDO, 6 VALIDADO, 6 BLOQUEADO, 2 NÃO VERIFICADO — oito fechadas/oito abertas.

Neon READ ONLY: PostgreSQL 18.6, banco correto, public vazio, ledger ausente e role runtime proposta inexistente. Transporte TLS 1.3/certificado/hostname aprovado sem autenticação da aplicação. DIRECT_URL privada vazia: CREDENCIAL_NEON_PENDENTE. Token preparado só no arquivo privado; CORS_ORIGINS=none testado sem frontend publicado. DATABASE_URL/runtime remoto e schema ausentes.

Origin para GitHub público/vazio e pacote/manifesto de 112 arquivos preparados; index local pronto, zero commits/push, aprovação específica pendente. CI Ubuntu preparado, não executado. Render Free/Virginia inativo, acesso/deploy não confirmados. Codex Security não iniciou; ESLint/security executou com zero erros e 168 avisos, sem triagem integral. Nenhuma URL pública da API validada.

[Plano remoto](plano-integracao-remota.md), [matriz acadêmica](matriz-rastreabilidade-academica.md) e [registro IA](registro-uso-ia.md) registram riscos/limitações. Nenhuma migração/carga/grant remota ou publicação. **Todas as entradas abaixo são históricas e não substituem o relatório vigente.**

## Histórico preservado

Probe TCP local tentou conectar com URL direta obtida oficialmente e TLS verify-full, mas retornou EACCES no executor restrito. A transferência do segredo ao terminal foi rejeitada pela revisão automática por risco de inclusão no registro da ferramenta. Nenhum arquivo com credencial foi salvo; somente diretório privado `backups/neon` com ACL restrita foi preparado. O operador deverá preencher privadamente o JSON descrito no [guia Neon](guia-prisma-neon.md) antes da retomada por `scripts/verify-neon-operator-readonly.mjs`. Em verificação adicional fora do sandbox, sem credenciais, o endpoint direto negociou TCP/TLSv1.3 e validou certificado/hostname, usando SSLRequest do pg-protocol e opções SSL do pg. **Transporte TCP/TLS APROVADO; probe autenticado da API BLOQUEADO**, schema/migrações **PENDENTES**, consultas via conector **APROVADAS**. Nenhuma migração ou transferência ocorreu.

Nesta tarefa foram novamente aprovados 24 testes unitários, schema validate, geração Client 7.10.0, npm run check, sintaxe dos probes e 3 cenários simulados do probe. Duas migrações mantiveram os checksums já documentados. Não foi reexecutado o conjunto histórico de 173 verificações. Runtime Express/Prisma, `.env`, PostgreSQL local, dados e arquivos acadêmicos preservados; sem commit/push/deploy ou configuração do Render. As entradas abaixo são registros de rodadas anteriores.

Atualização em 13/10/2026: **Neon BLOQUEADO por ausência de projeto acessível; preparação local APROVADA**. A integração está instalada/habilitada e autenticada: organização Wesley retornada com plano Free. Listagem global e listagem explícita da organização retornaram zero projetos, sem erro de autenticação. Não há evidência de falha do Neon; acesso a outra organização/conta ou limites de escopo de escrita não foram comprovados. Plano revisável no [guia Neon](guia-prisma-neon.md): projeto `balsas-experience-api`, database `balsas_experience`, branch `main`, PostgreSQL 18, região AWS N. Virginia para futuro Render Virginia, sujeito a confirmação Free no painel e autorização explícita. Nenhum recurso criado.

Nesta tarefa: schema Prisma válido, Prisma Client 7.10.0 gerado, `npm run check` aprovado e **24 testes unitários aprovados, zero falhas**. Probe ampliado para verificar autorização do certificado e hostname, identidade/versionamento do database, capacidades da role, privilégios de tabelas/sequências e inventário de colunas/constraints/índices. Três cenários simulados adicionais passaram: certificado não autorizado, hostname divergente e banco vazio; não são testes TLS/TCP remotos. Execução real do probe parou em `NEON_READONLY_URL_MISSING`. Compatibilidade Linux/Render, TLS real, esquema/dados/privilégios remotos e leituras reais permanecem não verificados. Os 173 testes anteriores não foram reexecutados integralmente. `.env`, arquitetura, schema e migrações históricas preservados; sem escrita remota, transferência de dados, commit, push ou deploy.

Preparação local validada em 12/10/2026. Publicação externa ainda não executada. Não há URL pública validada nem banco Neon ou serviço Render configurado nesta operação.

Os parágrafos seguintes registram a preparação histórica anterior. A rodada anterior aprovou 24 testes unitários, 80 de integração, 39 Lab08 e 30 PowerShell, além de 14 verificações de produção: 187 resultados finais aprovados, com sobreposição entre suítes. A instalação limpa, build, validação do schema e inicialização sem dependências de desenvolvimento também passaram. Isso não substitui testes remotos.

A conferência pré-publicação aprovou leituras da API, identidade runtime e preservação dos dados: oito atrações, quinze tags, trinta e duas associações, três categorias, nenhuma avaliação e duas migrações. Backups tiveram hashes e catálogos reconferidos. Evidências completas, detalhes administrativos e relatórios de incidentes permanecem privados.

A rotação administrativa anterior foi validada com autenticação pela nova credencial e rejeição da antiga. Esta etapa não alterou credenciais, privilégios ou serviços. Na rodada anterior, uma falha inicial do harness de encerramento foi corrigida; os resultados finais acima passaram.

Comandos: instalação `npm ci --include=dev`, build `npm run build`, início `npm start`. Build e início não aplicam migrações ou seed. Node 24.x; Prisma 7.10.0; Express 5.2.1. Ver [publicação](guia-publicacao-final.md), [checklist](checklist-publicacao-github-neon-render.md) e [testes](guia-testes.md).

O código contém o arquivo estático `src/data/atracoes.json`, utilizado pelo seed. Sua inclusão no GitHub precisa constar da aprovação do manifesto. Nenhum dump, configuração privada ou dado exportado do banco integra o pacote proposto; nenhuma transferência ao Neon foi autorizada.

Pendências: autorizar commit/push; criar infraestrutura Neon após autorização própria; autorizar esquema e transferência de dados separadamente; validar destino; aprovar criação/deploy Render; validar URL pública, TLS, privilégios, persistência e contratos remotos. Escritas remotas exigem registros de teste autorizados.

Uso de IA: preparação de código, documentação e verificações assistida por OpenAI Codex. Resultados relatados derivam das verificações executadas; operações externas dependem das autorizações do responsável.

## Verificação final independente — 12/10/2026

Status atual: **BLOQUEADA PARA PUBLICAÇÃO REMOTA**, pela falta de um destino Neon acessível e validado. Não está classificada como PRONTA PARA PUBLICAÇÃO nem PUBLICADA E VALIDADA.

Nesta rodada foram reproduzidos 24 testes unitários, 80 de integração, 39 Lab08 e 30 PowerShell: 173 resultados locais aprovados, zero falhas finais. As operações de escrita ocorreram apenas no banco local isolado já existente; as seis tabelas de ambas as bases mantiveram contagens e hashes. Relatórios históricos não foram sobrescritos: as execuções de integração e Lab08 usaram uma cópia temporária do código.

Node local 24.20.0; build e geração Prisma 7.10.0, validação e status local das duas migrações passaram. A inicialização por `npm start` em ambiente `production`, `0.0.0.0` e porta 3215 passou: `/`, `/live`, `/health`, `/atracoes` e `/categorias` responderam 200 e a instância temporária encerrou com código zero. A entrega real de SIGTERM em Linux/Render continua pendente; no Windows foi usado o preload de teste existente. A primeira tentativa PowerShell falhou na preparação do harness temporário por caminho de preload Windows; o uso de URL `file:` corrigiu o harness sem alterar o código da API.

PostgreSQL local 18.6 respondeu a consultas READ ONLY. O papel runtime não é proprietário dos objetos, não tem atributos administrativos, memberships elevados, CREATE de banco/schema, TRUNCATE ou acesso ao ledger de migrações. Os checksums das duas migrações aplicadas correspondem aos arquivos. A tentativa inicial de consultar o ledger com o runtime recebeu 42501, comportamento esperado dos privilégios mínimos; a consulta correta foi feita pelo migrador em READ ONLY.

Rotação administrativa reconfirmada por conexões novas: credencial atual aceita e antiga rejeitada com SQLSTATE 28P01. Nenhuma senha foi alterada nesta rodada. `npm audit` atual: zero vulnerabilidades conhecidas. Os 100 candidatos Git foram inspecionados contra cinco fontes privadas de segredos e assinaturas conhecidas: zero ocorrências, com a limitação de uma busca heurística.

Git local: branch `main`, sem commits/index/remoto preparado. O [destino GitHub informado](https://github.com/Francisco-alt-coder/-Balsas-Experience-API) existe, é público e está vazio; a API de branches e `git ls-remote` não retornaram referências. Os 100 caminhos continuam iguais ao manifesto anterior; 14 evidências acadêmicas seguem preservadas e ignoradas. O envio inicial depende de autorização.

Neon: duas listagens por leitura, uma filtrada por Balsas e outra geral, retornaram lista vazia de projetos visíveis na conexão atual. A configuração runtime local aponta para PostgreSQL local; não é evidência de Neon. Não foi criado projeto substituto, nem obtida ou persistida credencial remota. Falta identificar a conta/projeto/branch/database e validar SELECT 1, TLS, versão, tabelas, integridade, migrações e privilégios remotos.

Render: modelo inativo mantido; Node 24, build `npm ci --include=dev && npm run build`, start `npm start`, PORT da plataforma, host 0.0.0.0 e health /health são compatíveis por inspeção e testes locais. Linux, recursos da conta, cotas e comportamento remoto não foram executados. [Limitações Free](https://render.com/docs/free) e [seleção de Node](https://render.com/docs/node-version) consultadas nesta rodada. O plano é adequado à demonstração acadêmica, sujeito a cold start e cotas.

O lançamento de uma revisão pelo plugin Codex Security não retornou contexto de scan durante a espera e foi interrompido no orquestrador. Não há relatório canônico de scan concluído; a revisão de controles desta rodada baseia-se no código, nos testes e nas verificações descritas acima. Não equivale a auditoria exaustiva.

As primeiras tentativas de acesso privado e rede tiveram EPERM/ACL ou conectividade restrita; as verificações autorizadas passaram no contexto apropriado. Não foram alteradas ACLs, credenciais, dependências, schema, migrações, rotas ou regras de negócio. A geração do Client afetou somente arquivos gerados ignorados. Nenhum commit, push, criação de serviço, migração remota ou deploy foi realizado.

## Estado vigente — credenciais, 13/10/2026

Integração autenticada Neon PENDENTE: arquivo privado existente, protegido por backups/, preservado, com DIRECT_URL vazia. Loader aceita BOM e distingue erros sanitizados; execução autorizada retorna NEON_OPERATOR_DIRECT_URL_EMPTY antes de conectar. Projeto/branch/database/endpoint e PostgreSQL configurado 18 confirmados por metadados oficiais; TLS/autenticação/consultas/schema remoto não verificados nesta rodada. Preencher URL apenas no editor local e executar o probe. Prisma validate/generate 7.10.0, check e 24 testes unitários aprovados; primeira execução restrita teve 19 aprovações/3 falhas por ambiente inacessível. Duas migrações preservadas. Sem escrita em bancos, migração remota, transferência, commit, push ou deploy. Detalhes e plano futuro no [guia Neon](guia-prisma-neon.md).
