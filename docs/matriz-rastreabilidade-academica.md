# Rastreabilidade acadêmica — versão 2.0.0

13/10/2026. Fontes originais disponíveis em Downloads/Exemplo - Balsas Experience API-20261012. PDFs preservados; não integram o pacote público. Foram extraídos integralmente (87 páginas) e conferidas as páginas de requisitos, checklists e exemplos relevantes. As extrações temporárias estão ignoradas em tmp/pdfs/master-requirements.

| Fonte | Páginas | SHA-256 do original |
|---|---:|---|
| laboratorio-07-balsas-experience-api.pdf | 37 | 240ef67c30f6123f6b3041af74e14dc381d442719b30a9f5444244c70042c381 |
| laboratorio-08-balsas-experience-api-prisma.pdf | 40 | d2d058037cf777732872537a598f1cd54454a31e5667653c0d90da97a39e87ea |
| guia-08-publicar-a-api-de-graca.pdf | 10 | f3693546c235d5b51984f05133f000eb9b7977ff7975bb7d2feca5c983d3a1a2 |

Autoria dos materiais: Prof. Marcos David Souza Ramos, disciplina Programação para Web, Unibalsas. A matriz resume requisitos; não substitui nem modifica os PDFs. O JSON externo atracoes.json e src/data/atracoes.json foram comparados integralmente: equivalentes, oito atrações.

## Requisitos e evidências

| ID | Requisito / fonte-página | Implementação | Evidência atual | Situação |
|---|---|---|---|---|
| AC01 | Node/ESM/Express e estrutura routes/controllers — Lab07 pp.6–8,20 | package.json, src/app.js, routes/controllers | Node 24.20.0, check, build e inicialização reais | Atendido localmente |
| AC02 | Identificação e health — Lab07 pp.8–9; Lab08 p.26 | /, /health; /live adicional | HTTP 200 conectado; erro de banco 500 sanitizado; live independente | Atendido localmente; sem URL pública |
| AC03 | Lista e detalhe/404 — Lab07 pp.11–12; Lab08 pp.15–16 | GET /atracoes, /atracoes/:id | Integração/PowerShell, persistência e IDs inválidos | Atendido localmente; formato difere do exemplo Lab08 |
| AC04 | POST 201/Location e validação — Lab07 pp.12–13; Lab08 pp.19–20 | POST /atracoes | Criação descartável e SQL independente; 400 em corpos inválidos | Atendido localmente com Bearer |
| AC05 | PUT completo, substituição de tags — Lab07 p.15; Lab08 p.21 | PUT /atracoes/:id, transação | Tags substituídas, campos padrão e 404/400 | Atendido localmente |
| AC06 | DELETE 204 e repetição 404 — Lab07 p.16; Lab08 p.22 | DELETE /atracoes/:id | API, SQL e cascata das avaliações/vínculos | Atendido localmente |
| AC07 | Categoria/tag insensitive combinados; vazio 200 — Lab07 pp.17–18; Lab08 p.17 | Filtros Prisma por relações | Integração/Lab08/PowerShell | Atendido localmente |
| AC08 | q em nome/descrição — Lab08 p.17 | GET /atracoes?q= | Busca literal, caixa, vazio, caracteres especiais e entrada semelhante a SQL | Atendido localmente |
| AC09 | Categorias únicas e contagens 4/1/3 — Lab08 p.18 | GET /categorias, _count; chave normalizada | Lab08, reutilização de categoria e contagem zero | Atendido localmente |
| AC10 | Categoria/Tag/Atracao/Avaliacao, PK/FK/unique/N:N/cascata — Lab08 pp.8–9,30 | schema e duas migrações | validate; status local atualizado; constraints nos testes | Relações atendidas; N:N explícita/tipos diferem do exemplo |
| AC11 | CLI/Client/adapter 7.10.0, pg, generator JS e config separado — Lab08 pp.6–7,11 | prisma7.config.ts, lib/prisma.js | npm ls, validate e generate | Atendido localmente |
| AC12 | Cliente único — Lab08 p.11 | src/lib/prisma.js | Imports e testes de inicialização/controllers | Atendido no runtime; seed é processo administrativo separado |
| AC13 | Histórico de migrações — Lab08 p.9 e pp.25,28 | prisma/migrations | Dois checksums preservados; status local atualizado | Local atendido; GitHub e Neon bloqueados |
| AC14 | Carga inicial oito atrações/três categorias/15 tags/três avaliações de exemplo — Lab08 pp.11–14,26 | prisma/seed.js, JSON de referência | JSON equivalente; principal tem 8/3/15 e zero avaliações | Divergência explícita: seed preserva dados e não cria avaliações fictícias; não executado no Neon |
| AC15 | Avaliação inteira 1–5, 201 e atração ausente 404 — Lab08 p.23 | POST /atracoes/:id/avaliacoes, validação e CHECK | Lab08: tipos/notas, Bearer, persistência, 404 | Atendido localmente |
| AC16 | AVG/COUNT, 4.5/2 e ausência null/zero — Lab08 p.24 | Aggregate Prisma no detalhe | Lab08 com duas avaliações descartáveis | Atendido localmente |
| AC17 | Erros JSON/400/404 e tratamento central — Lab07 p.21; Lab08 pp.22,28 | Middlewares e app.js | Integração/unitários; 401/403/409/413/415/500 adicionais | Atendido nos cenários executados; logs sanitizados |
| AC18 | cidade/ate/ordem/PATCH/CORS/paginação — Lab07 p.26; Lab08 p.28 | Filtros, ordenação opt-in, PATCH e CORS exato/none | Integração e regressões CORS | Implementados localmente; frontend não identificado |
| AC19 | PORT, 0.0.0.0, build/start — Guia p.5; Lab08 p.25 | app.js e modelo Render | PORT dinâmica e duas políticas CORS em produção no isolado | Atendido localmente; build não migra automaticamente |
| AC20 | Segredo ambiental e .env fora do Git — Lab08 pp.6,29; Guia pp.5–6 | ignore, loaders, exemplos e fontes privadas | Scanner de cinco fontes privadas; nenhum hit em candidatos | Verificado localmente; runtime remoto não configurado |
| AC21 | GitHub público, migrações versionadas e histórico — Lab07 p.26; Lab08 pp.28–29 | origin preparado; manifesto/pacote | Repo público vazio e acesso administrativo confirmados | Bloqueado por autorização de commit/push; não inventar histórico |
| AC22 | API publicada com oito atrações, persistência e quinze testes externos — Lab08 pp.26–27; Guia pp.6–7 | Plano Neon/Render e test-public-readonly | Nenhuma URL pública desta aplicação validada | Bloqueado por credenciais/schema/carga/autorização/acesso |
| AC23 | Coleção HTTP e README reproduzíveis — Lab07 p.26; Lab08 pp.28–29 | requisicoes.http, README e guias | Arquivos preservados e revisados | Preparado localmente; não equivale à entrega pública |

