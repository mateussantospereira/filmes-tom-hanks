import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import { assinaturas, favoritos } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { registrar, ipDe } from "../services/log-service";
import { definirPremium } from "../services/auth-service";
import {
  stripe,
  stripeConfigurado,
  webhookConfigurado,
  STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  APP_PUBLIC_URL,
} from "../services/stripe";
import { LIMITE_FAVORITOS_GRATIS, PRECO_PREMIUM_LABEL } from "../services/plano";
import type { Env } from "../types";

/**
 * PAGAMENTO (Atividade 7) — o plano Premium, cobrado pelo Stripe.
 *
 * O desenho e o do enunciado: o cartao NUNCA passa pelo nosso backend. O
 * usuario é redirecionado para a pagina HOSPEDADA do Stripe (Checkout), digita
 * os dados la, e o Stripe nos avisa DEPOIS, por webhook, que o pagamento
 * aconteceu. A requisicao que abriu o checkout nao recebe "pago" como resposta:
 * ela recebe uma URL. A confirmacao chega por outro caminho, de forma
 * assincrona.
 *
 *   navegador -> POST /api/premium/checkout -> cria Checkout Session
 *             <- { url }                   -> redireciona ao Stripe
 *                                              |
 *                                              | paga (modo de teste)
 *                                              v
 *             POST /api/premium/webhook  <- Stripe (assinado)
 *                  1. valida a assinatura (HMAC do Stripe)
 *                  2. grava o ID do cliente/assinatura em `assinaturas`
 *                  3. avisa o auth-service para marcar `usuarios.premium = true`
 *
 * O webhook e PUBLICO (o Stripe nao tem o JWT do usuario). Quem autentica a
 * chamada e a ASSINATURA criptografica — por isso a rota le o corpo CRU, sem
 * JSON.parse antes: a assinatura e calculada sobre os bytes exatos que o Stripe
 * enviou.
 */
const premium = new Hono<Env>();

/** Nome de evento do Stripe que ativa o plano. */
const EVENTO_PAGO = "checkout.session.completed";

/* -------------------------------------------------------------------------- */
/* WEBHOOK — publico, autenticado pela assinatura do Stripe                    */
/* -------------------------------------------------------------------------- */

