# Relatório final das pendências e publicação — Balsas Experience API 2.0.0

13/10/2026, America/Sao_Paulo. **Código publicado no GitHub com autorização condicional cumprida. API FUNCIONAL LOCALMENTE; implantação em produção BLOQUEADA POR DEPENDÊNCIA EXTERNA.** Commit do pacote: f40bb1585f8e8e95657f3ede7f7b71099c01785d. GitHub Actions aprovado: 47/47 unitários em Ubuntu 24.04/Node 24.21.0. Sem deploy, migração ou mudança de credenciais/permissões remotas.

Última rodada local completa: 196/196, 21:07:42–21:08:08 local (14/10/2026 00:07:42–00:08:08 UTC). Commit criado 21:30:14 e CI iniciado 21:30:55 local, conforme metadados GitHub. Atualização documental registra essa execução; arquivos e conclusões anteriores representam a preparação do pacote quando explicitamente históricos.

Este relatório prevalece sobre os registros históricos. **16 itens: 3 RESOLVIDO, 6 VALIDADO, 5 BLOQUEADO e 2 NÃO VERIFICADO. Nove fechados e sete abertos.** A [matriz dos três PDFs](matriz-rastreabilidade-academica.md) registra diferenças de contrato e entrega pública ausente; não se certifica conformidade literal integral.

## Matriz obrigatória das 16 pendências

| ID | Pendência | Situação inicial | Ação executada | Evidência | Situação final |
|---|---|---|---|---|---|
| R01 | Parâmetros de URL poderiam sobrescrever host/identidade | Correção anterior, exigia regressão atual | Reexecutados guards de protocolo, loopback, banco, parâmetros permitidos e duplicados | 12 testes em tests/test-config.test.mjs; suíte final | VALIDADO |
| R02 | Snapshot poderia conferir outro banco | Correção anterior | Confrontados host/porta/database do snapshot e das suítes antes de conectar | READINESS_SNAPSHOT_TARGET_MISMATCH na regressão preservada; snapshots finais | VALIDADO |
| R03 | Processo temporário poderia sobreviver a falha | Cleanup anterior; segundo smoke revelou marcador antigo reutilizado | Marcadores de parada/PID exclusivos por tentativa e porta; finally e conferência do encerramento | Dois smokes finais e regressão de falha forçada aprovados | RESOLVIDO |
| R04 | Erros genéricos dos probes | Códigos sanitizados anteriores | Reexecutados testes; arquivo real vazio identificado antes de conectar | 7 testes Neon; NEON_OPERATOR_DIRECT_URL_EMPTY | VALIDADO |
| R05 | BOM UTF-8 no JSON privado | Correção anterior | Reexecutada regressão de BOM/JSON; arquivo preservado | tests/neon-operator.test.mjs e leitura controlada | VALIDADO |
| R06 | Caminho/carregamento privado e permissões | Loader independente de CWD | Confirmados import.meta.url, legibilidade e isolamento; ACLs não modificadas | Teste com CWD diferente, arquivo acessível, sem fallback à .env | VALIDADO |
| R07 | Segredos nos candidatos à publicação | Scanner comparava somente .env | Ampliado para cinco fontes privadas; duas regressões e whitelist documental | 112 candidatos, zero hits; .env/backups ignorados e nenhum privado rastreado | RESOLVIDO |
| R08 | Região Render poderia divergir | Modelo Virginia anterior | Conferido YAML Free/Virginia, comandos, Node, health e autodeploy off | render.yaml.example e parse YAML; nenhum serviço criado | VALIDADO |
| A01 | DIRECT_URL real indisponível | String vazia no JSON privado | Ausência reconfirmada; loader preservado; segredo não recuperado por caminho não autorizado | CREDENCIAL_NEON_PENDENTE; NEON_OPERATOR_DIRECT_URL_EMPTY | BLOQUEADO |
| A02 | Schema/ledger Neon ausentes | Banco remoto sem estrutura da API | Inventário READ ONLY atualizado; SQL/hashes/riscos/recuperação revisados | public vazio, ledger ausente; plano remoto; backup remoto não comprovado | BLOQUEADO |
| A03 | Role runtime e privilégios remotos | Conector owner administrativo | Confirmada inexistência da role proposta; plano mínimo por objeto preparado | Catálogo remoto; nenhuma role/grant alterada | BLOQUEADO |
| A04 | DATABASE_URL, token e CORS de produção | Configuração remota incompleta | Token privado forte gerado; none definido/testado sem frontend; modelo atualizado | Arquivo privado ignorado; 2 regressões CORS e 2 smokes; DATABASE_URL vazia | BLOQUEADO |
| A05 | GitHub sem remoto/commits e sem aprovação de envio | Main local sem commits/remoto | Autorização condicional atendida; hashes/segredos/112 caminhos conferidos; commit/push sem force; remoto verificado | f40bb1585f8e8e95657f3ede7f7b71099c01785d; 112 blobs idênticos ao manifesto; CI success | RESOLVIDO |
| A06 | Render sem deploy/URL | Acesso/segredos/autorização ausentes | Free/modelo revistos; integração disponível sugerida; plano preparado | Acesso Render não confirmado; nenhum serviço/deploy/URL real | BLOQUEADO |
| A07 | Linux, sinais reais e cold start | Somente Windows executado | CI unitário real Ubuntu 24.04/Node 24.21.0 aprovado; runtime integrado/sinais/cold start ainda ausentes | Run 38490614729, 47/47 e validate/build/check; nenhum Render executado | NÃO VERIFICADO |
| A08 | Codex Security não concluído | Duas falhas históricas de inicialização | Nova tentativa falhou; alternativa ESLint/security executada; hotspots runtime examinados | Mesmo erro; alternativa: 82 arquivos, zero erros, 168 avisos | NÃO VERIFICADO |