## Diferenças que exigem transparência

1. Lab08 pp.15–17 mostra categoria/tags como objetos e ordenação alfabética padrão. API atual preserva categoria string, tags string[], localização aninhada e ordenação solicitada por ordem=nome. Não declarar equivalência literal das respostas.
2. Lab08 pp.8/30 usa distanciaCentroKm Int?, criadaEm e N:N implícita. Histórico existente usa Float?, criadoEm/atualizadoEm e AtracaoTag explícita. Preservar dados/contrato não autoriza alterar o requisito; eventual adequação requer análise de compatibilidade.
3. Lab08 pp.12–13 propõe apagar tabelas e inserir três avaliações de exemplo. Isso conflita com preservação dos dados e restrições da sessão. Nenhuma limpeza de dados reais foi executada; avaliações sintéticas existem somente em fixtures descartáveis.
4. Guia p.5/Lab08 p.25 agregam migração ao build e usam script seed; API usa db:seed com opt-in local e migrações em etapa separada. O seed administrativo atual rejeita Neon. Uma carga remota deve ter implementação/revisão/autorização próprias.
5. Guia pp.6–7 prevê publicação e atualização automática por push. Modelo permanece inativo, autoDeployTrigger off, e nenhuma publicação foi autorizada/executada. A API não está entregue publicamente.

GET /tags, DELETE de avaliação específica, ordenação por nota, ativo/exclusão lógica, OpenAPI e frontend são apresentados como desafios/extensões (Lab08 pp.28/40), não como funcionalidades já implementadas. Não foram inventados endpoints ou novas entidades. Não é possível certificar cumprimento literal integral dos PDFs; divergências e entrega remota permanecem explícitas.

As 16 pendências operacionais e suas quatro classificações estão no [relatório final](relatorio-final-pendencias-publicacao.md). A conformidade acadêmica e a disponibilidade de produção são avaliações distintas.
