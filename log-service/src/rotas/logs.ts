import { Hono } from "hono";
import { config } from "../config";
import { podeConsultarLogs, ipDe } from "../autorizacao";
import { ultimos, gravar } from "../redis";

/**
 * `GET /logs` — a CONSULTA DE AUDITORIA, exclusiva de admin.
 *
 * Requisito 5: "uma rota que lista os ultimos N eventos, protegida pelo mesmo
 * controle de acesso da atividade 4 — um usuario comum tentando acessar recebe
 * 403, igual antes."
 *
 * `igual antes` significa a MESMA cadeia de verificacao, nao uma parecida:
 *
 *   1. o catalogo ja recusou (exigePermissao("consultar:logs")) -> 403 rapido
 *   2. AQUI o dono do log recusa de novo, perguntando ao auth-service
 *
 * Duas checagens, como em todo o resto da atividade 4. Uma so nao e garantia:
 * este servico pode ser alcancado direto por dentro da rede, e a rede ja mudou
 * de ideia uma vez.
 */
const logs = new Hono();

/** Teto do `?limite=`. 500 e o suficiente para olhar a janela recente; acima
 *  disso a leitura deixa de ser "ver o que acabou de acontecer" e vira
 *  varredura — coisa de exportacao, nao de consulta. */
const LIMITE_MAXIMO = 500;
const LIMITE_PADRAO = 50;

logs.get("/logs", async (c) => {
  const veredito = await podeConsultarLogs(c);
  if (!veredito.ok) {
    return c.json({ error: veredito.erro }, veredito.status);
  }

  const bruto = c.req.query("limite") ?? String(LIMITE_PADRAO);
  const limite = Number(bruto);
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
    return c.json(
      {
        error: `Parâmetro inválido: "limite" deve ser um inteiro entre 1 e ${LIMITE_MAXIMO}.`,
        limite_recebido: bruto,
      },
      400
    );
  }

  try {
    const eventos = await ultimos(limite);

    // Quem LEU a auditoria tambem e fato de auditoria. Gravado DEPOIS da
    // leitura, entao este evento so aparece na consulta seguinte — e isso e
    // prova de que a ordem do stream esta certa: a leitura nao pode aparecer
    // antes dela mesma.
    void gravar({
      acao: "consultar_logs",
      usuario_id: veredito.perfil.usuarioId,
      usuario: veredito.perfil.nome,
      papel: veredito.perfil.role,
      recurso: `stream:${config.redis.stream}`,
      detalhe: `limite=${limite}`,
      ip: ipDe(c),
      origem: "catalogo",
    }).catch((erro) => {
      console.error(`[log-service] falhou ao registrar a propria leitura: ${erro}`);
    });

    return c.json({
      eventos,
      total: eventos.length,
      limite,
      stream: config.redis.stream,
      consultado_por: {
        usuarioId: veredito.perfil.usuarioId,
        nome: veredito.perfil.nome,
        papel: veredito.perfil.role,
      },
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[log-service] XRANGE falhou: ${motivo}`);
    return c.json(
      { error: "Não foi possível ler o stream de auditoria no Redis." },
      503
    );
  }
});

export default logs;