## A. Diagnóstico

Express/Prisma/PostgreSQL funcionam localmente. Os bloqueios restantes são independentes: credencial TCP privada ausente, Neon sem schema/ledger/runtime role, configuração remota incompleta, falta de acesso/aprovação de deploy. GitHub foi publicado após autorização; CI unitário Linux comprovado, mas runtime integrado/sinais/cold start e Codex Security permanecem sem comprovação. Metadados, TLS de transporte e SQL pelo conector não equivalem à API autenticada no Neon.

Falha local nova: o harness reutilizava um marcador de parada entre dois smokes e encerrava o segundo processo cedo. Marcadores exclusivos corrigiram o problema e a rodada final passou. Não era falha do middleware CORS. Nenhum frontend/domínio publicado foi identificado; a futura URL da API não determina a origem de um frontend. none atende aos clientes sem Origin sem inventar domínio.

Arquitetura: Express → routes/validação/Bearer → controllers → cliente Prisma único/PrismaPg → PostgreSQL. Quatro modelos de domínio e AtracaoTag explícita; GETs públicos e health SELECT 1. Artefatos administrativos antigos foram preservados, sem execução indiscriminada; logs, privados e materiais acadêmicos ficam fora do pacote. A [auditoria de limpeza](auditoria-limpeza.md) registra o tratamento anterior de duplicados/logs.

Três PDFs acessados e extraídos integralmente (87 páginas); páginas relevantes de requisitos/checklists/exemplos conferidas, sem renderização visual integral. JSON externo equivalente aos oito registros do seed. Diferenças: objetos de categoria/tags e ordenação padrão do Lab08 versus strings/ordenação opt-in; schema Int/datas/N:N implícita versus Float/datas existentes/N:N explícita. Mudança de contrato/histórico exige análise de compatibilidade. Limpeza destrutiva e avaliações fictícias nos registros reais conflitam com os limites explícitos da sessão. Requisitos e migrações não foram alterados para alegar conformidade.

## B. Arquivos

Examinados: README, package/lock, prisma7.config.ts, schema/migrações/seed, exemplos de ambiente, render.yaml.example, src/app/controllers/routes/middlewares/lib/data, testes/scripts operacionais, guias/relatórios históricos, configurações privadas acessíveis e três PDFs/JSON externo. Valores privados não aparecem em relatórios.

Arquivos públicos relacionados às alterações desta etapa (17):

- src/middlewares/cors.js; tests/config.test.mjs; scripts/verify-api-readiness.mjs.
- scripts/check-publication-files.mjs; novo tests/publication-secrets.test.mjs.
- Novo .github/workflows/ci.yml, revisado na retomada com actions v7/Node24 fixadas por SHA; .env.render.example; .gitignore; README.md.
- docs/README.md; docs/endpoints.md; docs/estado-publicacao.md; docs/guia-prisma-neon.md; docs/registro-uso-ia.md; este relatório.
- Novos docs/matriz-rastreabilidade-academica.md e docs/plano-integracao-remota.md.

