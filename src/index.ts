import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import authRoutes from "./routes/auth";
import moviesRoutes from "./routes/movies";
import favoritesRoutes from "./routes/favorites";
import commentsRoutes from "./routes/comments";
import usuariosRoutes from "./routes/usuarios";
import logsRoutes from "./routes/logs";
import perfilRoutes from "./routes/perfil";
import { auditoria403Middleware } from "./middleware/auditoria";
import { garantirBucket, MINIO_BUCKET } from "./services/minio";

/**
 * CATALOGO — o unico container com porta publicada.
 *
 * As rotas em /api/login, /api/register, /api/me, /api/forgot-password e
 * /api/reset-password existem aqui so como porta de entrada: elas repassam a
 * chamada ao auth-service (ver src/routes/auth.ts). De senha, hash, JWT, role
 * e expiracao de link o catalogo nao sabe nada.
 */
const app = new Hono();

// Atividade 5 — auditoria de ações negadas (HTTP 403)
app.use("*", auditoria403Middleware);

app.route("/api", authRoutes);
app.route("/api/movies", moviesRoutes);
app.route("/api/favorites", favoritesRoutes);
app.route("/api/comments", commentsRoutes);
// Atividade 4 — exclusivo de admin: listar usuarios e trocar papel de alguem.
app.route("/api/usuarios", usuariosRoutes);
// Atividade 5 — exclusivo de admin: consultar stream de auditoria (Redis).
app.route("/api/logs", logsRoutes);
// Atividade 6 — perfil do usuario (bio + foto no object storage).
app.route("/api/perfil", perfilRoutes);

app.get("/api/*", (c) => c.json({ error: "Rota não encontrada" }, 404));

app.get("/login", serveStatic({ path: "./src/public/index.html" }));
app.get("/catalog", serveStatic({ path: "./src/public/catalog.html" }));

/**
 * O link de redefinicao de senha aponta para ca, e nao para o auth-service:
 * o e-mail chega no navegador, e o navegador so conhece este endereco. A
 * validacao do token acontece la atras, por dentro da rede do Docker.
 */
app.get("/reset-password", serveStatic({ path: "./src/public/reset.html" }));

app.get("/style.css", serveStatic({ path: "./src/public/style.css" }));
app.get("/app.js", serveStatic({ path: "./src/public/app.js" }));
app.get("/", serveStatic({ path: "./src/public/index.html" }));

const port = Number(process.env.PORT) || 3000;

console.log(
  `[catalogo] ouvindo na porta ${port} — autenticacao delegada para ` +
    `${process.env.AUTH_SERVICE_URL ?? "http://auth-service:3000"}`
);

// Atividade 6 — garante o bucket do MinIO na subida (com retry, sem travar o
// boot: se o MinIO estiver fora do ar, o catalogo sobe mesmo assim e passa a
// recusar upload com 503 ate o bucket reaparecer).
(async function prepararMinIO() {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      await garantirBucket();
      console.log(`[catalogo] bucket "${MINIO_BUCKET}" pronto no object storage`);
      return;
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.error(`[catalogo] object storage indisponivel (tentativa ${tentativa}/5): ${motivo}`);
      await new Promise((resolver) => setTimeout(resolver, 3000));
    }
  }
})();

export default {
  port,
  fetch: app.fetch,
};
