/**
 * Regras do PLANO (Atividade 7).
 *
 * O limite e uma decisao de negocio, nao de pagamento — por isso mora fora da
 * integracao com o Stripe. Quem cobra e o Stripe; quem decide o que o plano
 * gratuito pode fazer e o catalogo.
 */

/**
 * Quantos favoritos o plano gratuito aceita. O Premium e ilimitado.
 *
 * 5 e um numero escolhido para a demonstracao ser curta: da para encher em
 * poucos cliques e provar a diferenca de comportamento entre comum e premium
 * (requisito 4 da atividade). Ajustavel por variavel de ambiente sem deploy de
 * codigo novo.
 */
export const LIMITE_FAVORITOS_GRATIS = Number(
  process.env.LIMITE_FAVORITOS_GRATIS ?? 5
);

/** Texto do plano exibido na interface (o valor real vem do Price no Stripe). */
export const PRECO_PREMIUM_LABEL = process.env.STRIPE_PRICE_LABEL ?? "R$ 9,90/mês";
