# Recuperação operacional

Preservar fonte de dados local e backups com hashes; nunca apagar dump ou restaurar sobre banco com dados sem aprovação. Fonte administrativa vigente é privada e protegida por ACL; a antiga foi rejeitada e não deve ser restaurada.

Auditoria comum usa migrador em READ ONLY; HBA e recuperação administrativa são operações explícitas separadas. rollback-check/review-prod-rollback são leitura por padrão. Não usar -Apply, modificar HBA, rotacionar novamente, criar roles ou reiniciar serviço com esta preparação.

Na publicação futura, registrar snapshot aprovado, URLs/configuração privadas anterior e nova, versão e estado de migrações. Se o novo serviço falhar, preservar ambos os bancos e avaliar compatibilidade/novas escritas antes de retornar tráfego à configuração aprovada anterior. Nunca tratar backup de dados como recuperação de senha.

Se uma conexão falhar: distinguir DNS/TCP/TLS/autenticação/HBA/pool e usar logs sanitizados/health. Não converter erro em 200 nem interromper PostgreSQL saudável para reproduzir. Sessões preexistentes não foram encerradas pela rotação. Recuperação emergencial que altera serviço/HBA/terceiros exige autorização específica.

Procedimento e hashes da rotação em [estado-publicacao.md](estado-publicacao.md); plano remoto em [guia-publicacao-final.md](guia-publicacao-final.md).
