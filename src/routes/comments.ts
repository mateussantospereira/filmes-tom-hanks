import { Hono } from "hono";
import { db } from "../db";
import { comentarios, usuarios } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { registrar, ipDe } from "../services/log-service";
import type { Env } from "../types";

const comments = new Hono<Env>();
comments.use("/*", authMiddleware);

/**
 * Lista todos os comentarios de um filme.
 * Permissao exigida: `ler:comentario`.
 */
comments.get("/:movieId", exigePermissao("ler:comentario"), async (c) => {
  const movieId = Number(c.req.param("movieId"));

  const rows = await db
    .select({
      id: comentarios.id,
      usuarioId: comentarios.usuarioId,
      tmdbMovieId: comentarios.tmdbMovieId,
      texto: comentarios.texto,
      criadoEm: comentarios.criadoEm,
      autor: usuarios.nome,
    })
    .from(comentarios)
    .leftJoin(usuarios, eq(comentarios.usuarioId, usuarios.id))
    .where(eq(comentarios.tmdbMovieId, movieId));

  return c.json(rows);
});

/** Permissao exigida: `criar:comentario`. */
comments.post("/", exigePermissao("criar:comentario"), async (c) => {
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

  await registrar({
    acao: "comentar",
    usuario_id: usuarioId,
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `filme:${tmdb_movie_id}`,
    detalhe: texto.length > 50 ? `${texto.slice(0, 47)}...` : texto,
    ip: ipDe(c),
  });

  return c.json({ message: "Comentário salvo" }, 201);
});

/**
 * A AÇÃO EXCLUSIVA DE ADMIN da atividade 4 — moderacao de comentarios.
 *
 * A regra, escrita em permissoes e nao em papeis:
 *
 *   - dono do comentario          -> pode apagar (`apagar:comentario`)
 *   - nao e dono                  -> so quem tem
 *     `apagar:comentario-de-outro`, que hoje so o papel `admin` tem
 *
 * Repare na ausencia de `role === "admin"` — a linha que existia antes. A rota
 * nao conhece papel nenhum: ela pergunta "esse chamador tem a permissao de
 * moderar?". Isso e o que a atividade chama de Permissao ser uma peca de
 * verdade: a decisao e sobre uma acao (`apagar:comentario-de-outro`), e o papel
 * e so quem carrega essa acao, la no mapa do auth-service.
 *
 * A checagem acontece no servidor e nao na tela. O front pode esconder o botao
 * de excluir do comentario alheio, mas quem chamar este endpoint direto pelo
 * Postman recebe 403 na mesma — e e isso que o requisito 3 cobra.
 */
comments.delete("/:id", async (c) => {
  const usuarioId = c.get("usuarioId");
  const role = c.get("role");
  const permissoes = c.get("permissoes");
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

  const ehDono = alvo.usuarioId === usuarioId;
  const podeModerar = permissoes.includes("apagar:comentario-de-outro");

  // Ownership e autorizacao sao duas perguntas, por isso ficam em duas partes.
  // `apagar:comentario` (que todos tem) ja foi concedido pelo mapa do
  // auth-service; falta saber se o alvo e de outra pessoa.
  if (!ehDono && !podeModerar) {
    return c.json(
      {
        error: "Ação negada: você só pode apagar os próprios comentários.",
        permissao_exigida: "apagar:comentario-de-outro",
        papel: role,
      },
      403
    );
  }

  await db.delete(comentarios).where(eq(comentarios.id, id));

  await registrar({
    acao: "apagar_comentario",
    usuario_id: usuarioId,
    usuario: c.get("nome"),
    papel: role,
    recurso: `comentario:${id}`,
    detalhe: ehDono ? "autorizacao:dono" : "autorizacao:moderacao",
    ip: ipDe(c),
  });

  return c.json({
    message: "Comentário removido",
    // Serve de prova na demonstracao: diz como a operacao foi autorizada.
    autorizacao: ehDono ? "dono" : "permissao:apagar:comentario-de-outro",
  });
});

export default comments;
