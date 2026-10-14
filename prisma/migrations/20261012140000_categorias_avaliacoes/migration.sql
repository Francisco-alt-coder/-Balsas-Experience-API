BEGIN;
CREATE TABLE "categorias" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "chave" TEXT NOT NULL
);
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");
CREATE UNIQUE INDEX "categorias_chave_key" ON "categorias"("chave");
ALTER TABLE "atracoes" ADD COLUMN "categoriaId" INTEGER;
INSERT INTO "categorias" ("nome", "chave")
SELECT min(regexp_replace(trim("categoria"), '\s+', ' ', 'g')),
       lower(regexp_replace(trim("categoria"), '\s+', ' ', 'g'))
FROM "atracoes" GROUP BY lower(regexp_replace(trim("categoria"), '\s+', ' ', 'g'))
ORDER BY 2;
UPDATE "atracoes" a SET "categoriaId" = c."id" FROM "categorias" c
WHERE c."chave" = lower(regexp_replace(trim(a."categoria"), '\s+', ' ', 'g'));
ALTER TABLE "atracoes" ALTER COLUMN "categoriaId" SET NOT NULL;
CREATE INDEX "atracoes_categoriaId_idx" ON "atracoes"("categoriaId");
ALTER TABLE "atracoes" ADD CONSTRAINT "atracoes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "avaliacoes" (
  "id" SERIAL PRIMARY KEY,
  "visitante" TEXT NOT NULL,
  "nota" INTEGER NOT NULL CHECK ("nota" BETWEEN 1 AND 5),
  "comentario" TEXT,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atracaoId" INTEGER NOT NULL
);
CREATE INDEX "avaliacoes_atracaoId_idx" ON "avaliacoes"("atracaoId");
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_atracaoId_fkey" FOREIGN KEY ("atracaoId") REFERENCES "atracoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
