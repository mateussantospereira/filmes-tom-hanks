import { defineConfig } from "drizzle-kit";

/**
 * O auth-service e DONO das tabelas `usuarios` e `reset_tokens`.
 * O `tablesFilter` garante que este servico nunca vai criar, alterar ou
 * dropar `favoritos` / `comentarios`, que pertencem ao catalogo.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  tablesFilter: ["usuarios", "reset_tokens"],
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  },
});
