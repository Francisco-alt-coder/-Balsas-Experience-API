# Auditoria, limpeza e organização — 12/10/2026

Resultado: limpeza conservadora validada localmente. Foram removidos somente 9 logs antigos de diagnóstico npm. Nenhum arquivo da aplicação, migração, backup, evidência acadêmica ou script operacional foi excluído. Publicação e alterações em produção não foram executadas nem autorizadas por esta revisão.

## Escopo e inventário

O diretório do projeto/Git é a subpasta `balsas-experience-api-final`, onde se encontra `package.json`. A pasta externa contém também `.tools/pdf-reader`, preservada: seus dois diretórios internos negaram acesso. Nenhum AGENTS.md foi encontrado nos diretórios acessíveis examinados.

Inventário capturado: **67.500 arquivos**, dos quais 67.498 tiveram conteúdo lido. Inclui dependências instaladas, cache e cópias temporárias. Não significa revisão semântica manual de cada dependência. Foram classificados 66.844 como GERADO, 316 como INCERTO, 183 como DOCUMENTAÇÃO, 61 como SENSÍVEL e 96 arquivos como ESSENCIAL, mais os metadados `.git/` preservados. A captura ocorreu durante a reinstalação; o número não representa uma contagem final imutável.

Leitura inicial negada para `.env` e `backups/test-env.json`; inventário completo negado para `backups/admin`, `backups/isolamento-principal` e `backups/isolamento-testes`. Posteriormente, a verificação de segredos e as suítes puderam acessar somente a configuração privada necessária, sem expor valores. Esses acessos não constituem inventário completo dos diretórios privados. Nada nesses locais foi removido.

Classificação individual, tamanhos, hashes de arquivos do projeto, limitações e grupos de conteúdo idêntico: `docs/inventario-limpeza.json`. Tabela individual legível: `docs/classificacao-arquivos-limpeza.md`. Ambos são artefatos locais ignorados pelo Git. Não há arquivo comprovadamente OBSOLETO. Dez grupos possuem conteúdo idêntico; isso não estabelece redundância dispensável: resultados de rodadas distintas e a referência acadêmica do seed conservam finalidade própria, e foram preservados como DOCUMENTAÇÃO/ESSENCIAL.

## Tabela de ações

| Arquivo ou pasta | Classificação | Motivo | Ação realizada/proposta | Risco |
|---|---|---|---|---|
| `src/` | ESSENCIAL | Express, rotas, controllers, autenticação, validação, Prisma e dados públicos | Preservado integralmente | Alto se excluído |
| `prisma/`, `prisma7.config.ts` | ESSENCIAL | Schema, seed e duas migrações existentes | Preservado integralmente | Alto se excluído |
| `tests/`, `scripts/` | ESSENCIAL | Testes, manutenção, recuperação e dependências indiretas | Preservados | Médio/alto se excluídos |
| `package.json`, lockfile, exemplos `.env`, Render, HTTP e atributos Git | ESSENCIAL | Instalação, execução, configuração e implantação | Preservados | Alto se excluídos |
| `docs/`, referências de laboratórios, README | DOCUMENTAÇÃO | Manutenção, avaliação acadêmica e histórico | Preservados; índices atualizados | Alto sem confirmação da entrega |
| `.env`, `backups/` | SENSÍVEL | Credenciais, dumps e recuperação | Preservados localmente, ignorados | Alto |
| `node_modules/` | GERADO | Dependências reproduzíveis | Reinstaladas por npm ci; cliente regenerado | Baixo |
| `.npm-cache/_logs/*-debug-0.log` anteriores à rodada | GERADO | Diagnóstico npm, sem referência encontrada nos arquivos do projeto examinados | 9 arquivos removidos | Baixo |
| Restante de `.npm-cache/` | GERADO | Cache útil à instalação | Preservado | Baixo |
| `tmp/` | INCERTO / GERADO | Ferramentas, extrações e cópias de instalações isoladas | Preservado; dependências internas classificadas GERADO | Indeterminado |
| `.git/` | ESSENCIAL | Estado do repositório | Preservado, sem staging/commit/remoto | Alto se excluído |

Os nove nomes e tamanhos removidos estão em `docs/limpeza-removidos.json`, ignorado. A exclusão usou caminhos literais e validou que o diretório de destino pertencia ao projeto. Logs operacionais PowerShell, caches completos e evidências de testes não foram apagados. Não foi necessária nenhuma exclusão de risco que exigisse autorização adicional.

## Validação real

