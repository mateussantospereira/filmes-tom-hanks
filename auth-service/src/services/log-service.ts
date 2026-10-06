/**
 * Cliente HTTP do log-service no auth-service (origem: "auth-service").
 */

const LOG_SERVICE_URL = (process.env.LOG_SERVICE_URL ?? "http://log-service:3000").replace(/\/+$/, "");
const TIMEOUT_GRAVACAO_MS = Number(process.env.LOG_SERVICE_TIMEOUT_MS ?? 1000);

export type EventoAuditoria = {
  acao: string;
  usuario_id?: number | null;
  usuario?: string | null;
  papel?: string | null;
  recurso?: string | null;
  detalhe?: string | null;
  ip?: string | null;
};

export function ipDe(c: { req: { header: (nome: string) => string | undefined } }): string | null {
  const direto = c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip");
  if (direto) return direto.trim();
  const lista = c.req.header("x-forwarded-for");
  if (lista) return lista.split(",")[0].trim();
  return null;
}

export async function registrar(evento: EventoAuditoria): Promise<void> {
  try {
    const resposta = await fetch(`${LOG_SERVICE_URL}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LOG_INGEST_TOKEN ? { "x-log-token": process.env.LOG_INGEST_TOKEN } : {}),
      },
      body: JSON.stringify({ ...evento, origem: "auth-service" }),
      signal: AbortSignal.timeout(TIMEOUT_GRAVACAO_MS),
    });

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
      console.error(
        `[auditoria auth-service] log-service recusou "${evento.acao}": ${resposta.status} ${corpo?.error ?? ""}`.trim()
      );
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auditoria auth-service] nao consegui gravar "${evento.acao}": ${motivo}`);
  }
}
