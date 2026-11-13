import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import {
  users,
  categorias,
  agendamentos,
  participacoes,
  perfis,
  assinaturas,
  logs_auditoria,
} from "../drizzle/schema";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Conexão SQLite (local, para desenvolvimento)
const sqlite = new BetterSqlite3("./dev.db", { readonly: false });
const db = drizzle(sqlite);

const app = new Hono();

// **GET /api/users** — Retorna usuário (simples)
app.get("/api/users", (c) => {
  const all = db.select().from(users);
  return c.json(all);
});

// **POST /api/users** — Cadastro simplificado
app.post("/api/users", (c) => {
  const body = await c.req.json();
  const [user] = db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      password_hash: body.password_hash,
      plan: "free",
    })
    .returning();
  return c.json(user);
});

// **==========================================================**
// ** ROTAS: CATEGORIAS (Recurso principal do negócio)
// **==========================================================**

// **GET /api/categorias** — Listar todas as categorias
app.get("/api/categorias", (c) => {
  const all = db.select().from(categorias);
  return c.json(all);
});

// **POST /api/categorias** — Criar nova categoria
app.post("/api/categorias", (c) => {
  const body = await c.req.json();
  const [cat] = db
    .insert(categorias)
    .values({
      nome: body.nome,
      descricao: body.descricao ?? null,
      criado_por: body.criado_por ?? 1,
    })
    .returning();
  return c.json(cat);
});

// **GET /api/categorias/:id** — Detalhar categoria
app.get("/api/categorias/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const [cat] = db.select().from(categorias).where(eq(categorias.id, id));
  if (!cat) return c.json({ error: "Categoria não encontrada" }, 404);
  return c.json(cat);
});

// **PUT /api/categorias/:id** — Editar categoria
app.put("/api/categorias/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const [cat] = db
    .update(categorias)
    .set({
      nome: body.nome,
      descricao: body.descricao,
      criado_por: body.criado_por,
    })
    .where(eq(categorias.id, id))
    .returning();
  if (!cat) return c.json({ error: "Categoria não encontrada" }, 404);
  return c.json(cat);
});

// **DELETE /api/categorias/:id** — Remover categoria
app.delete("/api/categorias/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const [cat] = db
    .delete(categorias)
    .where(eq(categorias.id, id))
    .returning();
  if (!cat) return c.json({ error: "Categoria não encontrada" }, 404);
  return c.json({ message: "Categoria removida com sucesso" });
});

// **==========================================================**
// ** ROTAS: AGENDAMENTOS (Recurso principal do negócio)
// **==========================================================**

// **GET /api/agendamentos** — Listar agendamentos do usuário logado
app.get("/api/agendamentos", (c) => {
  const userId = c.req.query("userId") as string | null;
  const q = userId
    ? db.select().from(agendamentos).where(eq(agendamentos.usuario_id, Number(userId)))
    : db.select().from(agendamentos);
  const all = q.orderBy(desc(agendamentos.data_horario));
  return c.json(all);
});

// **POST /api/agendamentos** — Criar novo agendamento
app.post("/api/agendamentos", (c) => {
  const body = await c.req.json();
  const [agend] = db
    .insert(agendamentos)
    .values({
      usuario_id: body.usuarioId,
      categoria_id: body.categoriaId,
      titulo: body.titulo,
      descricao: body.descricao,
      data_horario: body.dataHorario,
      status: "agendado",
    })
    .returning();
  return c.json(agend);
});

// **GET /api/agendamentos/:id** — Detalhar agendamento
app.get("/api/agendamentos/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const [agend] = db
    .select({
      agend: agendamentos,
      categoria: categorias.nome,
      usuarioNome: usuarios.nome,
    })
    .from(agendamentos)
    .leftJoin(categorias, eq(agendamentos.categoria_id, categorias.id))
    .leftJoin(usuarios, eq(agendamentos.usuario_id, usuarios.id))
    .where(eq(agendamentos.id, id));
  if (!agend) return c.json({ error: "Agendamento não encontrado" }, 404);
  return c.json(agend);
});

// **PUT /api/agendamentos/:id** — Editar agendamento
app.put("/api/agendamentos/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const [agend] = db
    .update(agendamentos)
    .set({
      titulo: body.titulo,
      descricao: body.descricao,
      categoria_id: body.categoriaId,
      data_horario: body.dataHorario,
      status: body.status,
    })
    .where(eq(agendamentos.id, id))
    .returning();
  if (!agend) return c.json({ error: "Agendamento não encontrado" }, 404);
  return c.json(agend);
});

