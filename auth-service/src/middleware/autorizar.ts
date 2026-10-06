import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { usuarios } from "../db/schema";
import { config } from "../config";
import { temPermissao, type Permissao, type Papel } from "../auth/permissoes";

/**
 * Autorizacao no proprio auth-service (atividade 4).
 *
 * Na atividade 3 o auth-service tinha UMA rota que pedia token: o `/me`, que o
 * catalogo chama. Agora ele tem rotas proprias de administracao, e elas nao
 * podem confiar em quem chamou — precisam verificar so mesmas.
 *
 * A ordem das duas checagens e obrigatoria, e a ordem importa:
 *
 *   1. QUem e voce?      -> token valido?  -> senao 401 (nao autenticado)
 *   2. O que voce pode?  -> papel tem?     -> senao 403 (autenticado, negado)
 *
 * Um 401 para "nao sei quem voce e" e um 403 para "sei quem voce e e voce nao
 * pode" sao coisas diferentes. Trocar um pelo outro mente sobre o estado da
 * conta e ajuda quem esta escaneando o servico.
 */
export type VariaveisAuth = {
  usuarioId: number;
  role: Papel;
  nome: string;
};

/**
 * Verifica o token e deixa `usuarioId`/`role`/`nome` no contexto.
 * Le o papel DO BANCO, e nao do payload do token: se um admin rebaixar alguem,
 * vale na proxima requisicao, sem esperar o token de 24h expirar.
 */
async function identificar(c: Context<{ Variables: VariaveisAuth }>): Promise<Response | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Token ausente" }, 401);
  }

  let payload: { sub?: string };
  try {
    payload = jwt.verify(header.slice(7), config.jwt.secret) as { sub?: string };
  } catch {
    return c.json({ error: "Token inválido ou expirado" }, 401);
  }

  const usuarioId = Number(payload.sub);
  if (!Number.isInteger(usuarioId)) {
    return c.json({ error: "Token inválido" }, 401);
  }

  const rows = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Token inválido" }, 401);
  }

  c.set("usuarioId", rows[0].id);
  c.set("nome", rows[0].nome);
  c.set("role", rows[0].role as Papel);
  return null;
}

/**
 * FABRICA de middleware de autorizacao — o enforcement de verdade.
 *
 * Uso: `auth.get("/usuarios", exigePermissao("listar:usuarios"), handler)`.
 *
 * A regra e a mesma de qualquer rota destas: checar no SERVIDOR, sempre. A
 * interface pode esconder o botao, mas o botao escondido nao e seguranca — o
 * endpoint tem que recusar sozinho quando chamado pelo Postman.
 *
 * Se por algum motivo o papel nao estiver no contexto (rota montada sem passar
 * pela autenticacao), a resposta e 403, nunca 200. Nao conceder por omissao.
 */
export const exigePermissao = (permissao: Permissao) =>
  createMiddleware<{ Variables: VariaveisAuth }>(async (c, next) => {
    const erro = await identificar(c);
    if (erro) return erro;

    const role = c.get("role");
    if (!temPermissao(role, permissao)) {
      return c.json(
        {
          error: `Ação negada: o seu papel (${role}) não tem a permissão "${permissao}".`,
          permissao_exigida: permissao,
          papel: role,
        },
        403
      );
    }

    await next();
  });

/**
 * Só autentica, sem exigir permissao — para rotas que qualquer logado acessa.
 * (Igual ao `authMiddleware` do catalogo, porem aqui dentro do auth-service.)
 */
export const autenticado = createMiddleware<{ Variables: VariaveisAuth }>(async (c, next) => {
  const erro = await identificar(c);
  if (erro) return erro;
  await next();
});
