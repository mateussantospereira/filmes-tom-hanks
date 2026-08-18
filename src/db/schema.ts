import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";

export const usuarios = mysqlTable("usuarios", {
  id: int("id").primaryKey().autoincrement(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).unique().notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
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
