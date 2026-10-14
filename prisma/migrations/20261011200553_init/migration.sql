-- CreateTable
CREATE TABLE "atracoes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "cidade" TEXT NOT NULL DEFAULT 'Balsas',
    "estado" TEXT NOT NULL DEFAULT 'MA',
    "distanciaCentroKm" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atracao_tags" (
    "atracaoId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "atracao_tags_pkey" PRIMARY KEY ("atracaoId","tagId")
);

-- CreateIndex
CREATE INDEX "atracoes_categoria_idx" ON "atracoes"("categoria");

-- CreateIndex
CREATE INDEX "atracoes_cidade_idx" ON "atracoes"("cidade");

-- CreateIndex
CREATE UNIQUE INDEX "tags_nome_key" ON "tags"("nome");

-- CreateIndex
CREATE INDEX "atracao_tags_tagId_idx" ON "atracao_tags"("tagId");

-- AddForeignKey
ALTER TABLE "atracao_tags" ADD CONSTRAINT "atracao_tags_atracaoId_fkey" FOREIGN KEY ("atracaoId") REFERENCES "atracoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atracao_tags" ADD CONSTRAINT "atracao_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