Preparação privada ignorada: runtime-secrets.private.json; evidências em backups/neon e backups/security-scan-master; ferramentas em tmp/security-tools; extrações em tmp/pdfs; pacote em backups/publicacao/prompt-mestre-20261013. Origin em .git/config foi configurado localmente, sem mudar Git global. Scanner gera inventário sanitizado local ignorado em docs/inspecao-arquivos-publicacao.json.

R01/R02/R04/R05/R06/R08 são correções anteriores revalidadas. SQL histórico, schema, JSON original e .env preservados. Antes do preparo do index, git diff e git diff --cached eram vazios porque não havia commits nem arquivos rastreados; portanto não certificam ausência de alterações. O index final mostra a adição inicial dos 112 arquivos. Sem baseline Git, não é possível comprovar por diff a contagem histórica de 15 arquivos alterados; a lista acima registra ações conhecidas e o manifesto identifica bytes finais, sem inventar histórico.

## C. Correções

CORS_ORIGINS=none permite clientes sem Origin e nega qualquer Origin/preflight com 403, sem Access-Control-Allow-Origin. Produção continua recusando valor vazio, wildcard, origem inválida ou mistura de none com origem. Quando existir frontend, cadastrar sua origem HTTPS real, sem caminho; não colocar Bearer compartilhado em frontend público.

Harness mantém cleanup no finally, nomes exclusivos de parada/PID e porta confirmada fechada. Scanner compara em memória tokens, URLs e senhas de cinco fontes privadas; mensagens apenas arquivo/motivo. Duas regressões confirmam detecção de vazamento conhecido sem imprimir token e aceitação de candidato benigno. Busca heurística não garante ausência de todos os segredos.

Token novo criptográfico gerado apenas no arquivo privado, sem sobrescrever credenciais existentes/imprimir valores. Helpers existentes verificaram ACL de arquivo/diretório; nenhuma ACL modificada nesta etapa. DATABASE_URL permanece vazia. CI, origin, index e pacote foram preparados localmente; commit/push foram executados depois da autorização específica descrita em H.

## D. Neon

Destino confirmado: Wesley/Free; balsas-experience-api/little-surf-82939047; main/br-steep-violet-b8t7my2h; database balsas_experience; endpoint direto ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech; AWS us-east-1; 0.25 CU; PostgreSQL 18.6 (c021049). Pooler desabilitado, não ativado/testado. Conexão direta inicialmente; pooling só após configuração e verificação próprias.

Nova consulta após a retomada usou SET TRANSACTION READ ONLY e timeout 10s: database/public corretos, zero relações de usuário/constraints, ledger ausente, role proposta balsas_experience_runtime inexistente. Conector owner não superusuário direto, mas com CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS e CONNECT/USAGE/CREATE. Não aprovar essa identidade no runtime. Nenhum DDL/DML/grant/compute/plano/transferência alterado.

Transporte direto real validou SSLRequest, TLS1.3, certificado autorizado e hostname, sem autenticação. Sessão pg/Prisma da aplicação não comprovada. ssl=false observado historicamente no conector não autoriza desabilitar TLS do aplicativo.

operator-credentials.private.json existe/é legível, aceita BOM e mantém DIRECT_URL vazia. **CREDENCIAL_NEON_PENDENTE**. Probe reexecutado na retomada: exit1/NEON_OPERATOR_DIRECT_URL_EMPTY, antes de conectar, sem fallback à .env. Neon CLI/API key local e mecanismo privado de gravação direta pelo conector não confirmados; segredo não enviado ao chat/argumentos/logs e ACLs não alteradas para recuperá-lo.

[Plano remoto](plano-integracao-remota.md): revisão SQL/hashes, locks/conflitos/normalização, backup consistente e ensaio de recuperação necessários. **Backup remoto consistente/recuperável não comprovado.** Primeira migração sem transação explícita; segunda BEGIN/COMMIT. Nenhum migrate deploy/reset/db push/migrate dev/seed remoto executado. Código zero do probe futuro não certifica sozinho equivalência estrutural completa.

