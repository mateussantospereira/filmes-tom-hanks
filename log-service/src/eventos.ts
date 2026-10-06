/**
 * O EVENTO DE AUDITORIA — o formato que atravessa a rede inteira.
 *
 * Diferenca de log de APLICACAO (erro, debug, stack trace) e log de AUDITORIA:
 *
 *   aplicacao: "por que o programa quebrou?"  -> ajuda a achar BUG
 *   auditoria: "quem fez o quê, e quando?"    -> ajuda a achar GENTE
 *
 * Por isso este registro guarda pessoa e acao, e nao stack trace: ele responde
 * a perguntas como "quem apagou esse comentario?", "de quem e a culpa se o
 * papel de alguem mudou de madrugada?" e "tentaram entrar na conta de quem?".
 *
 * Campos obrigatorios (requisito 3): `usuario_id`, `acao`, `timestamp`.
 * Bônus: `ip` de origem.
 */

/** Origem de quem mandou o evento — ajuda a rastrear QUAL servico reportou. */
export type Origem = "catalogo" | "auth-service";

export type EventoRecebido = {
  /** Acao acontecida. Obrigatorio e nao vazio. */
  acao: string;
  /** Quem fez. `null` quando nao se sabe (ex.: login com e-mail inexistente). */
  usuario_id?: number | null;
  /** Nome de quem fez, congelado no momento do evento. */
  usuario?: string | null;
  /** Papel de quem fez, congelado no momento do evento. */
  papel?: string | null;
  /** Sobre o que: `filme:429`, `comentario:17`, `usuario:6`... */
  recurso?: string | null;
  /** Detalhe livre (curto): `senha incorreta`, `permissao_exigida=...`. */
  detalhe?: string | null;
  /** IP de origem da requisicao (bonus do requisito 3). */
  ip?: string | null;
  /** Qual servico reportou. */
  origem?: Origem;
};

/** O que sai do log-service depois de gravado — inclui o id no stream. */
export type EventoGravado = EventoRecebido & {
  /** Id da entrada no Redis Stream (`XADD`), unico e ordenado no tempo. */
  id: string;
  /** ISO 8601 em UTC. e o `timestamp` do requisito 3. */
  timestamp: string;
};

const TAMANHO_MAXIMO_ACAO = 64;

/**
 * Normaliza a acao para `snake_case` minusculo.
 *
 * NAO valida contra uma lista fechada, e isso e deliberado. Um log-service que
 * recusa acao desconhecida passa a PERDER evento no momento exato em que um
 * servico ganha uma acao nova — e perder evento e a pior coisa que um log de
 * auditoria pode fazer. O contrato e "string nao vazia", nao "string da lista".
 *
 * O que ele faz e cortar o que quebraria o stream (tamanho) e padronizar a
 * forma, para `Login`, `LOGIN` e `login` virarem a mesma coisa na consulta.
 */
function normalizarAcao(bruto: unknown): string {
  return String(bruto ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_:]/g, "")
    .slice(0, TAMANHO_MAXIMO_ACAO);
}

/** Corta texto livre: o campo e anotacao, nao repositorio de dados. */
function textoLivre(valor: unknown, limite = 200): string | null {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t ? t.slice(0, limite) : null;
}

/** Id inteiro ou `null`. `NaN`, `Infinity` e string viram `null`, nunca 0. */
function id(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

/**
 * Valida e normaliza o corpo de `POST /eventos`.
 *
 * Devolve `null` quando o evento e irrecuperavel (sem acao), que e o unico
 * caso em que o log-service recusa. Todo o resto e aceito e arrumado: um evento
 * meio errado gravado vale mais do que um evento perfeito que nao chegou.
 */
export function normalizar(corpo: unknown): EventoRecebido | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;

  const acao = normalizarAcao(c.acao);
  if (!acao) return null;

  const origem = c.origem === "auth-service" ? "auth-service" : "catalogo";

  return {
    acao,
    usuario_id: id(c.usuario_id),
    usuario: textoLivre(c.usuario, 120),
    papel: textoLivre(c.papel, 40),
    recurso: textoLivre(c.recurso, 120),
    detalhe: textoLivre(c.detalhe),
    ip: textoLivre(c.ip, 60),
    origem,
  };
}

/**
 * Converte o par campo/valor do `XRANGE`/`XREVRANGE` em objeto.
 *
 * Redis guarda stream como lista de pares (`campo`, `valor`, `campo`, `valor`).
 * `usuario_id` volta como STRING porque tudo no Redis e string — entao e aqui
 * que ele volta a vir numero, antes de chegar na resposta da API.
 */
export function desembrulhar(idEntrada: string, pares: string[]): EventoGravado {
  const campos: Record<string, string> = {};
  for (let i = 0; i < pares.length; i += 2) {
    campos[pares[i]] = pares[i + 1] ?? "";
  }

  const usuarioId = campos.usuario_id;

  return {
    id: idEntrada,
    timestamp: campos.timestamp ?? "",
    acao: campos.acao ?? "",
    usuario_id: usuarioId === undefined || usuarioId === "" ? null : Number(usuarioId),
    usuario: campos.usuario ?? null,
    papel: campos.papel ?? null,
    recurso: campos.recurso ?? null,
    detalhe: campos.detalhe ?? null,
    ip: campos.ip ?? null,
    origem: campos.origem === "auth-service" ? "auth-service" : "catalogo",
  };
}