| Comando/verificação | Resultado |
|---|---|
| `npm ci --cache .npm-cache --no-fund --ignore-scripts` | Passou: 226 pacotes; primeira instalação diagnóstica |
| `npm ci --cache .npm-cache --no-fund` | Passou: 226 pacotes; npm avisou que dois lifecycle scripts Prisma não estavam aprovados pela política allowScripts do ambiente |
| `npx prisma validate --config prisma7.config.ts` | Primeira tentativa: EPERM no cache externo Prisma; repetição com engine local: schema válido |
| `npx prisma generate --config prisma7.config.ts` | Primeira tentativa: mesmo EPERM; repetição com engine local: cliente 7.10.0 gerado |
| `npm run check` | Passou |
| `npm test` | Primeira rodada: 19 passaram, 3 falharam por cliente ainda não gerado; após gerar: **24/24 passaram** |
| `npm audit --cache .npm-cache --json` | Primeira tentativa: falha de rede; repetição com acesso autorizado: **zero vulnerabilidades conhecidas** |
| `node tmp/auditoria-integracao-segura.mjs` | Passou: executou integração **80/80** e Lab08 **39/39** no banco isolado local |
| Inicialização/endpoints | Servidores filhos das suítes iniciaram e foram encerrados; GET, POST, PUT, PATCH, DELETE, Bearer, categorias, avaliações, busca e erros exercitados |
| Integridade isolada | Contagens e SHA-256 idênticos antes/depois nas seis tabelas: atrações, tags, associações, categorias, avaliações e histórico Prisma |
| Imports relativos de código/testes/scripts | Nenhum destino ausente encontrado na análise estática; imports dinâmicos e referências externas não são cobertos integralmente |
| Hashes de código/testes/scripts/Prisma inventariados | Sem alteração nesta rodada |
| `node scripts/check-publication-files.mjs` | Primeira tentativa: acesso negado ao `.env`; repetição autorizada: 99 candidatos; verificação final com este relatório: **100 candidatos, zero ocorrências detectadas** |
| `git status`, `git diff`, `git diff --cached`, `git check-ignore` | Executados; nenhum arquivo rastreado, nenhum remoto e diferenças Git vazias; `.env`, backups, tmp e evidências privadas ignorados |

Para contornar EPERM sem alterar configuração pública: foi copiado o engine já existente no cache Prisma para `node_modules/@prisma/engines/schema-engine-windows.exe`, e usada a variável `PRISMA_SCHEMA_ENGINE_BINARY` no processo de validação. Uma URL fictícia local na porta 1 foi usada para validar/gerar/testar sem conexão real. Não houve migração, seed ou alteração de dependências declaradas.

O harness isolado confirmou host loopback, mesmo host/base entre as credenciais e nome de banco com prefixo `balsas_lab08_test_` antes de executar qualquer escrita. Evidências locais: `docs/auditoria-limpeza-validacoes.json`, `docs/auditoria-limpeza-integracao.json`, `docs/auditoria-limpeza-integration.txt`, `docs/auditoria-limpeza-lab08.txt`. Integrações modificam temporariamente sequências/IDs no banco de testes; igualdade dos hashes verifica dados de tabelas, não ausência de alterações nos contadores de sequências. Produção não foi escrita.

## Estrutura final

```text
pasta externa/
├── .tools/pdf-reader/          # ferramenta local preservada
└── balsas-experience-api-final/ # raiz do projeto e Git
    ├── src/{controllers,routes,middlewares,lib,data}/
    ├── prisma/{schema.prisma,seed.js,migrations/}
    ├── tests/
    ├── scripts/lib/
    ├── docs/referencias-laboratorios/
    ├── package.json e package-lock.json
    ├── prisma7.config.ts, render.yaml.example, requisicoes.http
    ├── README.md, .gitignore, .gitattributes, .env.*.example
    └── .env, backups/, tmp/, node_modules/, .npm-cache/, .git/
```

## Versionamento, pendências e riscos

Alterações públicas desta rodada: `.gitignore` libera somente este relatório sanitizado; README e índice docs apontam para ele. As demais evidências de auditoria permanecem privadas. Novas ferramentas de inventário/harness ficam em `tmp/`, ignoradas. O teste Lab08 também atualizou seu relatório local padrão `docs/resultado-lab08.json`. O scanner atualizou `docs/inspecao-arquivos-publicacao.json`. Os arquivos gerados não alteram a arquitetura.

Como não há arquivos rastreados, `git diff` vazio não demonstra ausência de mudanças: os arquivos públicos aparecem como `??`. O inventário inicial e hashes fornecem a comparação desta rodada; nenhuma operação git add/commit/push foi executada. O scanner de publicação deverá ser repetido após qualquer alteração futura de conteúdo/lista pública.

