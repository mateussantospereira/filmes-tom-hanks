import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { perfis, favoritos } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { registrar, ipDe } from "../services/log-service";
import { perfilPublico } from "../services/auth-service";
import {
  enviarFoto,
  obterFoto,
  removerFoto,
  detectarFormato,
  garantirBucket,
  TAMANHO_MAX_FOTO,
} from "../services/minio";
import type { Env } from "../types";

/**
 * PERFIL DE USUARIO (atividade 6) — o catalogo vira uma rede social.
 *
 * O arquivo (a foto) vai para o MINIO; o MariaDB (`perfis`) guarda SO a
 * chave. O navegador nunca fala com o MinIO: quem entrega os bytes e esta
 * rota (GET /:id/foto), validando a sessao — por isso o bucket fica privado
 * (decisao documentada no README).
 *
 * DONO do recurso: o proprio usuario. A regra da atividade 4 aplicada aqui:
 * o `id` de outra pessoa na URL NAO conta — quem manda e a identidade do
 * token (chegada no `authMiddleware` via GET /me do auth-service). Enviou o
 * id de outro? 403, sem nem olhar o corpo.
 */

const perfil = new Hono<Env>();
perfil.use("/*", authMiddleware);

/** Resposta 403 no MESMO formato do `exigePermissao` — o middleware de
 *  auditoria (atividade 5) captura `permissao_exigida` e grava `acao_negada`. */
function recusaNaoDono(c: Context<Env>, idRecebido: number) {
  return c.json(
    {
      error: "Ação negada: você só pode editar o seu próprio perfil.",
      permissao_exigida: "editar:perfil-proprio",
      papel: c.get("role"),
      id_recebido: idRecebido,
      sua_conta: c.get("usuarioId"),
    },
    403
  );
}

type LinhaPerfil = { bio: string | null; fotoChave: string | null };

async function linhaDoPerfil(usuarioId: number): Promise<LinhaPerfil | null> {
  const [linha] = await db
    .select({ bio: perfis.bio, fotoChave: perfis.fotoChave })
    .from(perfis)
    .where(eq(perfis.usuarioId, usuarioId))
    .limit(1);
  return linha ?? null;
}

/** Dados comuns a propria pagina e a de outra pessoa (o que a foto vira URL). */
function montarPerfil(
  id: number,
  nome: string,
  role: string,
  linha: LinhaPerfil | null,
  favoritosDoUsuario: typeof favoritos.$inferSelect[],
  meuPerfil: boolean
) {
  const fotoChave = linha?.fotoChave ?? null;
  return {
    id,
    nome,
    role,
    bio: linha?.bio ?? null,
    fotoChave,
    // A URL NAO expoe a chave interna: quem serve o binario e o catalogo.
    fotoUrl: fotoChave ? `/api/perfil/${id}/foto` : null,
    favoritos: favoritosDoUsuario.map((f) => ({
      tmdbMovieId: f.tmdbMovieId,
      titulo: f.titulo,
      posterPath: f.posterPath,
    })),
    meuPerfil,
  };
}

/** GET /api/perfil — o MEU perfil (nome vem da sessao, favoritos do banco). */
perfil.get("/", async (c) => {
  const usuarioId = c.get("usuarioId");
  const [linha, favoritosDoUsuario] = await Promise.all([
    linhaDoPerfil(usuarioId),
    db.select().from(favoritos).where(eq(favoritos.usuarioId, usuarioId)),
  ]);
  return c.json(
    montarPerfil(usuarioId, c.get("nome"), c.get("role"), linha, favoritosDoUsuario, true)
  );
});

/**
 * GET /api/perfil/:id/foto — serve os BYTES da foto. Ordem importa: antes do
 * GET /:id, para o `foto` nao ser tratado como id.
 */
