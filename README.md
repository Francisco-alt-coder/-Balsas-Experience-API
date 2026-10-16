# Balsas Experience API

Projeto da disciplina **Programação para Web**, do curso de Análise e Desenvolvimento de Sistemas.

Nossa ideia foi criar um guia de atrações turísticas de **Balsas (MA)**. O visitante pode explorar os lugares em uma página organizada, e quem desenvolve sistemas também pode consultar os dados pela API REST.

## Integrantes

- Caio Vinícius Lima Soares
- Francisco Wesley de Souza Dias
- David Rodrigues Costa
- Pedro Henrique Guedes

## Veja o projeto funcionando

- **Site com as atrações:** https://balsas-experience-api-g7ru.onrender.com/explorar
- **Endereço da API:** https://balsas-experience-api-g7ru.onrender.com
- **Lista em JSON:** https://balsas-experience-api-g7ru.onrender.com/atracoes?formato=json
- **Exemplo de atração:** https://balsas-experience-api-g7ru.onrender.com/atracoes/1
- **Verificar servidor e banco:** https://balsas-experience-api-g7ru.onrender.com/health

O site está no plano gratuito do Render. Depois de um tempo sem acessos, a primeira abertura pode demorar um pouco.

## O que o projeto faz

- Mostra as atrações de Balsas em um catálogo com pesquisa, categorias e ordenação.
- Abre uma página para cada atração, com descrição, localização e outras informações cadastradas.
- Exibe o JSON da atração de forma organizada, com botão para copiar.
- Disponibiliza uma API REST para listar, buscar, cadastrar, editar e excluir atrações.
- Trabalha com categorias, tags e avaliações por meio do banco de dados.
- Protege as operações de escrita com token Bearer.

**Importante:** a interface pública é para consulta. Cadastrar, editar, excluir e registrar avaliações são operações da API e exigem autorização.

## Tecnologias usadas

**Node.js 24**, **Express 5**, **JavaScript**, **HTML**, **CSS**, **Prisma 7** e **PostgreSQL**. Usamos o **Neon** para o banco publicado, o **Render** para hospedar a aplicação e o **GitHub** para guardar e acompanhar o código.

## Como rodar no seu computador

Você vai precisar de **Node.js 24**, **npm**, **Git** e acesso a um **PostgreSQL** configurado (local ou de desenvolvimento). Os comandos abaixo funcionam no PowerShell do Windows.

**1. Baixe o projeto:**

~~~powershell
git clone https://github.com/Francisco-alt-coder/-Balsas-Experience-API.git balsas-experience-api
cd balsas-experience-api
~~~

**2. Instale as dependências:**

~~~powershell
npm ci --include=dev
~~~

**3. Crie seu arquivo de configuração:**

~~~powershell
Copy-Item .env.example .env
~~~

Abra o arquivo `.env` e preencha principalmente:

~~~dotenv
DATABASE_URL="postgresql://usuario:senha@localhost:5432/balsas_experience?schema=public"
API_WRITE_TOKEN="substitua_por_um_segredo_aleatorio_com_32_ou_mais_caracteres"
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
~~~

Esses valores são **exemplos**, não credenciais reais. O `API_WRITE_TOKEN` precisa ser um segredo forte, aleatório, com pelo menos 32 caracteres e sem espaços. Mantenha seu `.env` privado e nunca envie senhas ou tokens para o GitHub.

**4. Prepare o Prisma e o banco:**

~~~powershell
npm run prisma:generate
npx prisma validate --config prisma7.config.ts
~~~

Se estiver usando **um banco novo de desenvolvimento**, prepare as tabelas com um usuário autorizado:

~~~powershell
npm run db:migrate:deploy
~~~

Em bancos já existentes, confira o histórico de migrações antes de aplicar qualquer alteração. Não execute migrações, `db:seed` ou comandos de reset no Neon de produção apenas para testar o projeto. Para tarefas administrativas, use credenciais separadas e privadas, conforme a documentação em `docs/`.

**5. Inicie a API:**

~~~powershell
npm run dev
~~~

Ou, sem reinício automático ao alterar arquivos:

~~~powershell
npm start
~~~

Agora abra **http://localhost:3000/explorar**. A porta padrão é `3000`, mas você pode alterá-la no `.env`.

## Testando as rotas

No navegador:

- Catálogo visual: http://localhost:3000/explorar
- Atrações em JSON: http://localhost:3000/atracoes?formato=json
- Detalhes em JSON: http://localhost:3000/atracoes/1?formato=json
- Saúde do serviço: http://localhost:3000/health

Se quiser testar pelo PowerShell:

~~~powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/categorias
Invoke-RestMethod 'http://localhost:3000/atracoes?q=rio'
~~~

Principais endpoints:

| Método | Rota | Para que serve |
| --- | --- | --- |
| GET | `/` | Informações da API |
| GET | `/live` | Verifica se o servidor responde |
| GET | `/health` | Verifica a conexão com o banco |
| GET | `/atracoes` | Lista e filtra atrações |
| GET | `/atracoes/:id` | Busca uma atração |
| GET | `/categorias` | Lista categorias |
| POST | `/atracoes` | Cadastra atração (Bearer) |
| PUT / PATCH | `/atracoes/:id` | Atualiza atração (Bearer) |
| DELETE | `/atracoes/:id` | Exclui atração (Bearer) |
| POST | `/atracoes/:id/avaliacoes` | Cadastra avaliação (Bearer) |

Em navegadores, `/atracoes` e `/atracoes/:id` mostram páginas HTML. Para receber JSON nessas URLs, use `?formato=json` ou envie o cabeçalho `Accept: application/json`.

## Como verificar o código

~~~powershell
npm run check
npm test
npm run build
~~~

Há também testes de integração (como `npm run test:integration` e `npm run test:lab08`), mas eles dependem de **um banco de testes isolado** e de configurações próprias. Não aponte esses testes para o banco publicado.

## Organização dos arquivos

- `src/`: servidor Express, rotas, controladores, segurança e acesso ao banco.
- `public/`: páginas HTML, estilos e scripts do catálogo.
- `prisma/`: modelos, migrações e dados de exemplo.
- `tests/`: testes automatizados.
- `scripts/`: scripts de verificação e manutenção.
- `docs/`: documentação técnica, testes e registros da evolução do projeto.

## Observações

O site público mostra os dados já cadastrados. Ainda não oferece login individual nem formulário público para cadastrar atrações. O token Bearer é usado nas operações protegidas e **não deve ficar no código do navegador**. O Render gratuito pode suspender o serviço por inatividade.

O **ChatGPT foi utilizado como apoio** na construção e revisão de partes do código, da interface, dos testes e da documentação. A equipe é responsável por revisar, entender e validar o trabalho. Os detalhes técnicos e os registros de uso de IA ficam em `docs/`.