## E. Prisma

Node24.20.0, CLI/Client/adapter-pg7.10.0, pg8.16.3. Generator JS/config separado/PrismaPg conferidos. CLI usa DIRECT_URL || DATABASE_URL; runtime somente DATABASE_URL, removendo segredos administrativos. Migração futura deve receber DIRECT_URL explicitamente para impedir fallback acidental local/runtime.

validate, generate pelo build e check passaram na rodada atual. prisma-prod-readonly.mjs status confirmou **duas migrações locais e schema atualizado** no loopback controlado. migrate status remoto não executado; remoto sem ledger não está pronto para endpoints persistidos.

| Migração preservada | SHA-256 |
|---|---|
| 20261011200553_init | d7850ea6c25a735a435e99e65bc54d503057b85a135800c9769afb189746539e |
| 20261012140000_categorias_avaliacoes | b4fd8165612a4eb2895ddaaca143a6534331173f340c99636bd6d2fe2f41fea2 |

PK/FK/unique/índices, categoria obrigatória, associação composta, cascatas e CHECK nota1–5 testados localmente. Média/contagem por aggregate. Seed administrativo atual é local/opt-in, não apaga dados nem cria avaliações e recusa Neon. Carga futura do JSON público requer implementação/revisão/aprovação separadas.

## F. Segurança

Bearer protege POST/PUT/PATCH/DELETE e POST de avaliação; GETs públicos. Token ausente/trivial recusado ao iniciar; HTTP com token ausente/inválido responde 401/WWW-Authenticate. CORS exato/none, JSON 100 KB, campos internos/desconhecidos/NUL, tipos/IDs/notas, nosniff e erros genéricos testados. Consultas Prisma parametrizadas/filtros literais examinados; sem interpolação de entrada HTTP demonstrada. Logs não incluem corpos/segredos; erros do driver não retornam ao cliente. Sem endpoints administrativos HTTP adicionais, rate limiting ou teste de carga/abuso; não se afirma capacidade ilimitada.

npm audit: zero vulnerabilidades conhecidas, sem garantia absoluta. Scanner final:112 candidatos, zero hits contra cinco fontes privadas/formatos reconhecidos; .env real/backup/dump/log/privados excluídos. Duas correspondências da inspeção de caminhos pessoais/emails eram URLs fictícias de testes; não se publicou dado pessoal de usuário. Histórico remoto vazio não substitui auditoria exaustiva.

Codex Security: nova tentativa falhou como duas históricas: `The selected scan target changed while the scan was starting. Try again.` Nenhum relatório canônico/scanID concluído. **Codex Security não aprovado.**

Alternativa efetivamente executada: **ESLint10.12.0 + eslint-plugin-security4.2.0**, somente em tmp/security-tools, sem alterar package/lock. 82 arquivos, zero erros, **168 avisos**:41 detect-object-injection,116 detect-non-literal-fs-filename,11 detect-unsafe-regex. Sem autofix/desativação. Evidência: backups/security-scan-master/eslint-security.private.json e summary.private.json.

Quatro hotspots runtime examinados: chaves fixas de configuração em database-config.js; remoção de variáveis próprias em load-runtime-env.js/runtime-env.js; campos de allowlist após rejeição de desconhecidos em validacao.js. Sem acesso/escrita arbitrária HTTP demonstrada nesses pontos. Outros164 avisos administrativos/testes não tiveram triagem independente integral; não chamá-los todos falsos positivos nem afirmar ausência de vulnerabilidades. Parser de sete scripts PowerShell: zero erros. Segurança/grants/TLS autenticado em produção não comprovados.

## G. Testes

Baseline atual antes das mudanças:192/192, backups/neon/readiness-2026-10-13T23-43-30-552Z-18640/summary.json. Rodada final completa: **196/196, zero falhas finais**, backups/neon/readiness-2026-10-14T00-07-42-356Z-26108/summary.json. Logs/casos no mesmo diretório: unitarios.txt, integration.json, lab08.json, powershell.txt, production-isolated-smoke.txt. Históricos preservados.

