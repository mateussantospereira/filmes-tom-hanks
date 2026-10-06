import type { Context } from "hono";
import { config } from "./config";

/**
 * Autorizacao do log-service — a SEGUNDA checagem da atividade 4, repetida
 * aqui dentro.
 *
 * A rota de consulta de logs e publicada pelo catalogo (que ja confere), mas
 * este servico confere de novo, porque quem guarda o dado e quem aplica a regra
 * sobre ele. Sem isto, qualquer container que um dia entre na rede `interna`
 * e falar `GET http://log-service:3000/logs` leria a auditoria inteira sem
 * passar por coisa alguma — e auditoria e justamente o que ninguem deveria
 * ler por acidente.
 *
 * O log-service NAO tem `JWT_SECRET` (decisao da atividade 3: o segredo mora
 * so com quem emite). Entao ele nao lê o token: manda o token para o dono da
 * identidade (`GET /me` no auth-service) e recebe `permissoes` ja resolvidas.
 * Mesmo padrao do catalogo — o enforcement continua sendo centralizado, e este
 * servico continua sem saber o que um papel significa.
 */

type Perfil = {
  usuarioId: number;
  nome: string;
  role: string;
  permissoes?: string[];
};

export type Veredito =
  | { ok: true; perfil: Perfil }
  | { ok: false; status: 401 | 403 | 503; erro: string };

/** Extrai o Bearer do header, sem inventar nada. */
function tokenDe(c: Context): string | null {
  const header = c.req.header("Authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Decide se o chamador pode ler os logs.
 *
 * A ordem das duas checagens e obrigatoria, e e a mesma da atividade 4:
 *
 *   401 = nao sei quem voce e        (token ausente, invalido ou expirado)
 *   403 = sei quem voce e, e nao pode (token valido, permissao faltando)
 *   503 = nao consigo confirmar nada  (auth-service fora — recusa, nao concede)
 *
 * O 503 e o FALHA PARA O LADO INSEGURO escrito em HTTP: se o dono da
 * identidade nao respondeu, o log-service nao sabe quem pediu, entao nao abre.
 * Conceder por "provavelmente e o admin" e conceder por sorte.
 */
export async function podeConsultarLogs(c: Context): Promise<Veredito> {
  const token = tokenDe(c);
  if (!token) {
    return { ok: false, status: 401, erro: "Token ausente" };
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${config.auth.url}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(config.auth.timeoutMs),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[log-service] auth-service indisponivel: ${motivo}`);
    return {
      ok: false,
      status: 503,
      erro: "Serviço de autenticação indisponível. Não é possível confirmar quem pediu os logs.",
    };
  }

  if (resposta.status === 401) {
    return { ok: false, status: 401, erro: "Token inválido ou expirado" };
  }

  const perfil = (await resposta.json().catch(() => null)) as Perfil | null;
  if (!resposta.ok || !perfil) {
    return { ok: false, status: 401, erro: "Token inválido ou expirado" };
  }

  // `permissoes.includes(...)`, nunca `role === "admin"` — a regra vale igual
  // aqui: o que se pergunta e "tem a permissao?", nao "que papel e?".
  const permissoes = perfil.permissoes ?? [];
  if (!permissoes.includes(config.permissaoDeLeitura)) {
    return {
      ok: false,
      status: 403,
      erro: `Ação negada: o seu papel (${perfil.role}) não tem a permissão "${config.permissaoDeLeitura}".`,
    };
  }

  return { ok: true, perfil };
}

/** IP de quem fez a chamada, se o proxy entregar (bônus do requisito 3). */
export function ipDe(c: Context): string | null {
  const direto = c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip");
  if (direto) return direto.trim();
  const lista = c.req.header("x-forwarded-for");
  if (lista) return lista.split(",")[0].trim();
  return null;
}
