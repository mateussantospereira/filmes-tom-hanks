import { Hono } from "hono";
import { db } from "../db";
import { comentarios } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { Env } from "../types";

const comments = new Hono<Env>();
comments.use("/*", authMiddleware);

comments.get("/:movieId", async (c) => {
  const usuarioId = c.get("usuarioId");
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
  const usuarioId = c.get("usuarioId");
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

/**
 * Exemplo de autorizacao baseada no PAPEL.
 *
 * O catalogo nao sabe se o usuario e admin: ele perguntou ao auth-service no
 * middleware e recebeu o papel. A partir dai a regra e local, do catalogo:
 * quem e dono do comentario apaga o proprio; admin apaga o de qualquer um.
 */
comments.delete("/:id", async (c) => {
  const usuarioId = c.get("usuarioId");
  const role = c.get("role");
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id)) {
    return c.json({ error: "Comentário inválido" }, 400);
  }

  const [alvo] = await db
    .select({ id: comentarios.id, usuarioId: comentarios.usuarioId })
    .from(comentarios)
    .where(eq(comentarios.id, id))
    .limit(1);

  if (!alvo) {
    return c.json({ error: "Comentário não encontrado" }, 404);
  }

  if (alvo.usuarioId !== usuarioId && role !== "admin") {
    return c.json({ error: "Você não pode apagar o comentário de outro usuário" }, 403);
  }

  await db.delete(comentarios).where(eq(comentarios.id, id));

  return c.json({ message: "Comentário removido" });
});

export default comments;
