import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { usuarios } from "../db/schema";
import { config } from "../config";

/**
 * Rotas de autenticacao. Este arquivo existe SO dentro do auth-service —
 * no catalogo da atividade 3 nao ha mais nem uma linha de login/senha/role.
 */

const auth = new Hono();

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAMANHO_MINIMO_SENHA = 6;

auth.post("/register", async (c) => {
  const { nome, email, senha } = await c.req.json().catch(() => ({}));

  if (!nome || !email || !senha) {
    return c.json({ error: "Nome, email e senha são obrigatórios" }, 400);
  }

  if (!EMAIL_VALIDO.test(String(email))) {
    return c.json({ error: "Email inválido" }, 400);
  }

  if (String(senha).length < TAMANHO_MINIMO_SENHA) {
    return c.json({ error: `A senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres` }, 400);
  }

  const existing = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, String(email).toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email já cadastrado" }, 409);
  }

  // `role` nao vem do corpo da requisicao de proposito: um usuario nao
  // escolhe o proprio papel. Todo cadastro nasce como "usuario"; virar
  // "admin" e uma decisao administrativa, feita no banco/seed.
  const senhaHash = await bcrypt.hash(String(senha), 10);
  await db.insert(usuarios).values({
    nome: String(nome),
    email: String(email).toLowerCase(),
    senhaHash,
    role: "usuario",
  });

  return c.json({ message: "Conta criada com sucesso" }, 201);
});

auth.post("/login", async (c) => {
  const { email, senha } = await c.req.json().catch(() => ({}));

  if (!email || !senha) {
    return c.json({ error: "Email e senha são obrigatórios" }, 400);
  }

  const rows = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, String(email).toLowerCase()))
    .limit(1);

  // Mensagem unica para "e-mail nao existe" e "senha errada": nao entregamos a
  // um invasor a informacao de quais e-mails tem conta no sistema.
  if (rows.length === 0) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const user = rows[0];
  const valid = await bcrypt.compare(String(senha), user.senhaHash);
  if (!valid) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const token = jwt.sign(
    { sub: String(user.id), nome: user.nome, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"] }
  );

  return c.json({ token, nome: user.nome, role: user.role });
});

/**
 * Requisito 3 — "qual o papel desse usuario?".
 *
 * E o endpoint que o catalogo chama toda vez que precisa de uma decisao de
 * autorizacao. Ele NAO existe publicamente: so e alcancavel de dentro da rede
 * do Docker, pelo nome do servico. O catalogo manda o token do usuario e recebe
 * o perfil; ele nao decodifica nem assina nada.
 */
auth.get("/me", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Token ausente" }, 401);
  }

  let payload: { sub?: string };
  try {
    payload = jwt.verify(header.slice(7), config.jwt.secret) as { sub?: string };
  } catch {
    return c.json({ error: "Token inválido ou expirado" }, 401);
  }

  const usuarioId = Number(payload.sub);
  if (!Number.isInteger(usuarioId)) {
    return c.json({ error: "Token inválido" }, 401);
  }

  // O papel e lido do banco, e nao do token: se o admin rebaixar um usuario,
  // a mudanca vale na proxima requisicao, sem esperar o token expirar.
  const rows = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Token inválido" }, 401);
  }

  const { id, nome, email, role } = rows[0];

  return c.json({ usuarioId: id, nome, email, role });
});

export default auth;