perfil.get("/:id/foto", async (c) => {
  const idAlvo = Number(c.req.param("id"));
  const linha = Number.isInteger(idAlvo) ? await linhaDoPerfil(idAlvo) : null;

  if (!linha?.fotoChave) {
    return c.json({ error: "Este usuário ainda não tem foto de perfil" }, 404);
  }

  try {
    const foto = await obterFoto(linha.fotoChave);
    if (!foto) {
      return c.json({ error: "Foto não encontrada no armazenamento" }, 404);
    }
    return new Response(
      foto.bytes as unknown as ConstructorParameters<typeof Response>[0],
      {
        headers: {
          "Content-Type": foto.contentType,
          // `private`: o CDN nao pode cachear — a foto so existe para quem logou.
          "Cache-Control": "private, max-age=3600",
        },
      }
    );
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[perfil] falha ao ler foto de ${idAlvo}: ${motivo}`);
    return c.json({ error: "Armazenamento de objetos indisponível no momento" }, 503);
  }
});

/**
 * GET /api/perfil/:id — a pagina de perfil de OUTRA pessoa (rede social).
 * O NOME vem do auth-service (`perfil-publico`), o resto do banco do catalogo.
 */
perfil.get("/:id", async (c) => {
  const idAlvo = Number(c.req.param("id"));
  if (!Number.isInteger(idAlvo)) {
    return c.json({ error: "Usuário inválido" }, 400);
  }

  const chamadorId = c.get("usuarioId");
  const meuPerfil = idAlvo === chamadorId;

  const token = c.req.header("Authorization")?.slice(7) ?? "";
  const resultado = await perfilPublico(token, idAlvo);

  const [linha, favoritosDoUsuario] = await Promise.all([
    linhaDoPerfil(idAlvo),
    db.select().from(favoritos).where(eq(favoritos.usuarioId, idAlvo)),
  ]);

  if (!resultado.ok) {
    // 404 do auth-service ("nao existe") vira 404 aqui; 503 vira 503.
    return c.json({ error: resultado.erro }, resultado.status as 400 | 404 | 503);
  }

  return c.json(
    montarPerfil(
      resultado.dados.id,
      resultado.dados.nome,
      resultado.dados.role,
      linha,
      favoritosDoUsuario,
      meuPerfil
    )
  );
});

/**
 * PATCH /api/perfil/:id — edita a BIO.
 *
 * A identidade NUNCA vem do corpo: o backend usa quem esta logado (do token,
 * via auth-service). Mandou o `id` de outra pessoa? 403 — a regra da
 * atividade 4 ("nao confiar no que veio na requisição") aplicada ao recurso
 * "perfil".
 */
perfil.patch("/:id", async (c) => {
  const idAlvo = Number(c.req.param("id"));
  if (!Number.isInteger(idAlvo)) {
    return c.json({ error: "Usuário inválido" }, 400);
  }
  if (idAlvo !== c.get("usuarioId")) {
    return recusaNaoDono(c, idAlvo);
  }

  const { bio } = (await c.req.json().catch(() => ({}))) as { bio?: unknown };
  if (typeof bio !== "string") {
    return c.json({ error: 'Campo "bio" é obrigatório' }, 400);
  }
  const bioLimpa = bio.trim();
  if (bioLimpa.length > 300) {
    return c.json({ error: "A bio deve ter no máximo 300 caracteres" }, 400);
  }

  await db
    .insert(perfis)
    .values({ usuarioId: c.get("usuarioId"), bio: bioLimpa })
    .onDuplicateKeyUpdate({ set: { bio: bioLimpa } });

  await registrar({
    acao: "editar_perfil",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `perfil:${c.get("usuarioId")}`,
    detalhe: `bio (${bioLimpa.length} caracteres)`,
    ip: ipDe(c),
  });

  return c.json({ message: "Perfil atualizado", bio: bioLimpa });
});

/**
 * POST /api/perfil/:id/foto — upload (multipart, campo `foto`).
 *
 * Validacoes ANTES do MinIO (a ordem importa):
 *   1. dono do perfil        -> senao 403
 *   2. Content-Type image/*  -> senao 415
 *   3. tamanho <= 2 MB       -> senao 413
 *   4. magic bytes            -> senao 415 (nao confiar so no header)
 *
 * So depois disso o binario vai para o MinIO e a CHAVE para o MariaDB.
 */
perfil.post("/:id/foto", async (c) => {
  const idAlvo = Number(c.req.param("id"));
  if (!Number.isInteger(idAlvo)) {
    return c.json({ error: "Usuário inválido" }, 400);
  }
  if (idAlvo !== c.get("usuarioId")) {
    return recusaNaoDono(c, idAlvo);
  }

  // Porteiro barato: se o navegador ja anunciou um corpo gigante, nem parseia.
  const tamanhoAnunciado = Number(c.req.header("Content-Length") ?? 0);
  if (tamanhoAnunciado > TAMANHO_MAX_FOTO * 4) {
    return c.json({ error: `Arquivo excede o limite de ${TAMANHO_MAX_FOTO / 1024 / 1024} MB` }, 413);
  }

  const form = await c.req.formData().catch(() => null);
  const arquivo = form?.get("foto");

  if (!(arquivo instanceof File)) {
    return c.json({ error: 'Campo "foto" (multipart/form-data) é obrigatório' }, 400);
  }
  if (!arquivo.type.startsWith("image/")) {
    return c.json({ error: "Só imagens (PNG, JPEG, GIF ou WebP)" }, 415);
  }
  if (arquivo.size > TAMANHO_MAX_FOTO) {
    return c.json({ error: `A foto deve ter no máximo ${TAMANHO_MAX_FOTO / 1024 / 1024} MB` }, 413);
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const formato = detectarFormato(arquivo.type, bytes);
  if (!formato) {
    return c.json({ error: "Conteúdo não é uma imagem válida (PNG, JPEG, GIF ou WebP)" }, 415);
  }

  try {
    await garantirBucket();
    const chave = await enviarFoto(c.get("usuarioId"), bytes, formato);

    // Se ja havia foto, apaga a antiga — o bucket nao acumula lixo.
    const linhaAntiga = await linhaDoPerfil(c.get("usuarioId"));
    if (linhaAntiga?.fotoChave) {
      await removerFoto(linhaAntiga.fotoChave);
    }

    await db
      .insert(perfis)
      .values({ usuarioId: c.get("usuarioId"), fotoChave: chave })
      .onDuplicateKeyUpdate({ set: { fotoChave: chave } });

    await registrar({
      acao: "upload_foto",
      usuario_id: c.get("usuarioId"),
      usuario: c.get("nome"),
      papel: c.get("role"),
      recurso: `perfil:${c.get("usuarioId")}`,
      detalhe: `${formato} · ${bytes.length} bytes`,
      ip: ipDe(c),
    });

    return c.json(
      {
        message: "Foto de perfil atualizada",
        fotoChave: chave,
        fotoUrl: `/api/perfil/${c.get("usuarioId")}/foto`,
      },
      201
    );
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[perfil] falha no upload de ${c.get("usuarioId")}: ${motivo}`);
    return c.json({ error: "Armazenamento de objetos indisponível no momento" }, 503);
  }
});

export default perfil;