-- =============================================================================
-- Atividade 3 — alteracoes de schema do auth-service
-- =============================================================================
-- A tabela `usuarios` ja existe desde a atividade 2. A atividade 3 acrescenta
-- duas coisas, e ambas sao do auth-service:
--
--   1. a coluna `role` (requisito 3 — papeis de usuario)
--   2. a tabela `reset_tokens` (requisito 4 — registro dos links de redefinicao,
--      com criado_em / expira_em / usado)
--
-- Como aplicar (rodar uma vez, no banco da aplicacao):
--   mysql -h SEU_HOST -u SEU_USUARIO -p SEU_BANCO < auth-service/sql/atividade-3.sql
--
-- No Portainer, ou pelo proprio servico, o caminho equivalente e:
--   cd auth-service && bun run db:push
-- (o drizzle.config.ts deste servico tem tablesFilter = ["usuarios","reset_tokens"],
--  entao ele nunca toca em favoritos/comentarios, que sao do catalogo)
-- =============================================================================

-- 1) Papeis de usuario -------------------------------------------------------------
-- Todo mundo que ja tem conta nasce como "usuario".
ALTER TABLE `usuarios`
  ADD COLUMN `role` varchar(20) NOT NULL DEFAULT 'usuario';

-- 2) Registro dos tokens de recuperacao de senha ----------------------------------
-- O link de redefinicao precisa de um REGISTRO, e nao so do token em si:
--   criado_em  -> quando o link foi gerado
--   expira_em  -> criado_em + 30 minutos
--   usado      -> vira true quando a senha foi trocada (o link nao serve de novo)
CREATE TABLE `reset_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `token` varchar(64) NOT NULL,
  `usuario_id` int NOT NULL,
  `criado_em` timestamp NOT NULL,
  `expira_em` timestamp NOT NULL,
  `usado` boolean NOT NULL DEFAULT false,
  CONSTRAINT `reset_tokens_id` PRIMARY KEY (`id`),
  CONSTRAINT `reset_tokens_token_unique` UNIQUE (`token`),
  CONSTRAINT `reset_tokens_usuario_id_usuarios_id_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE no action ON UPDATE no action
);

CREATE INDEX `reset_tokens_usuario_idx` ON `reset_tokens` (`usuario_id`);

-- 3) Como tornar alguem admin (para demonstrar o papel) ----------------------------
-- Nao existe tela de administracao nesta atividade: o papel e um dado da conta.
-- Troque o e-mail abaixo pelo seu e troque 'usuario' por 'admin'.
-- UPDATE `usuarios` SET `role` = 'admin' WHERE `email` = 'voce@exemplo.com';

-- Conferindo o resultado -----------------------------------------------------------
-- SELECT id, nome, email, role, criado_em FROM usuarios;
-- SELECT token, usuario_id, criado_em, expira_em, usado FROM reset_tokens;
