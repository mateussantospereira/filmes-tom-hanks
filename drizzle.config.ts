import { defineConfig } from "drizzle-kit";

/**
 * O catalogo e DONO apenas das tabelas `favoritos` e `comentarios`.
 * `usuarios` e `reset_tokens` sao do auth-service e por isso nao entram no
 * schema abaixo. O `tablesFilter` impede que um `db:push` do catalogo tente
 * dropar a tabela `usuarios` (que ele simplesmente nao enxerga).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  tablesFilter: ["favoritos", "comentarios", "perfis"],
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  },
});
