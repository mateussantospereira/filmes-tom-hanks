/**
 * Cliente HTTP do log-service — e o LADO CONTRARIO do cliente de autenticacao.
 *
 * Enquanto `services/auth-service.ts` pergunta "quem e voce?" (uma resposta que
 * o catalogo PRECISA para decidir), aqui o catalogo so ENVIOSA informação: o
 * log-service recebe, grava no Redis Streams e nunca precisa responder para a
 * acao do usuario acontecer.
 *
 * Duas consequencias praticas desse desequilibrio, ambas proposital:
 *
 *   1. `registrar()` e SEMPRE await com timeout curto e NUNCA lanca excecao.
 *      Esperamos (nao disparamos e esquecemos) porque o requisito 6 pede que as
 *      acoes aparecam na consulta logo em seguida — fire-and-forget correria
 *      atras de um evento que ainda nao gravou e o script de demonstracao
 *      mostraria um log faltando. Mas se o log-service cair, o catalogo NAO
 *      pode parar: observabilidade e servico de apoio, nao e o produto.
 *      A frase no comentario abaixo e a regra: a falha vira linha de console,
 *      nunca 500 na tela de alguem.
 *
 *   2. O catalogo tambem CHAMA o log-service na rota `/logs` (leitura). Aqui a
 *      resposta importa: sem ela o admin nao consulta nada. Por isso `Resultado`.
 */

const LOG_SERVICE_URL = (process.env.LOG_SERVICE_URL ?? "http://log-service:3000").replace(/\/+$/, "");

/**
 * Espera pela gravacao. Curta de proposito: o log-service so faz um XADD, que
 * e O(1). Se passou de 1s, ou o Redis esta ruim, ou o servico caiu — e nesses
 * dois casos a resposta certa e desistir em vez de segurar a requisicao do
 * usuario.
 */
const TIMEOUT_GRAVACAO_MS = Number(process.env.LOG_SERVICE_TIMEOUT_MS ?? 1000);

/** Leitura nao e caminho quente, entao pode esperar um pouco mais. */
const TIMEOUT_LEITURA_MS = Number(process.env.LOG_SERVICE_LEITURA_TIMEOUT_MS ?? 5000);

export type EventoAuditoria = {
  /** Obrigatorio. `acao:recurso` ou verbo curto — `login`, `comentar`... */
  acao: string;
  /** Quem fez. `null` quando nao se sabe (e-mail inexistente, token sem dono). */
  usuario_id?: number | null;
  usuario?: string | null;
  papel?: string | null;
  recurso?: string | null;
  detalhe?: string | null;
  ip?: string | null;
};

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string };

/**
 * IP de quem FEZ a requisicao (bônus do requisito 3).
 *
 * Ordem: Cloudflare -> proxy que estiver na frente -> vazio. `null` nao e
 * erro: rodando localmente, sem proxy na frente, nao ha de onde saber o IP de
 * verdade e inventar "127.0.0.1" seria gravar no auditoria um dado que nunca
 * existiu.
 *
 * AVISO honesto: `X-Forwarded-For` e escrito por quem chama. Atrás do
 * Cloudflare o primeiro salto e confiavel (ele sobrescreve); um acesso direto
 * ao container podia mandar um valor falso. Por isso o IP e BONUS neste
 * trabalho e nao campo decisório — identidade vem de token, nunca de IP.
 */
export function ipDe(c: { req: { header: (nome: string) => string | undefined } }): string | null {
  const direto = c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip");
  if (direto) return direto.trim();
  const lista = c.req.header("x-forwarded-for");
  if (lista) return lista.split(",")[0].trim();
  return null;
}

/**
 * Grava um evento no log-service.
 *
 * NUNCA lanca excecao. E a funcao mais perigosa do catalogo justamente por
 * isso: um `await` que pode estourar dentro de uma rota de favorito transforma
 * um servico opcional em dependencia obrigatoria do caminho feliz. Qualquer
 * problema (rede, timeout, 4xx, 5xx) vira `console.error` e volta em silencio.
 */
export async function registrar(evento: EventoAuditoria): Promise<void> {
  try {
    const resposta = await fetch(`${LOG_SERVICE_URL}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LOG_INGEST_TOKEN ? { "x-log-token": process.env.LOG_INGEST_TOKEN } : {}),
      },
      body: JSON.stringify({ ...evento, origem: "catalogo" }),
      signal: AbortSignal.timeout(TIMEOUT_GRAVACAO_MS),
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null) as { error?: string } | null;
      console.error(
        `[auditoria] log-service recusou "${evento.acao}": ${resposta.status} ${corpo?.error ?? ""}`.trim()
      );
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auditoria] nao consegui gravar "${evento.acao}": ${motivo}`);
  }
}

/**
 * GET /logs?limite=N — a rota so-admin da atividade 5.
 *
 * `token` e repassado adiante de proposito: o log-service NAO tem
 * `JWT_SECRET`, entao ele nao valida — manda para o auth-service e recebe
 * `permissoes`. A checagem acontece DUAS vezes (aqui no catalogo e la no dono
 * do log), exatamente como as rotas de administracao da atividade 4.
 */
export async function consultarLogs(
  token: string,
  limite: number,
  ip?: string | null
): Promise<Resultado<unknown>> {
  let resposta: Response;

  try {
    resposta = await fetch(`${LOG_SERVICE_URL}/logs?limite=${encodeURIComponent(limite)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_LEITURA_MS),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[log-service] /logs falhou (${LOG_SERVICE_URL}): ${motivo}`);
    return { ok: false, status: 503, erro: "Serviço de logs indisponível." };
  }

  const corpo = (await resposta.json().catch(() => null)) as { error?: string } | unknown;

  if (!resposta.ok) {
    return {
      ok: false,
      status: resposta.status,
      erro: (corpo as { error?: string })?.error ?? "Falha ao consultar os logs",
    };
  }

  return { ok: true, dados: corpo };
}
