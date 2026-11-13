import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Schema do CATALOGO: `favoritos` e `comentarios`.
 *
 * Na atividade 2 este arquivo tambem declarava `usuarios` — porque login,
 * cadastro e hash de senha moravam no mesmo container. Hoje quem cuida da
 * tabela `usuarios` (e da `reset_tokens`) e o auth-service, entao o catalogo
 * nao faz nenhuma consulta nela: e um outro servico, e o acesso e por HTTP.
 *
 * A declaracao abaixo existe por um unico motivo tecnico: manter as CHAVES
 * ESTRANGEIRAS de `favoritos` e `comentarios` apontando para `usuarios`, que
 * ja existem no banco desde a atividade 2. Sem esta declaracao, um
 * `db:push` do catalogo acabaria removendo as FKs (e, por consequencia,
 * truncando as duas tabelas).
 *
 * Nenhuma rota deste servico le `usuarios`. Para o catalogo, `usuario_id` e um
 * identificador opaco emitido pelo auth-service. E o `tablesFilter` do
 * drizzle.config.ts que mantem `usuarios` fora do `db:push`, para este
 * catalogo nunca alterar nem dropar a tabela do outro servico.
 */
export const usuarios = mysqlTable("usuarios", {
  id: int("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("usuario"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

/** Tabela: categorias do domínio do negócio (atividade 10) */
export const categorias = mysqlTable(
  "categorias",
  {
    id: int("id").primaryKey().autoincrement(),
    nome: varchar("nome", { length: 100 }).notNull.Unique(),
    descricao: text("descricao"),
    criado_em: timestamp("criado_em").defaultNow(),
    criado_por: int("criado_por")
      .references(() => usuarios.id)
      .notNull(),
  },
  (t) => [unique().on(t.nome)]
);

/** Tabela: agendamentos do domínio (atividade 10) */
export const agendamentos = mysqlTable(
  "agendamentos",
  {
    id: int("id").primaryKey().autoincrement(),
    usuario_id: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    categoria_id: int("categoria_id")
      .references(() => categorias.id)
      .notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descricao: text("descricao"),
    data_horario: timestamp("data_horario").notNull(),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("agendado"), // agendado | confirmado | cancelado | concluido
    criado_em: timestamp("criado_em").defaultNow(),
    atualizado_em: timestamp("atualizado_em")
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [
    unique().on(t.usuario_id, t.data_horario),
    index("agendamentos_status_idx").on(t.status),
  ]
);

/** Tabela: participacoes do domínio (atividade 10) */
export const participacoes = mysqlTable(
  "participacoes",
  {
    id: int("id").primaryKey().autoincrement(),
    agendamento_id: int("agendamento_id")
      .references(() => agendamentos.id)
      .notNull(),
    usuario_id: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    papel: varchar("papel", { length: 20 }).notNull(), // motorista | passageiro
    confirmado: boolean("confirmado").notNull().default(false),
    criado_em: timestamp("criado_em").defaultNow(),
  },
  (t) => [
    unique().on(t.agendamento_id, t.usuario_id, t.papel),
    index("participacoes_agendamento_idx").on(t.agendamento_id),
    index("participacoes_usuario_idx").on(t.usuario_id),
  ]
);

/**
 * Atividade 6 — perfil de usuario (bio + foto).
 *
 * Esta tabela guarda SO A REFERENCIA da foto: `foto_chave` e a chave do objeto
 * no MinIO (`perfis/<usuarioId>/avatar-<timestamp>.<ext>`). O binario nunca
 * entra no MariaDB — a decisao esta documentada no README da atividade 6.
 *
 * `usuario_id` e a chave primaria porque o perfil e 1:1 com o usuario, e o id
 * vem do auth-service (referencia, nao FK de confianca — mesmo padrao de
 * `favoritos` e `comentarios`).
 */
export const perfis = mysqlTable("perfis", {
  usuarioId: int("usuario_id")
    .primaryKey()
    .references(() => usuarios.id),
  bio: text("bio"),
  fotoChave: varchar("foto_chave", { length: 255 }),
  atualizadoEm: timestamp("atualizado_em").defaultNow().onUpdateNow(),
});

/**
 * Atividade 7 — assinatura do plano Premium.
 *
 * O dono desta tabela e o CATALOGO, porque e ele que conversa com o Stripe.
 * Ela guarda, no maximo, os IDENTIFICADORES que o provedor devolve:
 *
 *   stripe_customer_id     -> `cus_...` (quem paga)
 *   stripe_subscription_id -> `sub_...` (a assinatura recorrente)
 *   status                 -> pendente | ativa | cancelada | inadimplente
 *
 * NUNCA entra aqui numero de cartao, CVV ou validade: esses dados ficam so do
 * lado do Stripe, na pagina hospedada por ele (requisito 5 da atividade).
 *
 * O DIREITO em si (`premium: true`) fica em `usuarios`, no auth-service, que e
 * o dono da identidade. O webhook atualiza os dois: esta tabela (dados da
 * assinatura) e o auth-service (o beneficio). E a mesma divisao de donos das
 * atividades anteriores: identidade la, pagamento aqui.
 */
export const assinaturas = mysqlTable(
  "assinaturas",
  {
    usuarioId: int("usuario_id")
      .primaryKey()
      .references(() => usuarios.id),
    stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("pendente"),
    plano: varchar("plano", { length: 40 }).notNull().default("premium"),
    atualizadoEm: timestamp("atualizado_em").defaultNow().onUpdateNow(),
  },
  (t) => [unique().on(t.stripeSubscriptionId)]
);

/**
 * Novo: Tabela de logs de auditoria do domínio (atividade 10 extension).
 *
 * Registra eventos de negocio: "carona criada", "vaga reservada", "carona cancelada".
 * Usada pelo log-service via Redis Streams.
 */
export const logs_auditoria = mysqlTable(
  "logs_auditoria",
  {
    id: int("id").primaryKey().autoincrement(),
    usuario_id: int("usuario_id").references(() => usuarios.id),
    acao: varchar("acao", { length: 50 }).notNull(), // ex: "carona_criada", "login", "logout"
    recurso: varchar("recurso", { length: 100 }), // ex: "agendamento", "usuario"
    descricao: text("descricao"),
    criado_em: timestamp("criado_em").defaultNow(),
  },
  (t) => [index("logs_acao_idx").on(t.acao), index("logs_usuario_idx").on(t.usuario_id)]
);

/** Tipos derivados para uso no código */
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categorias.$inferSelect;
export type InsertCategory = typeof categorias.$inferInsert;
export type Appointment = typeof agendamentos.$inferSelect;
export type InsertAppointment = typeof agendamentos.$inferInsert;
export type Participation = typeof participacoes.$inferSelect;
export type InsertParticipation = typeof participacoes.$inferInsert;
export type AuditLog = typeof logs_auditoria.$inferSelect;
export type InsertAuditLog = typeof logs_auditoria.$inferInsert;