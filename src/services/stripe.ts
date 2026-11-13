import Stripe from "stripe";

/**
 * Cliente do Stripe — Atividade 7 (plano Premium).
 *
 * O CATALOGO e o dono desta integracao: e ele que cria a Checkout Session
 * (rota autenticada) e recebe o webhook do Stripe. O auth-service nunca fala
 * com o Stripe; ele so guarda o direito (`usuarios.premium`), que o catalogo
 * atualiza por um endpoint interno depois que o pagamento e confirmado.
 *
 * Duas regras que o codigo abaixo materializa:
 *
 *   1. NENHUM dado de cartao passa por aqui. O numero, o CVV e a validade sao
 *      digitados na pagina HOSPEDADA pelo Stripe. O nosso backend so ve a
 *      confirmacao (`checkout.session.completed`), nunca o cartao.
 *
 *   2. Sem chave configurada, o catalogo sobe normalmente. O checkout responde
 *      503 com uma mensagem clara em vez de derrubar o processo no boot — o
 *      mesmo principio do MinIO (atividade 6): servico de apoio fora do ar nao
 *      pode derrubar o catalogo.
 */

const chaveSecreta = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const precoPremium = process.env.STRIPE_PRICE_ID?.trim() ?? "";
const segredoWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

/**
 * URL publica do catalogo. O Stripe redireciona o navegador para ca depois do
 * pagamento; por isso precisa ser o endereco que a pessoa abre, e nao o nome
 * interno do container.
 */
export const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL ?? "http://localhost:8222").replace(
  /\/+$/,
  ""
);

/** Checkout só funciona com a chave secreta E o preco do plano configurados. */
export const stripeConfigurado = Boolean(chaveSecreta && precoPremium);

/** O webhook só pode ser validado se o segredo de assinatura estiver configurado. */
export const webhookConfigurado = Boolean(chaveSecreta && segredoWebhook);

export const STRIPE_PRICE_ID = precoPremium;
export const STRIPE_WEBHOOK_SECRET = segredoWebhook;

let instancia: Stripe | null = null;

/**
 * Instancia unica e PREGUICOSA: criar o cliente com chave vazia faria o
 * processo morrer no import. Assim, o catalogo sobe sem Stripe configurado e
 * so a rota de pagamento responde 503.
 */
export function stripe(): Stripe {
  if (!chaveSecreta) {
    throw new Error("STRIPE_SECRET_KEY nao configurada");
  }
  instancia ??= new Stripe(chaveSecreta);
  return instancia;
}