| Verificação/comando | Resultado | Limite |
|---|---|---|
| node scripts/verify-api-readiness.mjs | Exit0, todos os checks aprovados | Windows; bancos locais autorizados |
| npm test / Node test runner | 47/47 | Inclui12 guards,7 loader Neon,2 CORS,2 scanner; não autentica Neon |
| npm run test:integration | 80/80 | Banco local isolado |
| npm run test:lab08 | 39/39 | Contrato atual; não certifica PDF literal integral |
| test-powershell-isolated.mjs | 30/30 | Escrita só no isolado |
| node --check | 81 arquivos aprovados | Não executa código/SQL nem analisa TS |
| Prisma validate, build/generate, npm run check | Aprovados | Client7.10.0, sem migrate automático |
| prisma-prod-readonly.mjs status | Local atualizado,2 migrações | Não remoto |
| npm start production, PORT dinâmica,0.0.0.0,health/live,CORS/Bearer/cleanup | Dois smokes aprovados: origem exata e none | Banco local; SIGTERM por preload |
| --smoke-cleanup-regression | Aprovado; processo/porta encerrados | Falha forçada controlada |
| npm audit --json | Zero vulnerabilidades conhecidas | Não auditoria completa |
| check-publication-files.mjs | 112 candidatos,zero hits | Heurístico |
| ESLint/security e parser PowerShell | Executados:168 avisos / zero erros de parse | Codex não concluiu; triagem incompleta |
| Probe privado Neon na retomada | NEON_OPERATOR_DIRECT_URL_EMPTY | Bloqueado antes de autenticar |
| Transporte Neon e SQL READ ONLY conector | Executados separadamente | Não comprovam API autenticada |
| GitHub Actions Ubuntu 24.04/Node 24.21.0 | 47/47 unitários; ci/validate/build/check aprovados | Sem PostgreSQL remoto ou runtime HTTP integrado |
| Render/API pública/CRUD remoto/sinais/cold start | Não executados | Dependências/aprovação ausentes |

196 são casos das quatro suítes parcialmente sobrepostas; repetição não aumenta contagem. Quatro regressões adicionadas aos 192 anteriores. Smokes/parser/checks operacionais não somados aos 196. Nenhum total fictício de testes remotos aprovados/falhos. Após a retomada, YAML/script CI foram validados localmente; o push autorizado executou 47 unitários novamente em Linux. Essa repetição não aumenta os 196 casos locais. Nenhuma suíte de integração local foi repetida sem mudança de runtime.

Falha intermediária preservada:194 casos de suítes passaram, mas segundo smoke falhou por marcador reutilizado; correção e ambos smokes passaram em readiness-2026-10-13T23-53-12-070Z-7256/summary.json. Rodada final196 passou ambos. Falha forçada/cleanup: readiness-2026-10-13T23-56-12-821Z-4624/summary.json. Alvo divergente recusado: backups/neon/snapshot-regression.private.json. Todos esses diretórios readiness estão em backups/neon; falhas de harness não apagadas para alegar sucesso.

Após cada suíte final, contagens/SHA-256 das seis tabelas principal/isolada iguais aos snapshots iniciais; .env byte a byte igual. Principal:8 atrações,15 tags,32 vínculos,3 categorias,0 avaliações,2 ledger. Isolado:8/15/32/4/0/2, conforme snapshot inicial. Escritas/limpeza apenas em balsas_lab08_test_<número>. Sequências de fixtures podem avançar; não foram reduzidas nem confundidas com restauração da sequência. Nenhuma escrita no principal/Neon.

## H. GitHub

