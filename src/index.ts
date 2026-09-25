import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import authRoutes from "./routes/auth";
import moviesRoutes from "./routes/movies";
import favoritesRoutes from "./routes/favorites";
import commentsRoutes from "./routes/comments";

/**
 * CATALOGO — o unico container com porta publicada.
 *
 * As rotas em /api/login, /api/register, /api/me, /api/forgot-password e
 * /api/reset-password existem aqui so como porta de entrada: elas repassam a
 * chamada ao auth-service (ver src/routes/auth.ts). De senha, hash, JWT, role
 * e expiracao de link o catalogo nao sabe nada.
 */
const app = new Hono();

app.route("/api", authRoutes);
app.route("/api/movies", moviesRoutes);
app.route("/api/favorites", favoritesRoutes);
app.route("/api/comments", commentsRoutes);

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

export default {
  port,
  fetch: app.fetch,
};
