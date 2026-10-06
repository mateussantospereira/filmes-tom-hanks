import { createMiddleware } from "hono/factory";
import type { Env, Permissao } from "../types";

/**
 * FABRICA de autorizacao do catalogo (atividade 4).
 *
 * O erro que esta atividade existe para pegar: esconder um botao na tela e
 * chamar isso de seguranca. O botao escondido e interface — qualquer um abre
 * o DevTools ou chama o endpoint direto pelo Postman. A recusa tem que ser do
 * servidor, e e exatamente este middleware que recusa.
 *
 * Uso numa rota:
 *
 *   comments.delete("/:id", authMiddleware, exigePermissao("apagar:comentario-de-outro"), h)
 *
 * A checagem e contra `permissoes`, que veio do auth-service no `GET /me`.
 * Repare que aqui nao existe `role === "admin"` — a rota nem sabe o que um
 * papel significa. Se amanha existir um papel "moderador" com a mesma
 * permissao, esta rota passa a aceita-lo so por ter sido listado no mapa LA
 * tras, sem uma linha de codigo mudar aqui.
 *
 * ORDEM DUAS CHECAGENS, como no auth-service:
 *   401 = nao sei quem voce e (token ausente/invalido)
 *   403 = sei quem voce e, e voce nao pode
 * Este middleware e montado DEPOIS do `authMiddleware`, entao ja ha sessao —
 * o 403 significa "autenticado e negado", que e o requisito 3 da atividade.
 *
 * FALHA PARA O LADO INSEGURO: se `permissoes` nao chegar por qualquer motivo,
 * a lista fica vazia e nada e permitido. Mais bravo do que devia e melhor do
 * que devolver 200 por omissao.
 */
export const exigePermissao = (permissao: Permissao) =>
  createMiddleware<Env>(async (c, next) => {
    const permissoes = c.get("permissoes") ?? [];
    const role = c.get("role");

    if (!permissoes.includes(permissao)) {
      return c.json(
        {
          error: `Ação negada: seu papel (${role ?? "desconhecido"}) não tem a permissão "${permissao}".`,
          permissao_exigida: permissao,
          papel: role ?? null,
        },
        403
      );
    }

    await next();
  });
