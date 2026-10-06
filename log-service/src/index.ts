import { Hono } from "hono";
import eventosRota from "./rotas/eventos";
import logsRota from "./rotas/logs";
import { conferirRedis } from "./redis";
import { config } from "./config";

/**
 * log-service — o TERCEIRO microsservico do catalogo, e o primeiro que nao
 * guarda dado de negocio.
 *
 * Ele guarda RASTRO: quem fez o quê, e quando. Nao guarda senha, nao guarda
 * comentario, nao guarda favorito — guarda o registro de que alguem mexeu
 * nisso. Por isso mora num servico proprio e por isso o banco e Redis Streams
 * e nao MariaDB:
 *
 *   dado de negocio  -> transacao, JOIN, integridade referencial  -> MariaDB
 *   log de auditoria -> escreve muito, le pouco, ordenado no tempo -> Streams
 *
 * E por isso NAO tem porta publicada (ver docker-compose.yml), igual ao
 * auth-service da atividade 3: quem consulta os logs e o admin, pelo catalogo.
 * Um segundo ponto de entrada publico seria um servico que expoe quem fez o
 * quê para a internet inteira.
 *
 * Endpoints:
 *   POST /eventos  — servicos mandam o evento (rede interna)
 *   GET  /logs     — admin consulta os ultimos N (401/403 igual a atividade 4)
 *   GET  /health   — saude do Redis, para o healthcheck do container
 */
const app = new Hono();

/** Estado do Redis para o healthcheck. Atualizado a cada chamada. */
let motivoRedis: string | null = null;

app.get("/health", async (c) => {
  motivoRedis = await conferirRedis();

  if (motivoRedis) {
    return c.json(
      { status: "erro", servico: "log-service", redis: "inacessivel", motivo: motivoRedis },
      503
    );
  }

  return c.json({ status: "ok", servico: "log-service", stream: config.redis.stream });
});

app.route("/", eventosRota);
app.route("/", logsRota);

app.notFound((c) => c.json({ error: "Rota não encontrada no log-service" }, 404));

// Handler de erro unico: uma excecao nao pode estourar HTML de stack trace na
// resposta — o catalogo (e o script de demonstracao) precisam de JSON.
app.onError((erro, c) => {
  console.error("[log-service] erro nao tratado:", erro);
  return c.json({ error: "Erro interno no serviço de logs" }, 500);
});

console.log(
  `[log-service] ouvindo na porta ${config.port} (container) — ` +
    `stream "${config.redis.stream}" (MAXLEN ~ ${config.redis.maxlen}) — ` +
    `leitura exige "${config.permissaoDeLeitura}" — ` +
    `auth-service em ${config.auth.url}`
);

export default {
  port: config.port,
  fetch: app.fetch,
};
