import { Hono } from "hono";
import { db } from "../db";
import { comentarios } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

const comments = new Hono();
comments.use("/*", authMiddleware);

comments.get("/:movieId", async (c) => {
  const usuarioId = c.get("usuarioId") as number;
  const movieId = Number(c.req.param("movieId"));

  const rows = await db
    .select()
    .from(comentarios)
    .where(
      and(
        eq(comentarios.usuarioId, usuarioId),
        eq(comentarios.tmdbMovieId, movieId)
      )
    );

  return c.json(rows);
});

comments.post("/", async (c) => {
  const usuarioId = c.get("usuarioId") as number;
  const { tmdb_movie_id, texto } = await c.req.json();

  if (!tmdb_movie_id || !texto) {
    return c.json({ error: "tmdb_movie_id e texto são obrigatórios" }, 400);
  }

  await db.insert(comentarios).values({
    usuarioId,
    tmdbMovieId: tmdb_movie_id,
    texto,
  });

  return c.json({ message: "Comentário salvo" }, 201);
});

export default comments;