Destino [Francisco-alt-coder/-Balsas-Experience-API](https://github.com/Francisco-alt-coder/-Balsas-Experience-API), branch main. O usuário autorizou explicitamente commit/push de 112 arquivos, condicionado a integridade, ausência de segredos/arquivos extras, preservação de histórico e interrupção se qualquer controle falhasse. Nenhuma autorização de Neon/Render/credenciais foi inferida desse aceite.

Gate aprovado: ZIP SHA-256 ac1462cba0d4c2d68f4d3deb2788fab1c3df2ab6d78dff1e8ba9bf2773ad8a74; 112 hashes de workspace/index/ZIP iguais aos registrados; patch íntegro; apenas os 112 caminhos do manifesto; cinco fontes privadas comparadas, zero hits; branch main e remoto vazio reconfirmados imediatamente antes do envio. Simulação de push aprovada. Históricos originais preservados; nenhum force push.

Commit inicial [f40bb1585f8e8e95657f3ede7f7b71099c01785d](https://github.com/Francisco-alt-coder/-Balsas-Experience-API/commit/f40bb1585f8e8e95657f3ede7f7b71099c01785d), sem parents pois o destino estava vazio. Autor/committer existentes na configuração Git mantidos; assinatura criptográfica ausente, sem alegar commit assinado. Push normal/set-upstream concluído. ls-remote e API oficial confirmaram SHA; árvore remota 32c33720df7cfcdb199fec3d289539e1042540da sem truncamento. Os 112 paths/modes/tamanhos/blob SHAs foram comparados aos bytes aprovados: zero extras/ausentes, SQL histórico idêntico. Nada de .env real, privados, dumps, backups, logs, node_modules, tmp ou PDFs publicado; JSON turístico público incluído conforme manifesto.

[GitHub Actions 38490614729](https://github.com/Francisco-alt-coder/-Balsas-Experience-API/actions/runs/38490614729): event push, head SHA f40bb1585f8e8e95657f3ede7f7b71099c01785d, completed/success. Logs confirmam Ubuntu 24.04, Node 24.21.0, 47 tests/47 pass/0 fail. Instalação npm ci, Prisma validate, build/generate, check e npm test aprovados. Somente ambiente descartável, sem banco real ou segredos de produção. Isso comprova CI unitário Linux, não Express conectado ao Neon ou sinais/cold start Render.

Evidências privadas: backups/publicacao/autorizacao-20261013/preflight.private.json, push-verification.private.json, remote-content-verification.private.json, remote-tree.private.json, ci-run-1.private.json e ci-success.private.json. Manifesto/pacote original permanecem intactos em backups/publicacao/prompt-mestre-20261013, como registro exato do commit inicial.

O usuário também solicitou atualizar este relatório após a publicação. A atualização documental usa somente este caminho já listado no manifesto, sem novos arquivos públicos; um manifesto suplementar/hash e inspeção de segredos precedem o commit documental, preservando os outros 111 blobs. Seu SHA e a confirmação final de push/CI são registrados nas evidências privadas e no retorno ao usuário, evitando autorreferência circular do documento. README/estado/registro IA entregues no pacote inicial são snapshots da preparação; este relatório atualizado prevalece.

## I. Render

render.yaml.example inativo: Free/Virginia, Node24.20.0, autoDeployTrigger off; package na raiz/rootDir vazio; build `npm ci --include=dev && npm run build`; start `npm start`; HOST0.0.0.0; PORT da plataforma; health /health. Client gerado no build, sem migrate/seed. YAML e smokes locais não comprovam Linux/Render.

Requer DATABASE_URL dedicada verify-full, API_WRITE_TOKEN exclusivo, CORS_ORIGINS=none sem frontend, NODE_ENV production e limites DB existentes. Token só no arquivo privado local, não instalado; DATABASE_URL ausente. DIRECT_URL só operador. Banco vazio não torna endpoints persistidos funcionais.

Integração Render encontrada/sugerida, acesso não confirmado; CLI/API key/browser de operação indisponíveis. Nenhum serviço/cobrança/config/deploy criado. Conexão não equivale a aprovação de mudanças/custos. Retomar após Neon/config/GitHub prontos e aprovação concreta do serviço/deploy.

[Render Free](https://render.com/docs/free) consultado:15 minutos sem tráfego suspendem; retomada aproximadamente um minuto;750 horas mensais/workspace, filesystem efêmero e cotas build/banda. Demonstração acadêmica possível com limitações, sem comprovação de SLA/disponibilidade contínua. Nenhum plano pago. Modelo confrontado com a [especificação Blueprint](https://render.com/docs/blueprint-spec).

## J. API pública

**Nenhuma URL pública real da API validada nesta tarefa.** GitHub é repositório; hostname Neon é banco. Nenhum é endpoint HTTP da aplicação. Sem deploy, TLS HTTP externo, health/CRUD/persistência/reinício/cold start remotos. PUBLIC_API_URL não inventada; test-public-readonly.mjs preparado para HTTPS real futura. Escritas remotas só em ambiente/dados descartáveis autorizados.

## K. Pendências restantes

| Item | Causa / impacto / risco | Dependência e ação concreta |
|---|---|---|
| A01 | Credencial vazia; probe não autentica; exposição se enviada por chat/argumentos | Salvar só DIRECT_URL oficial direta verify-full no JSON privado pelo editor. Agente executará probe; não enviar valor ao chat |
| A02 | Schema/ledger ausentes; endpoints não funcionam; migração inicial sem transação explícita | Credencial, inventário atual, backup consistente/ensaio de recuperação; depois aprovação específica das2 migrações do plano |
| A03 | Runtime role ausente/owner excessivo | Schema e aprovação de role/grants; verificar Prisma em isolado, atributos/memberships e mínimos por objeto, sem ledger/DDL/TRUNCATE/setval |
| A04 | Token/CORS locais prontos, DBURL/segredos não instalados | Role/credencial e acesso/aprovação config Render; segredos privados/TLS/CORS. Frontend futuro exige domínio real |
| A05 — encerrado | Condições de aprovação satisfeitas; código publicado | Commit inicial/remoto/112 blobs verificados e CI aprovado; relatório atualizado no caminho já autorizado |
| A06 | Acesso Render/deploy ausentes | Conectar Render; depois aprovar serviço Free/deploy concreto quando dependências estiverem prontas. Carga JSON é decisão de dados separada |
| A07 | CI unitário Linux aprovado; runtime integrado/sinais/reinício/cold start ausentes | Executar esses checks após ambiente autorizado; CI unitário sozinho não encerra o item |
| A08 | Codex não inicia; alternativa deixa avisos sem triagem total | Retomar Codex quando estabilizar ou concluir triagem independente; sem alegar equivalência/aprovação Codex |

**Das oito pendências abertas anteriores, A05 foi RESOLVIDO. Sete permanecem abertas:** A01/A02/A03/A04/A06 BLOQUEADO; A07/A08 NÃO VERIFICADO. Avanços parciais: A04 token/CORS locais; A06 plano/integração disponível; A07 CI unitário Linux aprovado; A08 alternativa estática executada. Conexão/schema/grants/produção continuam pendentes.

Novos achados: marcador de smoke reutilizado corrigido (R03); scanner não cobria token novo, ampliado (R07); diferenças acadêmicas AC03/AC10/AC14 e publicação AC21/AC22 explicitadas. Não foram adicionadas artificialmente à contagem dos16. Não há nova falha local confirmada que impeça iniciar a API. Diferenças de contrato/schema e triagem estática incompleta permanecem limitações, não conformidade certificada.

## L. Histórico

Relatórios/evidências anteriores preservados. Baseline192 reproduzida, CORS none/marcadores/scanner corrigidos,4 regressões, CI/token/origin/pacote/documentação preparados. Rodada final196 sem falhas e dados/.env iguais. Retomada manteve alterações e conferiu provas/Neon/GitHub, completando documentação/index/manifesto. Versão 2.0.0 mantida; código versionado/publicado em GitHub, sem GitHub Release ou implantação da API.

Relatório anterior copiado para backups/neon/relatorio-historico-antes-prompt-mestre.md. Entradas antigas dos guias/estado são históricas. Após o aceite, commit/push GitHub foram executados como descrito em H. Nenhuma rotação de senha, alteração de ACL, migração histórica/dado real/infraestrutura ou deploy nesta etapa. Ações administrativas antigas não atribuídas a ela.

## M. Uso de IA

OpenAI Codex auxiliou inspeção, correções locais, testes/config/documentação e preparo de publicação. Resultados decorrem de ferramentas executadas; conectores oficiais forneceram metadados e SQL READ ONLY. [Registro IA](registro-uso-ia.md) separa contribuições anteriores, propostas, alterações e provas.

Usuário definiu objetivos/limites/destino e pediu definição da origem. Sem revisão/aceitação humana integral comprovada do código, matriz, avisos estáticos ou manifesto. Indicação anterior de preenchimento da credencial não confirmada no arquivo exato, ainda vazio. O usuário concedeu autorização condicional explícita para GitHub e atualização deste relatório; o agente verificou suas condições e executou commit/push/conferência remota/acompanhamento CI. Nenhuma revisão humana integral do código foi presumida. IA não inventou conexão da aplicação ou deploy/URL. Neon, permissões, dados, credenciais e Render permanecem fora dessa autorização.