// **DELETE /api/agendamentos/:id** — Remover agendamento
app.delete("/api/agendamentos/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const [agend] = db
    .delete(agendamentos)
    .where(eq(agendamentos.id, id))
    .returning();
  if (!agend) return c.json({ error: "Agendamento não encontrado" }, 404);
  return c.json({ message: "Agendamento removido com sucesso" });
});

// **==========================================================**
// ** ROTAS: PARTICIPACOES (Recurso principal do negócio)
// **==========================================================**

// **GET /api/participacoes** — Listar participacoes do usuário
app.get("/api/participacoes", (c) => {
  const userId = c.req.query("userId") as string | null;
  const q = userId
    ? db.select().from(participacoes).where(eq(participacoes.usuario_id, Number(userId)))
    : db.select().from(participacoes);
  const all = q.orderBy(desc(participacoes.criado_em));
  return c.json(all);
});

// **POST /api/participacoes** — Criar participacao
app.post("/api/participacoes", (c) => {
  const body = await c.req.json();
  const [part] = db
    .insert(participacoes)
    .values({
      agendamento_id: body.agendamentoId,
      usuario_id: body.usuarioId,
      papel: body.papel,
      confirmado: false,
    })
    .returning();
  return c.json(part);
});

// **GET /api/participacoes/:id** — Detalhar participacao
app.get("/api/participacoes/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const [part] = db
    .select({
      particip: participacoes,
      agendTitulo: agendamentos.titulo,
      usuarioNome: usuarios.nome,
    })
    .from(participacoes)
    .leftJoin(agendamentos, eq(participacoes.agendamento_id, agendamentos.id))
    .leftJoin(usuarios, eq(participacoes.usuario_id, usuarios.id))
    .where(eq(participacoes.id, id));
  if (!part) return c.json({ error: "Participacao não encontrada" }, 404);
  return c.json(part);
});

// **PUT /api/participacoes/:id** — Editar participacao (confirmar, etc.)
app.put("/api/participacoes/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const [part] = db
    .update(participacoes)
    .set({
      confirmado: body.confirmado,
    })
    .where(eq(participacoes.id, id))
    .returning();
  if (!part) return c.json({ error: "Participacao não encontrada" }, 404);
  return c.json(part);
});

// **==========================================================**
// ** ROTAS: PERFIS (Atividade 6 continuidade)
// **==========================================================**

// **GET /api/perfis** — Listar perfis
app.get("/api/perfis", (c) => {
  const all = db.select().from(perfis);
  return c.json(all);
});

// **POST /api/perfis** — Criar perfil
app.post("/api/perfis", (c) => {
  const body = await c.req.json();
  const [perfil] = db
    .insert(perfis)
    .values({
      usuarioId: body.usuarioId,
      bio: body.bio,
      fotoChave: body.fotoChave,
    })
    .returning();
  return c.json(perfil);
});

// **==========================================================**
// ** ROTAS: ASSINATURAS (Atividade 7 continuidade)
// **==========================================================**

// **GET /api/assinaturas** — Ver status do plano
app.get("/api/assinaturas", (c) => {
  const userId = c.req.query("userId") as string | null;
  const [assin] = userId
    ? db
        .select()
        .from(assinaturas)
        .where(eq(assinaturas.usuarioId, Number(userId)))
        .limit(1)
    : db.select().from(assinaturas).limit(1);
  return c.json(assin);
});

// **==========================================================**
// ** ROTAS: LOGS DE AUDITORIA (Atividade 5 + 10)
// **==========================================================**

// **POST /api/logs** — Registrar evento de auditoria
app.post("/api/logs", (c) => {
  const body = await c.req.json();
  const [log] = db
    .insert(logs_auditoria)
    .values({
      usuario_id: body.usuarioId ?? null,
      acao: body.acao,
      recurso: body.recurso,
      descricao: body.descricao,
    })
    .returning();
  return c.json(log);
});

// **GET /api/logs** — Listar eventos (admin only conceptualmente)
app.get("/api/logs", (c) => {
  const all = db.select().from(logs_auditoria).orderBy(desc(logs_auditoria.criado_em));
  return c.json(all.slice(0, 100)); // limite 100
});

// **GET /api/users/me** — Informações do usuário logado (simples)
app.get("/api/users/me", (c) => {
  const all = db.select().from(users);
  return c.json(all);
});

export default app;