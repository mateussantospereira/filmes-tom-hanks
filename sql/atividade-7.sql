-- =============================================================================
-- ISW055 · Atividade 7 · Serviço baseado em pagamento (plano Premium)
-- =============================================================================
-- Cria a tabela `assinaturas`, DONA: catalogo.
--
-- O catalogo e quem conversa com o Stripe (cria o Checkout e recebe o
-- webhook), entao e ele que guarda a referencia da assinatura. O que entra
-- aqui e SOMENTE o identificador que o provedor devolve:
--
--   stripe_customer_id     `cus_...`  quem paga
--   stripe_subscription_id `sub_...`  a assinatura recorrente
--   status                 pendente | ativa | cancelada | inadimplente
--
-- O que NUNCA entra aqui: numero de cartao, CVV, validade. Esses dados sao
-- digitados na pagina hospedada pelo Stripe e nunca passam pelo nosso backend
-- (requisito 5 da atividade).
--
-- O DIREITO (`usuarios.premium`) fica no auth-service, dono de `usuarios`.
-- O webhook atualiza os dois: esta tabela e o direito, por um endpoint interno.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS. Rodar duas vezes nao faz estrago.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `assinaturas` (
  `usuario_id` int(11) NOT NULL,
  `stripe_customer_id` varchar(64) DEFAULT NULL,
  `stripe_subscription_id` varchar(64) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pendente',
  `plano` varchar(40) NOT NULL DEFAULT 'premium',
  `atualizado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`),
  UNIQUE KEY `assinaturas_stripe_subscription_id_unique` (`stripe_subscription_id`),
  CONSTRAINT `fk_assinaturas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conferindo o resultado -----------------------------------------------------------
-- SELECT a.usuario_id, u.nome, u.email, u.premium,
--        a.stripe_customer_id, a.stripe_subscription_id, a.status
--   FROM assinaturas a JOIN usuarios u ON u.id = a.usuario_id;
