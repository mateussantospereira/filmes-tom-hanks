import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  unique,
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

export const favoritos = mysqlTable(
  "favoritos",
  {
    id: int("id").primaryKey().autoincrement(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    tmdbMovieId: int("tmdb_movie_id").notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    posterPath: varchar("poster_path", { length: 255 }),
    criadoEm: timestamp("criado_em").defaultNow(),
  },
  (t) => [unique().on(t.usuarioId, t.tmdbMovieId)]
);

export const comentarios = mysqlTable("comentarios", {
  id: int("id").primaryKey().autoincrement(),
  usuarioId: int("usuario_id")
    .references(() => usuarios.id)
    .notNull(),
  tmdbMovieId: int("tmdb_movie_id").notNull(),
  texto: text("texto").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});