premium.post("/webhook", async (c) => {
  if (!webhookConfigurado) {
    return c.json(
      {
        error:
          "Webhook do Stripe não configurado. Defina STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.",
      },
      503
    );
  }

  const assinaturaRecebida = c.req.header("stripe-signature");
  if (!assinaturaRecebida) {
    // Recusar cedo e barato: sem assinatura nao ha como saber se a chamada veio
    // do Stripe ou de qualquer pessoa na internet (esta rota e publica).
    return c.json({ error: "Cabeçalho stripe-signature ausente." }, 400);
  }

  // Corpo CRU, exatamente como chegou — nao use c.req.json() aqui.
  const corpo = await c.req.text();

  let evento: Stripe.Event;
  try {
    /**
     * `constructEventAsync`, e NAO `constructEvent`.
     *
     * O SDK do Stripe escolhe a versao do pacote por "conditions" do runtime.
     * O Bun resolve a condition `bun`, que aponta para o build de worker — e o
     * provider de criptografia desse build usa WebCrypto (Promise), nao o
     * `node:crypto` sincrono. Chamar a versao sincrona aqui estoura com
     * "SubtleCryptoProvider cannot be used in a synchronous context" e o
     * webhook recusaria TODA chamada legitima do Stripe. A versao assincrona
     * funciona nos dois builds.
     */
    evento = await stripe().webhooks.constructEventAsync(
      corpo,
      assinaturaRecebida,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[premium] webhook recusado (assinatura inválida): ${motivo}`);
    // 400 (e nao 401): a assinatura nao confere com o segredo desta conta.
    return c.json({ error: "Assinatura do webhook inválida." }, 400);
  }

  try {
    if (evento.type === EVENTO_PAGO) {
      const sessao = evento.data.object as Stripe.Checkout.Session;

      const usuarioId = Number(
        sessao.client_reference_id ?? sessao.metadata?.usuarioId ?? ""
      );

      if (!Number.isInteger(usuarioId)) {
        // Evento legítimo, mas sem como saber de quem é: responder 200 evita
        // retentativas infinitas do Stripe para um dado que nunca vai mudar.
        console.error(`[premium] ${EVENTO_PAGO} sem usuario_id: sessao ${sessao.id}`);
        return c.json({ received: true, ignorado: "sem usuario_id" });
      }

      const clienteId =
        typeof sessao.customer === "string" ? sessao.customer : sessao.customer?.id ?? null;
      const assinaturaId =
        typeof sessao.subscription === "string"
          ? sessao.subscription
          : sessao.subscription?.id ?? null;

      await db
        .insert(assinaturas)
        .values({
          usuarioId,
          stripeCustomerId: clienteId,
          stripeSubscriptionId: assinaturaId,
          status: "ativa",
        })
        .onDuplicateKeyUpdate({
          set: {
            stripeCustomerId: clienteId,
            stripeSubscriptionId: assinaturaId,
            status: "ativa",
          },
        });

      // O direito mora no auth-service (dono de `usuarios`). Aqui so avisamos.
      const sincronizou = await definirPremium(usuarioId, true);

      await registrar({
        acao: "assinatura_ativada",
        usuario_id: usuarioId,
        usuario: null,
        papel: null,
        recurso: "plano:premium",
        detalhe: `Stripe ${sessao.id} · assinatura ${assinaturaId ?? "—"}${
          sincronizou.ok ? "" : " · FALHA ao sincronizar premium"
        }`,
        ip: ipDe(c),
      });

      if (!sincronizou.ok) {
        // O Stripe cobrou, mas o direito nao foi gravado. Devolver 500 faz o
        // Stripe reenviar o evento — e o webhook e idempotente (upsert).
        console.error(
          `[premium] pagamento confirmado, mas definirPremium(${usuarioId}) falhou: ${sincronizou.erro}`
        );
        return c.json({ error: "Falha ao ativar o Premium; o Stripe deve reenviar." }, 500);
      }

      return c.json({ received: true, usuarioId, premium: true });
    }

    /**
     * Ciclo de vida da assinatura: cancelamento, pagamento recusado, reativacao.
     * O Stripe manda `customer.subscription.updated` em varias transicoes; o
     * status do evento e a fonte da verdade do direito.
     */
    if (
      evento.type === "customer.subscription.updated" ||
      evento.type === "customer.subscription.deleted"
    ) {
      const sub = evento.data.object as Stripe.Subscription;

      const [linha] = await db
        .select()
        .from(assinaturas)
        .where(eq(assinaturas.stripeSubscriptionId, sub.id))
        .limit(1);

      if (!linha) {
        return c.json({ received: true, ignorado: "assinatura desconhecida" });
      }

      const status = evento.type === "customer.subscription.deleted" ? "cancelada" : sub.status;
      const ativo = status === "active" || status === "trialing";

      await db
        .update(assinaturas)
        .set({ status })
        .where(eq(assinaturas.usuarioId, linha.usuarioId));

      const sincronizou = await definirPremium(linha.usuarioId, ativo);

      await registrar({
        acao: ativo ? "assinatura_ativada" : "assinatura_cancelada",
        usuario_id: linha.usuarioId,
        usuario: null,
        papel: null,
        recurso: "plano:premium",
        detalhe: `Stripe ${sub.id} · status ${status}${
          sincronizou.ok ? "" : " · FALHA ao sincronizar premium"
        }`,
        ip: ipDe(c),
      });

      if (!sincronizou.ok) {
        return c.json({ error: "Falha ao sincronizar o Premium; o Stripe deve reenviar." }, 500);
      }

      return c.json({ received: true, usuarioId: linha.usuarioId, premium: ativo, status });
    }

    // Outros eventos do Stripe sao aceitos e ignorados (o endpoint pode receber
    // varios tipos; so os acima mudam estado).
    return c.json({ received: true, tipo: evento.type });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[premium] erro ao processar webhook ${evento.type}: ${motivo}`);
    return c.json({ error: "Erro ao processar o webhook." }, 500);
  }
});

