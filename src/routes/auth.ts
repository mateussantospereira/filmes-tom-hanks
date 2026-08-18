import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { usuarios } from "../db/schema";
import { eq } from "drizzle-orm";

const auth = new Hono();

auth.post("/register", async (c) => {
  const { nome, email, senha } = await c.req.json();

  if (!nome || !email || !senha) {
    return c.json({ error: "Nome, email e senha são obrigatórios" }, 400);
  }

  const existing = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email já cadastrado" }, 409);
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const result = await db
    .insert(usuarios)
    .values({ nome, email, senhaHash });

  return c.json({ message: "Conta criada com sucesso" }, 201);
});

auth.post("/login", async (c) => {
  const { email, senha } = await c.req.json();

  if (!email || !senha) {
    return c.json({ error: "Email e senha são obrigatórios" }, 400);
  }

  const rows = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const user = rows[0];
  const valid = await bcrypt.compare(senha, user.senhaHash);
  if (!valid) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const token = jwt.sign(
    { usuarioId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: "24h" }
  );

  return c.json({ token, nome: user.nome });
});

export default auth;
