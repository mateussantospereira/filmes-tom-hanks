import { Hono } from "hono";
import authRoutes from "./routes/auth";
import passwordRoutes from "./routes/password";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { config } from "./config";
import {
  avisoSchemaPendente,
  schemaEstaCompleto,
  verificarSchema,
  type Pendencia,
} from "./services/schema-check";

/**
 * auth-service — microsservico de autenticacao do Catalogo de Filmes.
 *
 * Ele mora num container proprio e NAO tem porta publicada no docker-compose.yml:
 * a unica forma de alcancar este servico e de dentro da rede do Docker, pelo
 * nome `auth-service`. Quem entra pela internet (o navegador) fala com o
 * catalogo, e o catalego repassa a chamada para ca.
 *
 * Responsabilidades (todas aqui, e so aqui):
 *   - cadastro e login
 *   - papeis de usuario (role) e o endpoint que responde "quem e esse usuario?"
 *   - geracao, envio e validacao do link de recuperacao de senha
 */

const app = new Hono();

/** Estado do schema, conferido uma vez no boot (e atualizado no /health). */
let pendencia: Pendencia | null = null;

/** Usado pelo healthcheck do container e para conferir o servico de fora. */
app.get("/health", async (c) => {
  try {
    pendencia = await verificarSchema();
  } catch {
    pendencia = null;
  }

  if (!pendencia) {
    return c.json({ status: "erro", servico: "auth-service", banco: "inacessivel" }, 503);
  }

  if (!schemaEstaCompleto(pendencia)) {
    return c.json(
      { status: "erro", servico: "auth-service", schema: "pendente", ...pendencia },
      503
    );
  }

  return c.json({ status: "ok", servico: "auth-service" });
});

app.route("/", authRoutes);
app.route("/", passwordRoutes);

app.notFound((c) => c.json({ error: "Rota não encontrada no auth-service" }, 404));

// Handler de erro unico: uma excecao nao pode estourar um HTML de stack trace
// para o catalogo. O catalogo precisa de JSON para poder repassar a resposta.
app.onError((erro, c) => {
  console.error("[auth-service] erro nao tratado:", erro);
  return c.json({ error: "Erro interno no serviço de autenticação" }, 500);
});

try {
  pendencia = await verificarSchema();
} catch (erro) {
  console.error("[auth-service] nao consegui falar com o banco no boot:", erro);
  console.error(avisoSchemaPendente({ temColunaRole: false, temTabelaResetTokens: false }));
}

if (pendencia && !schemaEstaCompleto(pendencia)) {
  console.error(avisoSchemaPendente(pendencia));
}

console.log(
  `[auth-service] ouvindo na porta ${config.port} (container) — ` +
    `link de recuperacao aponta para ${config.app.publicUrl}${config.reset.path} — ` +
    `reset expira em ${config.reset.ttlMinutos} min — ` +
    `e-mail via ${config.mail.host || "SMTP nao configurado (modo log)"}`
);

export default {
  port: config.port,
  fetch: app.fetch,
};