/* -------------------------------------------------------------------------- */
/* CHECKOUT — autenticado; devolve a URL hospedada pelo Stripe                 */
/* -------------------------------------------------------------------------- */

premium.post("/checkout", authMiddleware, async (c) => {
  if (!stripeConfigurado) {
    return c.json(
      {
        error:
          "Pagamentos não configurados neste ambiente. Defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID.",
      },
      503
    );
  }

  const usuarioId = c.get("usuarioId");

  if (c.get("premium")) {
    return c.json({ error: "Sua conta já é Premium — favoritos ilimitados." }, 409);
  }

  try {
    const [existente] = await db
      .select()
      .from(assinaturas)
      .where(eq(assinaturas.usuarioId, usuarioId))
      .limit(1);

    let clienteId = existente?.stripeCustomerId ?? null;

    // Reaproveita o cliente do Stripe entre tentativas de checkout; cria so na
    // primeira. O ID fica no NOSSO banco — nunca o cartao.
    if (!clienteId) {
      const cliente = await stripe().customers.create({
        email: c.get("email"),
        name: c.get("nome"),
        metadata: { usuarioId: String(usuarioId) },
      });
      clienteId = cliente.id;

      await db
        .insert(assinaturas)
        .values({ usuarioId, stripeCustomerId: clienteId, status: "pendente" })
        .onDuplicateKeyUpdate({
          set: { stripeCustomerId: clienteId, status: "pendente" },
        });
    }

    const sessao = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: clienteId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      // `client_reference_id` e o que volta no webhook: e por ele que sabemos
      // qual usuario pagou, sem confiar em nada que venha do navegador.
      client_reference_id: String(usuarioId),
      metadata: { usuarioId: String(usuarioId) },
      subscription_data: { metadata: { usuarioId: String(usuarioId) } },
      success_url: `${APP_PUBLIC_URL}/catalog?checkout=sucesso`,
      cancel_url: `${APP_PUBLIC_URL}/catalog?checkout=cancelado`,
    });

    await registrar({
      acao: "checkout_iniciado",
      usuario_id: usuarioId,
      usuario: c.get("nome"),
      papel: c.get("role"),
      recurso: "plano:premium",
      detalhe: `Stripe ${sessao.id}`,
      ip: ipDe(c),
    });

    return c.json({
      url: sessao.url,
      id: sessao.id,
      plano: PRECO_PREMIUM_LABEL,
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[premium] falha ao criar checkout de ${usuarioId}: ${motivo}`);
    // 502: o Stripe (servico externo) recusou/nao respondeu.
    return c.json({ error: "Não foi possível abrir o checkout do Stripe agora. Tente novamente." }, 502);
  }
});

/* -------------------------------------------------------------------------- */
/* STATUS — quantos favoritos o plano atual permite                            */
/* -------------------------------------------------------------------------- */

premium.get("/status", authMiddleware, async (c) => {
  const usuarioId = c.get("usuarioId");
  const [linha] = await db
    .select({ total: count() })
    .from(favoritos)
    .where(eq(favoritos.usuarioId, usuarioId));

  const total = Number(linha?.total ?? 0);
  const ehPremium = c.get("premium");

  return c.json({
    premium: ehPremium,
    plano: ehPremium ? "premium" : "gratuito",
    limiteFavoritos: ehPremium ? null : LIMITE_FAVORITOS_GRATIS,
    favoritos: total,
    restantes: ehPremium ? null : Math.max(0, LIMITE_FAVORITOS_GRATIS - total),
    preco: PRECO_PREMIUM_LABEL,
    stripeConfigurado,
  });
});

export default premium;
