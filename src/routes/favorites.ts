import { Hono } from "hono";
import { db } from "../db";
import { favoritos } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

const favorites = new Hono();
favorites.use("/*", authMiddleware);

favorites.get("/", async (c) => {
  const usuarioId = c.get("usuarioId") as number;
  const rows = await db
    .select()
    .from(favoritos)
    .where(eq(favoritos.usuarioId, usuarioId));
  return c.json(rows);
});

favorites.post("/", async (c) => {
  const usuarioId = c.get("usuarioId") as number;
  const { tmdb_movie_id, titulo, poster_path } = await c.req.json();

  if (!tmdb_movie_id || !titulo) {
    return c.json({ error: "tmdb_movie_id e titulo são obrigatórios" }, 400);
  }

  try {
    await db.insert(favoritos).values({
      usuarioId,
      tmdbMovieId: tmdb_movie_id,
      titulo,
      posterPath: poster_path || null,
    });
    return c.json({ message: "Filme favoritado" }, 201);
  } catch (err: any) {
    if (err?.cause?.message?.includes("Duplicate")) {
      return c.json({ error: "Filme já favoritado" }, 409);
    }
    throw err;
  }
});

favorites.delete("/:movieId", async (c) => {
  const usuarioId = c.get("usuarioId") as number;
  const movieId = Number(c.req.param("movieId"));

  await db
    .delete(favoritos)
    .where(
      and(
        eq(favoritos.usuarioId, usuarioId),
        eq(favoritos.tmdbMovieId, movieId)
      )
    );

  return c.json({ message: "Removido dos favoritos" });
});

export default favorites;
