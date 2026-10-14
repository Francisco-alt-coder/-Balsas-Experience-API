# Registro de uso de Inteligência Artificial

**Ferramenta:** ChatGPT

**Finalidade:** apoio na organização da entrega final, revisão da arquitetura, integração proposta com Prisma/PostgreSQL, documentação e preparação de testes.

**Forma de utilização:** análise dos requisitos da atividade, geração assistida de código e documentação, com preservação dos endpoints desenvolvidos no laboratório.

**Contribuição da IA:** sugestão e elaboração inicial de arquivos de configuração do Prisma, modelagem das entidades, adaptação dos controllers para persistência no PostgreSQL, atualização do README e estruturação do documento de entrega.

**Validações e correções da equipe:** a equipe deve revisar o código, configurar a `DATABASE_URL` real, executar migrações, seed, testes HTTP e publicação, corrigindo qualquer diferença encontrada no ambiente real.

**Evidências preservadas:** histórico de prompts, versões dos arquivos, commits, capturas de testes e documentação gerada.

## Complemento — Codex, 11/10/2026

O registro acima é histórico. Nesta auditoria, Codex inspecionou a aplicação existente, corrigiu validação de entradas e scripts Prisma, implementou a sincronização de sequências, criou testes nativos do Node.js e bloco PowerShell 5.1 e executou verificações locais contra PostgreSQL 18.6.

Foram preservados relatórios reais de uma primeira integração com falha de POST, integração final com 69 aprovações, três testes unitários aprovados, PowerShell com TOTAL 29 e relatório npm audit. Contagens e hashes comprovaram preservação das tabelas. Não houve commit/push, execução do seed ou publicação; não foram produzidas capturas de tela nesta execução.

O usuário definiu requisitos e limites da auditoria. A equipe ainda deve revisar as alterações, decidir a correção compatível dos avisos npm, políticas de acesso e publicação e preencher dados acadêmicos reais. Não se presume revisão ou aprovação humana que não tenha ocorrido. Relatório completo preservado somente no workspace privado: docs/auditoria-tecnica.md.

## Complemento — auditoria final

Codex repetiu a inspeção e execução dos testes, adicionou SQL independente ao bloco PowerShell e verificações de CORS/padrões de PUT à integração. Também removeu uma credencial encontrada no arquivo de exemplo, sem alterar o `.env` funcional, e confirmou que os avisos npm afetam o conjunto de produção do lockfile atual.

Resultados reais desta rodada: 3 testes unitários, 71 verificações de integração e 30 verificações PowerShell aprovados; PowerShell repetido na porta 3000 com o mesmo resultado. A API foi iniciada com `npm start`. Arquitetura, registros preexistentes e evidências históricas foram preservados. Não houve migração, seed, troca de versão principal, commit ou push. Revisão humana, rotação da senha e políticas de publicação continuam pendentes. Evidências e limites preservados somente no workspace privado: docs/auditoria-final.md.

## Complemento — prompt mestre, 13/10/2026

Ferramenta: OpenAI Codex, com inspeção local de código/documentos, execução de comandos e conectores oficiais Neon/GitHub em leitura. O uso anterior de ChatGPT e os registros acima permanecem históricos. Não foi criado histórico Git artificial nem presumida revisão humana do código.

Sugestões da IA: separação do runtime/migrador, plano de recuperação e privilégios mínimos remotos, publicação Free com limitações e verificação posterior em Linux/Render. Esses planos não comprovam execução remota. A matriz acadêmica registra diferenças dos exemplos dos PDFs sem alterar os requisitos.

Alterações executadas nesta etapa: política CORS explícita none sem frontend publicado; correção de marcadores de encerramento entre duas instâncias de teste; scanner de publicação ampliado para cinco fontes privadas; regressões dessas correções; workflow de unitários Linux; origin local para o destino informado; preparação privada de um token novo; relatório, matriz acadêmica e plano remoto atualizados; pacote/manifesto de publicação preparado. Nenhum segredo foi incluído na documentação pública.

Verificações reais: 47 unitários, 80 integração, 39 Lab08 e 30 PowerShell aprovados; validate/build/check e migrate status local; smokes em modo production com CORS exato e none; regressão de limpeza após falha; snapshots de dados/.env preservados. Conector Neon confirmou banco vazio em READ ONLY e role runtime ausente; transporte direto validou TLS/certificado/hostname sem autenticação. npm audit não identificou vulnerabilidades conhecidas. Codex Security falhou ao iniciar; ESLint 10.12.0 + eslint-plugin-security 4.2.0 executou com zero erros e 168 avisos, sem validação exaustiva de todos eles. Resultados e evidências: [relatório final](relatorio-final-pendencias-publicacao.md).

Participação humana comprovada: o usuário forneceu objetivos, limites, destino e pediu que o agente determinasse a configuração de origem. Não há frontend público identificado; foi escolhida none, testada localmente. A indicação anterior de preenchimento do arquivo privado não se confirmou na leitura atual: DIRECT_URL continua vazia. Não há aprovação específica para commit/push, migração/roles/carga remotos ou deploy, nem aceitação humana integral dos testes ou divergências acadêmicas. Não foram produzidas capturas de tela nesta etapa.

Na retomada, o agente preservou o workspace, reconferiu a evidência de 196 testes e o inventário remoto em READ ONLY, atualizou o relatório e revisou o CI com actions v7/Node24 por SHA oficial. Validou localmente YAML/script, corrigiu codificação em dois trechos novos da documentação e referências a relatórios privados, e concluiu manifesto/pacote/index. Não repetiu as suítes sem mudança de runtime nem declarou CI aprovado no GitHub.

Pendências de revisão humana: conferir alterações e manifesto público; disponibilizar credencial Neon por armazenamento privado; disponibilizar acesso Render e aprovar separadamente as operações com impacto. A IA não publicou a API, não executou migrações remotas e não certificou funcionamento em produção.
