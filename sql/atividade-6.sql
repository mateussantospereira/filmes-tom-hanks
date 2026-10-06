-- =============================================================================
-- ISW055 · Atividade 6 · Armazenamento de objetos (perfil do usuario)
-- =============================================================================
-- Cria a tabela `perfis`, DONO: catalogo.
--
-- A foto NUNCA entra aqui: so a CHAVE do objeto no MinIO (`foto_chave`).
-- Exibir a foto depois e ler a chave e montar a URL — o binario fica no
-- object storage, nunca numa coluna BLOB do MariaDB (decisao documentada no
-- README, secao Atividade 6).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS. Rodar duas vezes nao faz estrago.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `perfis` (
  `usuario_id` int(11) NOT NULL,
  `bio` text DEFAULT NULL,
  `foto_chave` varchar(255) DEFAULT NULL,
  `atualizado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `fk_perfis_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;