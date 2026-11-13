-- =============================================================================
-- ISW055 · Atividade 7 · Serviço baseado em pagamento (plano Premium)
-- =============================================================================
-- O auth-service e o DONO de `usuarios`, entao e aqui que mora o DIREITO
-- `premium`. Ele NAO guarda dado de pagamento: numero de cartao, CVV e
-- validade nunca chegam neste banco (esses dados ficam so no Stripe).
--
-- Os identificadores que o Stripe devolve (`cus_...` e `sub_...`) ficam na
-- tabela `assinaturas` do catalogo, que e o dono da integracao.
--
-- Como aplicar (a partir da raiz do repositorio):
--   cd auth-service && bun run db:migrate
--   (ou, de dentro do container no Portainer: bun run db:migrate)
--
-- Idempotente: rodar de novo tolera "coluna ja existe" (o script confere o
-- schema antes e depois). Nenhum usuario existente perde dado — todos ficam
-- com premium = false ate assinarem.
-- =============================================================================

ALTER TABLE `usuarios`
  ADD COLUMN `premium` boolean NOT NULL DEFAULT false;

-- Conferindo o resultado -----------------------------------------------------------
-- SELECT id, nome, email, role, premium FROM usuarios;
--
-- Para simular um premium sem passar pelo Stripe (apenas em desenvolvimento):
-- UPDATE `usuarios` SET `premium` = true WHERE `email` = 'voce@exemplo.com';
