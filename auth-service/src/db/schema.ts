import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  boolean,
  unique,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Schema do auth-service.
 *
 * Este arquivo e a "fronteira de dados" do servico de autenticacao: sao as duas
 * unicas tabelas que ele possui. O catalogo (servico separado) tem o proprio
 * schema, com favoritos e comentarios, e nunca importa daqui.
 */

/** Papeis de usuario. O catalogo pergunta o papel pelo endpoint GET /me. */
export const PAPEIS = ["usuario", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const usuarios = mysqlTable("usuarios", {
  id: int("id").primaryKey().autoincrement(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).unique().notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  /** Requisito 3: quem pode fazer o que. Todo mundo nasce como "usuario". */
  role: varchar("role", { length: 20 }).notNull().default("usuario"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

/**
 * Requisito 4: o link de redefinicao precisa de um REGISTRO, nao so do token.
 * - token     : 64 caracteres hexadecimais (32 bytes aleatorios) — unico
 * - usuario_id: quem pediu a redefinicao
 * - criado_em : quando o link foi gerado
 * - expira_em : criado_em + 30 minutos
 * - usado     : true depois que a senha foi trocada (impede reuso do mesmo link)
 */
export const resetTokens = mysqlTable(
  "reset_tokens",
  {
    id: int("id").primaryKey().autoincrement(),
    token: varchar("token", { length: 64 }).notNull(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    criadoEm: timestamp("criado_em").notNull(),
    expiraEm: timestamp("expira_em").notNull(),
    usado: boolean("usado").notNull().default(false),
  },
  (t) => [unique().on(t.token), index("reset_tokens_usuario_idx").on(t.usuarioId)]
);
