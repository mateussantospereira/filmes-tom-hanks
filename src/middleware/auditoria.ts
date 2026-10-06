import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { registrar, ipDe } from "../services/log-service";

/**
 * Middleware central de auditoria para ações negadas (HTTP 403).
 *
 * Executa APÓS o processamento da rota (`await next()`).
 * Se o status retornado for 403, clona o corpo da resposta para extrair o motivo/permissão
 * e grava um evento de auditoria com acao "acao_negada" no log-service.
 */
export const auditoria403Middleware = createMiddleware<Env>(async (c, next) => {
  await next();

  if (c.res.status === 403) {
    try {
      const corpo = (await c.res.clone().json().catch(() => null)) as Record<string, unknown> | null;
      const permissaoExigida = typeof corpo?.permissao_exigida === "string" ? corpo.permissao_exigida : null;
      const detalheErro = typeof corpo?.error === "string" ? corpo.error : "Acesso negado";

      await registrar({
        acao: "acao_negada",
        usuario_id: c.get("usuarioId") ?? null,
        usuario: c.get("nome") ?? null,
        papel: c.get("role") ?? null,
        recurso: permissaoExigida ? `${c.req.method} ${c.req.path} (${permissaoExigida})` : `${c.req.method} ${c.req.path}`,
        detalhe: detalheErro,
        ip: ipDe(c),
      });
    } catch {
      // Falhas de observabilidade nunca derrubam a requisição
    }
  }
});
