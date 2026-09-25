import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "../middleware/auth";
import {
  esquecerSenha,
  login,
  registrar,
  sessao,
  trocarSenha,
  type Resultado,
} from "../services/auth-service";

/**
 * Gateway de autenticacao do catalogo.
 *
 * O catalogo e o unico container com porta publicada, entao e por ele que o
 * navegador entra — mas o navegador NUNCA fala com o auth-service, que nao tem
 * porta nenhuma. Cada rota abaixo e so transporte: repassa a chamada por HTTP
 * para http://auth-service:3000 e devolve a resposta.
 *
 * Repare no que NAO existe aqui: bcrypt, jwt.verify, SQL em `usuarios`, token
 * de sessao, expiracao de link. Nenhuma regra de autenticacao mora no catalogo.
 */
const auth = new Hono();

/** Repassa corpo/status do auth-service, sem inventar regra nova. */
function repassar(
  c: Context,
  resultado: Resultado<unknown>,
  sucesso: ContentfulStatusCode = 200
) {
  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as ContentfulStatusCode);
  }
  return c.json(resultado.dados, sucesso);
}

auth.post("/register", async (c) => {
  const { nome, email, senha } = await c.req.json().catch(() => ({}));
  return repassar(c, await registrar({ nome, email, senha }), 201);
});

auth.post("/login", async (c) => {
  const { email, senha } = await c.req.json().catch(() => ({}));
  return repassar(c, await login(email, senha));
});

/**
 * "Quem sou eu?" — inclusive qual o meu papel.
 * A pagina do catalogo usa isso para mostrar nome e papel sem confiar no que
 * ficou guardado no localStorage do navegador.
 */
auth.get("/me", authMiddleware, async (c) => {
  const header = c.req.header("Authorization")!;
  return repassar(c, await sessao(header.slice(7)));
});

auth.post("/forgot-password", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  return repassar(c, await esquecerSenha(email));
});

/**
 * A URL do link de redefinicao chega no catalogo (e nao direto no auth-service,
 * que nao e publico). O catalogo so repassa o token para o servico dono da
 * regra — quem decide se o token existe, se expirou e se ja foi usado e o
 * auth-service.
 */
auth.post("/reset-password", async (c) => {
  const { token, novaSenha } = await c.req.json().catch(() => ({}));
  return repassar(c, await trocarSenha(token, novaSenha));
});

export default auth;
