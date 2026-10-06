import { Hono } from "hono";
import { config } from "../config";
import { normalizar } from "../eventos";
import { gravar } from "../redis";
import { ipDe } from "../autorizacao";

/**
 * `POST /eventos` — a PORTA DE ENTRADA da auditoria.
 *
 * Os servicos nao escrevem direto no Redis (requisito 4 e o diagrama da
 * atividade): eles mandam um evento para ca, e este servico e o unico que faz
 * XADD. Isso mantem a centralizacao — quem conhece a forma do stream, o nome da
 * chave e o teto de tamanho mora num lugar so, e trocar Redis por outra coisa
 * nao obriga mexer no catalogo nem no auth-service.
 *
 * QUEM PODE ESCREVER: qualquer container da rede `interna`. Nao ha usuario
 * nem token de usuario aqui, porque quem manda o evento e um SERVICO, nao uma
 * pessoa — e o servico nao tem (nem deveria ter) o JWT de ninguem. A fronteira
 * e a mesma da rede interna, que ja e a fronteira do resto da arquitetura.
 * Se `LOG_INGEST_TOKEN` estiver definido, cobra-se um segundo fator simples:
 * um segredo compartilhado entre os servicos que gravam.
 */
const eventos = new Hono();

eventos.post("/eventos", async (c) => {
  const segredo = config.ingest.token;
  if (segredo && c.req.header("x-log-token") !== segredo) {
    return c.json(
      { error: "Segredo de ingestão ausente ou incorreto (header X-Log-Token)." },
      403
    );
  }

  const corpo = await c.req.json().catch(() => null);
  const evento = normalizar(corpo);

  if (!evento) {
    return c.json(
      { error: "Evento inválido: o campo `acao` é obrigatório e não pode ser vazio." },
      400
    );
  }

  // O IP de quem FEZ a acao vem no corpo (extraido pelo servico que recebeu a
  // requisicao do navegador). O `ipDe(c)` daqui e o IP do servico que mandou —
  // so entra se o emissor nao souber o do usuario, que e melhor que nada.
  const ip = evento.ip ?? ipDe(c);

  try {
    const id = await gravar({ ...evento, ip });
    return c.json({ ok: true, id }, 201);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[log-service] XADD falhou: ${motivo}`);
    // 500 e honesto aqui: o evento NAO foi gravado. Devolver 201 seria mentir
    // para quem tentou auditar — e um log que mente e pior que nenhum log.
    return c.json({ ok: false, erro: "Não foi possível gravar o evento no Redis." }, 500);
  }
});

export default eventos;
