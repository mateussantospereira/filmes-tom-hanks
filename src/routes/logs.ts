import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { consultarLogs, ipDe } from "../services/log-service";
import type { Env } from "../types";

const logs = new Hono<Env>();
logs.use("/*", authMiddleware);

/**
 * GET /api/logs?limite=N
 * Consulta os eventos do stream de auditoria do Redis.
 * Permissão exigida: `consultar:logs` (exclusivo de admin).
 */
logs.get("/", exigePermissao("consultar:logs"), async (c) => {
  const header = c.req.header("Authorization")!;
  const token = header.slice(7);
  const limiteBruto = c.req.query("limite");
  const limite = limiteBruto ? Math.min(Math.max(Number(limiteBruto) || 50, 1), 500) : 50;

  const res = await consultarLogs(token, limite, ipDe(c));

  if (!res.ok) {
    return c.json({ error: res.erro }, res.status as any);
  }

  return c.json(res.dados);
});

export default logs;
