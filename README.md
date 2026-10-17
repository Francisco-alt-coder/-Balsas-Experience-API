# Balsas Experience API

Projeto da disciplina **Programação para Web**, do curso de Análise e Desenvolvimento de Sistemas. Criamos um catálogo de atrações turísticas de Balsas (MA) e uma API para consultar esses dados.

## Integrantes

- Caio Vinícius Lima Soares
- Francisco Wesley de Souza Dias
- David Rodrigues Costa
- Pedro Henrique Guedes

## Acesse o projeto

- [Ver o catálogo de atrações](https://balsas-experience-api-g7ru.onrender.com/explorar)
- [Página inicial da API](https://balsas-experience-api-g7ru.onrender.com/)
- [Lista de atrações em JSON](https://balsas-experience-api-g7ru.onrender.com/atracoes?formato=json)
- [Exemplo de atração](https://balsas-experience-api-g7ru.onrender.com/atracoes/1)
- [Verificar API e banco](https://balsas-experience-api-g7ru.onrender.com/health)

O site está hospedado no plano gratuito do Render, por isso pode demorar um pouco para abrir depois de um período sem acessos.

## O que foi desenvolvido

- Catálogo com pesquisa, categorias, ordenação e página de detalhes.
- API REST para consultar, cadastrar, atualizar e excluir atrações.
- Cadastro de categorias, tags e avaliações no banco de dados.
- Validação dos dados recebidos e proteção das operações de escrita com token Bearer.

A **página pública é só para consulta**. O cadastro, a edição e a exclusão são feitos por requisições à API com autorização. Não existe login individual de usuários na interface.

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Interface | HTML, CSS e JavaScript |
| Servidor e rotas | Node.js 24 e Express 5 |
| Banco e acesso aos dados | PostgreSQL e Prisma 7 |
| Hospedagem | Render (API) e Neon (PostgreSQL) |
| Código e testes | GitHub e GitHub Actions |

**Como funciona:** o navegador carrega as páginas da pasta `public/`. Os scripts pedem dados às rotas da API em `src/`. O Prisma consulta o PostgreSQL e o Express devolve os resultados em JSON. Veja também [a explicação do projeto](docs/como-funciona.md).

## Rodando no computador

Você precisa instalar **Node.js 24**, **Git** e ter um **PostgreSQL de desenvolvimento** disponível. Exemplo no PowerShell do Windows:

**1. Baixe e entre na pasta:**

~~~powershell
git clone https://github.com/Francisco-alt-coder/-Balsas-Experience-API.git balsas-experience-api
cd balsas-experience-api
~~~

**2. Instale as dependências:**

~~~powershell
npm ci --include=dev
~~~

**3. Crie o arquivo de configuração:**

~~~powershell
Copy-Item .env.example .env
~~~

Abra `.env` e configure `DATABASE_URL` para seu banco de desenvolvimento e `API_WRITE_TOKEN` com um segredo aleatório de pelo menos 32 caracteres. As outras opções já têm valores de exemplo. **Nunca publique o `.env`, senhas ou tokens no GitHub.**

**4. Prepare o Prisma:**

~~~powershell
npm run build
npx prisma validate --config prisma7.config.ts
~~~

Somente se estiver usando **um banco de desenvolvimento novo**, com permissão para criar as tabelas, execute:

~~~powershell
npm run db:migrate:deploy
~~~

**Não execute migrações, seed ou reset no Neon de produção para testar o projeto.**

**5. Inicie o servidor:**

~~~powershell
npm run dev
~~~

Abra [http://localhost:3000/explorar](http://localhost:3000/explorar). Para executar sem reinício automático, use `npm start`.

## Principais rotas

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/` | Informações da API |
| GET | `/live` | Verifica se o servidor responde |
| GET | `/health` | Verifica a conexão com o banco |
| GET | `/atracoes` | Lista e filtra atrações |
| GET | `/atracoes/:id` | Detalhes de uma atração |
| GET | `/categorias` | Lista categorias |
| POST | `/atracoes` | Cadastra atração (token) |
| PUT / PATCH | `/atracoes/:id` | Atualiza atração (token) |
| DELETE | `/atracoes/:id` | Exclui atração (token) |
| POST | `/atracoes/:id/avaliacoes` | Registra avaliação (token) |

No navegador, `/atracoes` e `/atracoes/:id` podem abrir páginas HTML. Para receber JSON, acrescente `?formato=json` ou envie `Accept: application/json`.

Exemplo de consulta no PowerShell:

~~~powershell
Invoke-RestMethod 'http://localhost:3000/atracoes?formato=json'
Invoke-RestMethod 'http://localhost:3000/categorias'
~~~

## Testes

~~~powershell
npm run check
npm test
npm run build
~~~

O GitHub Actions executa essas verificações e também valida o schema do Prisma. Os testes unitários usam dados simulados; os testes de integração precisam de um **banco de testes isolado** e de configuração própria. Não use o banco publicado para testá-los.

## Organização

- `src/`: servidor Express, rotas, controladores e acesso ao banco.
- `public/`: páginas, estilos e JavaScript do catálogo.
- `prisma/`: modelos, migrações e dados de exemplo.
- `tests/`: testes automatizados.
- `scripts/`: verificações e manutenção.
- `docs/`: explicação do projeto, guias técnicos e registros acadêmicos.

## Limitações e uso de IA

A interface pública não possui login individual nem formulário para cadastrar atrações. Algumas verificações de integração dependem de ambiente local preparado. A hospedagem gratuita pode entrar em repouso.

O ChatGPT foi utilizado como apoio na escrita, revisão e organização de partes do código, testes e documentação. A equipe deve revisar e compreender as mudanças e comprovar os resultados. O registro de uso está em [docs/registro-uso-ia.md](docs/registro-uso-ia.md).
