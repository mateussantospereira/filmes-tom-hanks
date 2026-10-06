/**
 * Configuracao do microsservico de logs de auditoria.
 *
 * Mesmo padrao do auth-service: toda configuracao entra por variavel de
 * ambiente e e validada NA PARTIDA. Um log-service que sobe sem conseguir falar
 * com o Redis so vai falhar quando alguem tentar gravar — e nesse meio tempo os
 * eventos dos outros servicos se perdem em silencio. Por isso nada aqui e
 * "opcional e depois a gente ve".
 */

function obrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    throw new Error(
      `[log-service] Variavel de ambiente obrigatoria ausente: ${nome}. ` +
        `Copie log-service/.env.example para log-service/.env (ou defina no docker-compose.yml) e preencha.`
    );
  }
  return valor;
}

function opcional(nome: string, padrao: string): string {
  const valor = process.env[nome]?.trim();
  return valor ? valor : padrao;
}

function inteiro(nome: string, padrao: number): number {
  const bruto = process.env[nome]?.trim();
  if (!bruto) return padrao;
  const valor = Number(bruto);
  if (!Number.isFinite(valor)) {
    throw new Error(`[log-service] Variavel de ambiente ${nome} precisa ser um numero, recebido: "${bruto}"`);
  }
  return valor;
}

export const config = {
  /** Porta DENTRO do container. Nao e publicada para o host (ver docker-compose.yml). */
  port: inteiro("PORT", 3000),

  redis: {
    /**
     * `redis://redis:6379` — o nome `redis` e o do servico no compose, so
     * alcancavel de dentro da rede `interna`. Assim como `auth-service`,
     * fora da rede esse nome simplesmente nao existe.
     */
    url: obrigatorio("REDIS_URL"),
    /**
     * Nome da Redis Stream. Um so stream para todos os eventos: separar por
     * servico faria a consulta "o que aconteceu no sistema?" virar N leituras.
     */
    stream: opcional("REDIS_STREAM", "auditoria:eventos"),
    /**
     * Teto aproximado de entradas no stream (XADD `MAXLEN ~`).
     *
     * Redis Stream cresce sem limite, e log de auditoria e justamente o tipo de
     * coisa que ninguem lembra de limitar até o disco encher. `~` pede um
     * corte APROXIMADO: o Redis so descarta quando o desvio passa do limite,
     * o que e barato e evita reescrever o stream a cada evento.
     */
    maxlen: inteiro("REDIS_STREAM_MAXLEN", 50000),
    /** Espera por uma resposta do Redis antes de desistir (ms). */
    timeoutMs: inteiro("REDIS_TIMEOUT_MS", 2000),
  },

  auth: {
    /**
     * O log-service NAO tem JWT_SECRET (decisao da atividade 3: o segredo fica
     * so com quem emite). Para saber se quem pediu os logs pode ve-los, ele
     * pergunta ao dono da identidade — exatamente como o catalogo faz.
     */
    url: opcional("AUTH_SERVICE_URL", "http://auth-service:3000").replace(/\/+$/, ""),
    timeoutMs: inteiro("AUTH_SERVICE_TIMEOUT_MS", 5000),
  },

  /** Permissao exigida para ler o stream. Mesmo nome do mapa do auth-service. */
  permissaoDeLeitura: opcional("PERMISSAO_LEITURA", "consultar:logs"),

  ingest: {
    /**
     * Segredo compartilhado para ESCREVER eventos (header `X-Log-Token`).
     *
     * Vazio = so a rede interna protege a escrita (fronteira padrao da
     * arquitetura). Definido = um container novo que entre na rede `interna`
     * precisa do segredo para gravar evento falso na auditoria.
     *
     * ATENCAO: o MESMO valor tem que estar no catalogo e no auth-service,
     * senao os eventos deles sao recusados em silencio.
     */
    token: opcional("LOG_INGEST_TOKEN", ""),
  },
} as const;
