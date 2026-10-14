# Instalação e execução local

Usar a pasta que contém package.json, Node 24.x e PostgreSQL compatível. Na máquina desta entrega, .env e banco já estão preparados; não sobrescrevê-los. Em clone novo, copiar .env.example para .env e fornecer credenciais locais privadas e Bearer forte antes de executar a API.

```powershell
npm ci --include=dev
npm run build
npx prisma validate --config prisma7.config.ts
npm test
npm start
```

PORT local padrão 3000; produção recebe PORT e usa HOST=0.0.0.0. Runtime exige DATABASE_URL e API_WRITE_TOKEN não trivial; produção exige CORS_ORIGINS com origens exatas. Conexão remota de produção exige sslmode=verify-full. Não adicionar DIRECT_URL ao processo web. Pool/timeouts e variáveis são descritos no README.

Em banco novo, criação de base/papéis, backup e migrações precisam de autorização própria. Para CLI remota, usar ambiente privado .env.migration e a versão 7.10.0 instalada; não executar reset/db push/seed em base existente. Os dois arquivos de migração da entrega já estão aplicados localmente.

Ver [testes](guia-testes.md), [Prisma/Neon](guia-prisma-neon.md) e [publicação](guia-publicacao-final.md). Instalação limpa desta rodada não copiou .env, backups ou credenciais para a árvore de execução.
