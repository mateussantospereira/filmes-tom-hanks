import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { sessao } from "../services/auth-service";

/**
 * Middleware de autenticacao do CATALOGO.
 *
 * Na atividade 2 este arquivo verificava o JWT localmente, com o mesmo
 * JWT_SECRET do login. Agora nao existe segredo nenhum no catalogo: o token
 * simplesmente segue por HTTP para o auth-service, que responde quem e o
 * usuario e qual o papel dele. Se o auth-service nao responder, a requisicao e
 * recusada com 503 — e o catalogo continua no ar.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Token ausente" }, 401);
  }

  const resultado = await sessao(header.slice(7));

  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as 401 | 503);
  }

  c.set("usuarioId", resultado.dados.usuarioId);
  c.set("role", resultado.dados.role);
  c.set("nome", resultado.dados.nome);

  await next();
});
