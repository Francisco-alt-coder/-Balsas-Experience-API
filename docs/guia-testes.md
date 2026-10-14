# Testes e reprodução

```powershell
npm test
npm run check
npm run build
npm audit --include=dev --cache .npm-cache
```

Unitários validam configurações, Bearer, controllers, health, isolamento de ambiente/URI e guardas da operação administrativa; não executam rotação. Em clone novo, usar configuração runtime sintaticamente válida e token privado quando a configuração do teste exigir; sem dados reais ou fonte administrativa copiada para CI.

Na entrega local com a base isolada já autorizada:

```powershell
node scripts/run-isolated-suites.mjs
node scripts/run-isolated-suites.mjs powershell
node scripts/final-publication-checks.mjs
node scripts/test-clean-install-final.mjs
```

Integração e Lab08 usam backups/test-env.json e fixture-env.json privados; runtime balsas_api, fixtures balsas_migrate, mesma base com prefixo balsas_lab08_test_. O launcher de isolamento exige credentials.json/baseline.json próprios. Em outra máquina, preparar uma base de testes isolada e fontes privadas compatíveis, com autorização específica; não copiar senhas desta entrega ou apontar testes para a principal. Não é configuração pública de CI.

A matriz de produção inicia npm start em portas temporárias, com NODE_ENV=production, HOST/PORT fornecidos e credencial runtime. Proxy local próprio testa queda/recuperação sem parar PostgreSQL. Senha inválida é fictícia; nenhuma senha é alterada. O preload de encerramento só existe na execução de teste: não configurar NODE_OPTIONS/BALSAS_TEST_STOP_FILE no Render. O evento SIGTERM local valida o handler; entrega real de sinal em Linux permanece teste remoto.

Instalação limpa cria tmp/publicacao-clean-* novo, copia somente código/configuração/lockfile e usa ambiente runtime em memória. Faz ci/build/schema/unitários, remove devDependencies somente da árvore temporária validada e confirma dependências/start/health/encerramento com runtime de produção. Evidências operacionais ficam em backups/ ou docs JSON/TXT ignorados; não somar repetições do mesmo teste como cobertura nova.

Resultados atuais e falhas corrigidas: [estado-publicacao.md](estado-publicacao.md).

