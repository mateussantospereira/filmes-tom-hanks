import { Hono } from "hono";
import { db } from "../db";
import { favoritos } from "../db/schema";
import { eq, and, count } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { registrar, ipDe } from "../services/log-service";
import { LIMITE_FAVORITOS_GRATIS } from "../services/plano";
import type { Env } from "../types";

const favorites = new Hono<Env>();
favorites.use("/*", authMiddleware);

favorites.get("/", async (c) => {
  const usuarioId = c.get("usuarioId");
  const rows = await db
    .select()
    .from(favoritos)
    .where(eq(favoritos.usuarioId, usuarioId));
  return c.json(rows);
});

favorites.post("/", async (c) => {
  const usuarioId = c.get("usuarioId");
  const { tmdb_movie_id, titulo, poster_path } = await c.req.json();

  if (!tmdb_movie_id || !titulo) {
    return c.json({ error: "tmdb_movie_id e titulo são obrigatórios" }, 400);
  }

  /**
   * ATIVIDADE 7 — o benefício do Premium, verificável.
   *
   * O plano gratuito aceita ate `LIMITE_FAVORITOS_GRATIS` filmes. Quem assina
   * passa a nao ter limite. A checagem e no SERVIDOR (nao na tela): chamar a
   * API direto tambem recebe 403.
   *
   * `premium` vem do auth-service no `GET /me` a cada requisicao — assinou
   * agora, vale na proxima chamada, sem relogar.
   */
  if (!c.get("premium")) {
    const [linha] = await db
      .select({ total: count() })
      .from(favoritos)
      .where(eq(favoritos.usuarioId, usuarioId));

    if (Number(linha?.total ?? 0) >= LIMITE_FAVORITOS_GRATIS) {
      return c.json(
        {
          error: `O plano gratuito permite ${LIMITE_FAVORITOS_GRATIS} favoritos. Assine o Premium para favoritos ilimitados.`,
          permissao_exigida: "favorito:ilimitado",
          limite: LIMITE_FAVORITOS_GRATIS,
          premium: false,
        },
        403
      );
    }
  }

  try {
    await db.insert(favoritos).values({
      usuarioId,
      tmdbMovieId: tmdb_movie_id,
      titulo,
      posterPath: poster_path || null,
    });

    await registrar({
      acao: "favoritar",
      usuario_id: usuarioId,
      usuario: c.get("nome"),
      papel: c.get("role"),
      recurso: `filme:${tmdb_movie_id}`,
      detalhe: titulo,
      ip: ipDe(c),
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
  const usuarioId = c.get("usuarioId");
  const movieId = Number(c.req.param("movieId"));

  await db
    .delete(favoritos)
    .where(
      and(
        eq(favoritos.usuarioId, usuarioId),
        eq(favoritos.tmdbMovieId, movieId)
      )
    );

  await registrar({
    acao: "desfavoritar",
    usuario_id: usuarioId,
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `filme:${movieId}`,
    ip: ipDe(c),
  });

  return c.json({ message: "Removido dos favoritos" });
});

export default favorites;