Uma consulta Git no processo com acesso ampliado recusou a propriedade do repositório (`dubious ownership`); consultas no sandbox funcionam. Nenhuma configuração global safe.directory foi alterada. Uma tentativa de inserir os links README por Node inline falhou por quoting PowerShell antes de escrever; a inserção foi concluída com patch explícito.

Pendências: confirmar com a entrega acadêmica se referências/evidências ignoradas devem acompanhar um pacote acadêmico separado; não há evidência para descartá-las. `tmp/` conserva muitas cópias reproduzíveis, mas sua eliminação em bloco exige verificar ferramentas/evidências restantes. A estrutura externa duplicada foi preservada para não quebrar caminhos de IDE/ferramentas. Completar inventário dos diretórios privados se necessário com acesso apropriado, sem exposição de segredos.

Risco de publicação: o `.gitignore` não protege contra git add -f nem contra upload manual de toda a pasta; backups/ambiente privado devem ficar fora do pacote. O scanner heurístico não garante ausência de todo segredo. Render continua modelo inativo e Neon/TLS/deploy remoto não foram testados nesta rodada. A documentação histórica de prontidão descreve suas próprias rodadas; os resultados acima são desta limpeza.

Critério de conclusão: regressões locais cobertas passaram e arquivos essenciais/acadêmicos foram preservados. A revisão completa de áreas sem acesso e a decisão de empacotamento acadêmico permanecem pendentes. Esta conclusão não aprova publicação nem afirma que todo arquivo temporário remanescente é dispensável.

Sugestão de commit futuro: `chore: documenta auditoria e limpeza conservadora do repositório`.

## Continuação: revisão para versionamento

Os 100 candidatos foram relidos e inventariados por caminho, tamanho, SHA-256 e finalidade. Código, testes, scripts, seed, schema e migrações mantêm os hashes da auditoria inicial. Nenhum documento ou arquivo incerto foi excluído nesta continuação. A lista exata está em `docs/arquivos-versionar.txt`, artefato local ignorado. `docs/revisao-candidatos-versionamento.json` registra a revisão individual; `docs/arquivos-ignorados-versionamento.txt` lista arquivos ignorados e diretórios agrupados.

A documentação foi separada em técnica essencial, acadêmica necessária, histórica e privada na tabela local `docs/classificacao-documentacao-versionamento.md`. A seleção acadêmica conservadora consta em `docs/documentos-academicos-preservados.txt`; inclui registros de IA/testes, auditorias anteriores, implementação Lab08 e referências de laboratórios. Continua preservada localmente, sem inclusão automática no pacote GitHub. Relatórios antigos mantêm seus resultados originais e não representam validações atuais. Os requisitos formais da entrega acadêmica devem definir o pacote de evidências a compartilhar após revisão de privacidade.

Os cinco diretórios anteriormente bloqueados foram investigados por metadados e ACL com acesso apropriado: diretórios administrativos/de isolamento e os dois diretórios do leitor PDF externo. A enumeração superior foi possível, sem abrir seu conteúdo privado, alterar permissões ou excluir arquivos. Metadados individuais permanecem em `docs/diretorios-privados-versionamento.json`, ignorado. A diferença entre as identidades de execução explica a acessibilidade diferente; nenhum inventário recursivo completo desses diretórios é alegado.

`npm run check` passou novamente e `npm test` passou com 24/24 casos, usando URL fictícia sem acesso real ao banco. Não foi necessário repetir CRUD em banco: somente documentação e artefatos ignorados foram alterados. Os 80 testes de integração, 39 Lab08 e hashes de seis tabelas da auditoria anterior continuam como evidências daquela rodada.

Os caminhos absolutos PostgreSQL 18 presentes em scripts administrativos são caminhos de instalação do Windows, não senhas ou caminhos pessoais. Foram mantidos sem refatoração; constituem uma limitação de portabilidade desses scripts. Referências relativas a backups privados são dependências operacionais locais, não arquivos privados incluídos no Git. Links Markdown públicos relativos foram conferidos contra a lista pública.

Plano após autorização explícita: reconferir esta lista e o scanner, preparar staging somente dos caminhos enumerados, revisar `git diff --cached` e então criar o commit `chore: documenta auditoria e limpeza conservadora do repositório`. Como o repositório ainda não possui commits, esse commit conterá o projeto inteiro selecionado, além da documentação da limpeza; a mensagem solicitada não implica que seja um commit incremental. Push e deploy exigem autorização própria. Nada foi adicionado ao index nesta preparação.
