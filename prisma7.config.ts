/** Configura caminhos do Prisma CLI e prioriza DIRECT_URL para sua conexão, quando definida. */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
