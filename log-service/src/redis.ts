import Redis from "ioredis";
import { config } from "./config";
import { desembrulhar, type EventoGravado, type EventoRecebido } from "./eventos";

/**
 * Conexao com o Redis.
 *
 * UMA conexao por processo, reutilizada: abrir um cliente por requisicao e a
 * forma classica de esgotar descritores de arquivo no servico que mais escreve
 * do sistema inteiro. O ioredis ja reconecta sozinho em queda — o log-service
 * nao derruba o catalogo porque o Redis piscou.
 */
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  commandTimeout: config.redis.timeoutMs,
  // Sem senha dentro da rede interna do Docker: o Redis nao publica porta e so
  // os containers da rede `interna` alcancam o nome `redis`.
});

redis.on("error", (erro) => {
  // Nao derruba o processo: um erro de rede do Redis nao e erro do servico.
  // Aparece no log do container e deixa o /health vermelho.
  console.error(`[log-service] redis: ${erro.message}`);
});

/**
 * Grava um evento no stream — o XADD.
 *
 * `MAXLEN ~ <limite>` enforca o teto aproximado no PROPRIO comando: nao e uma
 * tarefa separada que esquece de agendar, e o Redis que descarta o mais antigo
 * quando passa do limite. Sem isso o stream cresce ate o disco do servidor.
 *
 * Campos `null` nao entram no stream (Redis nao guarda null): a leitura devolve
 * `null` para os que faltaram. Cada entrada fica minuscula — e no Redis
 * minuscula e literalmente menos bytes por evento.
 *
 * O `timestamp` e gravado AQUI, no momento do XADD, e nao pelo servico que
 * manda o evento: um relogio de quem manda pode estar errado, e o relogio do
 * servico que guarda e o unico que precisa ser bom para a ordem do stream ser
 * confiavel.
 */
export async function gravar(evento: EventoRecebido): Promise<string> {
  const campos: (string | number)[] = ["timestamp", new Date().toISOString()];
  for (const [campo, valor] of Object.entries(evento)) {
    if (valor === null || valor === undefined) continue;
    campos.push(campo, valor);
  }

  const id = await redis.xadd(
    config.redis.stream,
    "MAXLEN",
    "~",
    config.redis.maxlen,
    "*",
    ...campos
  );

  return id ?? "";
}

/**
 * Le os ULTIMOS N eventos.
 *
 * `XREVRANGE ... COUNT N` e o comando certo: comeca do FIM e anda para tras,
 * entao `N` e "os N mais recentes" sem carregar o stream inteiro para jogar
 * quase tudo fora. `XRANGE` comum leria do comeco e pegaria SEMPRE os mesmos
 * primeiros eventos — clássico erro de quem implementa "ultimos N" pela metade.
 *
 * Depois invertemos para ordem CRONOLOGICA (mais antigo primeiro). O requisito 6
 * pede que as acoes aparecam "na ordem certa" — e a ordem em que aconteceram,
 * nao a ordem em que foram descobertas.
 */
export async function ultimos(limite: number): Promise<EventoGravado[]> {
  const bruto = await redis.xrevrange(config.redis.stream, "+", "-", "COUNT", limite);

  return bruto.map(([id, pares]) => desembrulhar(id, pares)).reverse();
}

/** Healthcheck: Redis responde? Devolve o motivo quando nao responde. */
export async function conferirRedis(): Promise<string | null> {
  try {
    await redis.ping();
    return null;
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}
