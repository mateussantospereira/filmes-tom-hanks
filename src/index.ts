import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import authRoutes from "./routes/auth";
import moviesRoutes from "./routes/movies";
import favoritesRoutes from "./routes/favorites";
import commentsRoutes from "./routes/comments";

const app = new Hono();

app.route("/api", authRoutes);
app.route("/api/movies", moviesRoutes);
app.route("/api/favorites", favoritesRoutes);
app.route("/api/comments", commentsRoutes);

app.get("/api/*", (c) => c.json({ error: "Rota não encontrada" }, 404));

app.get("/login", serveStatic({ path: "./src/public/index.html" }));
app.get("/catalog", serveStatic({ path: "./src/public/catalog.html" }));
app.get("/style.css", serveStatic({ path: "./src/public/style.css" }));
app.get("/app.js", serveStatic({ path: "./src/public/app.js" }));
app.get("/", serveStatic({ path: "./src/public/index.html" }));

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
