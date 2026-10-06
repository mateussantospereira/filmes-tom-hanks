import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { alterarPapel, listarUsuarios, type Resultado } from "../services/auth-service";
import type { Env } from "../types";

/**
 * Gateway de administracao (atividade 4) — a porta de entrada dos endpoints
 * exclusivos de admin.
 *
 * O navegador so conhece o catalogo, e o auth-service nao publica porta nenhuma.
 * Entao este arquivo repassa a chamada por rede, como ja faziam as rotas de
 * login. A diferenca e que aqui existem DUAS checagens de permissao antes do
 * dado andar:
 *
 *   1. AQUI (`exigePermissao`) — recusa na borda, 403 sem gastar rede.
 *   2. NO AUTH-SERVICE         — o dono do recurso recusa de novo.
 *
 * Duas, porque uma so nao e garantia. Este gateway pode ser reescrito, uma rota
 * pode ser montada sem o middleware, ou um container novo pode entrar na rede
 * `interna` e falar direto com o auth-service. A regra que vale e a de quem
 * guarda o dado; a daqui e otimizacao e educacao.
 */
const usuarios = new Hono<Env>();
usuarios.use("/*", authMiddleware);

/** Repassa corpo/status do auth-service, sem inventar regra nova. */
function repassar(c: Context, resultado: Resultado<unknown>, sucesso: ContentfulStatusCode = 200) {
  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as ContentfulStatusCode);
  }
  return c.json(resultado.dados, sucesso);
}

/**
 * GET /api/usuarios — quem sao os usuarios e que papel cada um tem.
 * Permissao exigida: `listar:usuarios`.
 */
usuarios.get("/", exigePermissao("listar:usuarios"), async (c) => {
  const token = c.req.header("Authorization")!.slice(7);
  return repassar(c, await listarUsuarios(token));
});

/**
 * PATCH /api/usuarios/:id/role — promove ou rebaixa.
 * Permissao exigida: `alterar:papel`.
 * Corpo: { "role": "admin" | "usuario" }
 */
usuarios.patch("/:id/role", exigePermissao("alterar:papel"), async (c) => {
  const token = c.req.header("Authorization")!.slice(7);
  const id = Number(c.req.param("id"));
  const { role } = await c.req.json().catch(() => ({ role: undefined }));

  if (role !== "usuario" && role !== "admin") {
    return c.json(
      { error: 'Papel inválido. Use "usuario" ou "admin".', papel_recebido: role ?? null },
      400
    );
  }

  return repassar(c, await alterarPapel(token, id, role));
});

export default usuarios;
