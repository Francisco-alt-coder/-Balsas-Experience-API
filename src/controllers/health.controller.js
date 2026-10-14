/** Fornece verificações distintas de acesso ao banco e de resposta do processo HTTP. */
/**
 * Cria GET /health com SELECT 1; falhas seguem para o middleware central.
 * @param {import("@prisma/client").PrismaClient} prisma - Cliente usado para verificar acesso ao banco.
 * @returns {import("express").RequestHandler} Handler de disponibilidade do banco.
 */
export function criarHealthCheck(prisma){
 return async(req,res,next)=>{try{await prisma.$queryRaw`SELECT 1`;res.json({status:'ok',banco:'conectado'});}catch(error){next(error);}};
}
// Liveness only: never claim database readiness here.
/**
 * GET /live: responde sobre o processo HTTP sem consultar o banco.
 */
export function liveness(req,res){res.json({status:'ok'});}
