import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { usuarios } from "../db/schema";
import { exigePermissao, autenticado } from "../middleware/autorizar";
import { registrar, ipDe } from "../services/log-service";
import type { Papel } from "../auth/permissoes";

/**
 * Administracao de usuarios — a AÇÃO EXCLUSIVA DE ADMIN da atividade 4.
 *
 * Por que estas rotas moram AQUI e nao no catalogo: a tabela `usuarios` e do
 * auth-service (decisao da atividade 3, "um banco, dois donos"). Quem e o dono
 * do recurso e quem aplica a regra sobre ele. O catalogo so publica a porta de
 * entrada, porque e o unico container com `ports:`.
 *
 * O enforcement e feito duas vezes, de proposito:
 *
 *   1. no catalogo  — recusa antes de gastar a rede (403 rapido)
 *   2. aqui         — o dono do recurso recusa de novo, mesmo que alguem
 *                     alcance este servico direto por dentro da rede
 *
 * Chamam-se os dois porque uma regra que so existe na borda de um servico nao
 * e regra: e sorte. Se amanha algum container novo entrar na rede `interna`,
 * ele continuaria encontrando o dono recusando.
 */
const usuariosRota = new Hono();

/**
 * GET /usuarios — lista todos os usuarios e o papel de cada um.
 *
 * EXCLUSIVO de admin (`listar:usuarios`).
 *
 * `senha_hash` NUNCA sai daqui: o hash e um segredo derivado, devolve-lo e
 * entregar a chance de quebrar a senha offline.
 */
usuariosRota.get("/usuarios", exigePermissao("listar:usuarios"), async (c) => {
  const lista = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .orderBy(desc(usuarios.id));

  return c.json({ usuarios: lista, total: lista.length });
});

/**
 * PATCH /usuarios/:id/role — promove ou rebaixa.
 *
 * EXCLUSIVO de admin (`alterar:papel`). Corpo: `{ "role": "admin" | "usuario" }`.
 *
 * Duas guardas alem da permissao, e as duas existem por um motivo claro:
 *
 *   - papel invalido -> 400. Um `role` livre sairia direto para o banco e
 *     criaria um papel que nenhum mapa de permissoes conhece.
 *   - rebaixar a si mesmo -> 400. E o jeito mais curto de deixar o sistema sem
 *     nenhum admin: voce promove o colega e depois se rebaixa, e ninguem
 *     consegue mais promover ninguem. O caminho e outro admin rebaixar voce.
 */
usuariosRota.patch("/usuarios/:id/role", exigePermissao("alterar:papel"), async (c) => {
  const alvoId = Number(c.req.param("id"));
  const chamadorId = c.get("usuarioId");

  if (!Number.isInteger(alvoId)) {
    return c.json({ error: "Usuário inválido" }, 400);
  }

  const { role } = (await c.req.json().catch(() => ({}))) as { role?: unknown };

  if (role !== "usuario" && role !== "admin") {
    return c.json(
      { error: 'Papel inválido. Use "usuario" ou "admin".', papel_recebido: role ?? null },
      400
    );
  }

  if (alvoId === chamadorId) {
    return c.json(
      { error: "Você não pode alterar o próprio papel. Peça a outro admin." },
      400
    );
  }

  const [alvo] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.id, alvoId))
    .limit(1);

  if (!alvo) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const papelAntigo = alvo.role;
  await db.update(usuarios).set({ role: role as Papel }).where(eq(usuarios.id, alvoId));

  await registrar({
    acao: "alterar_papel",
    usuario_id: chamadorId,
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `usuario:${alvoId}`,
    detalhe: `${papelAntigo} -> ${role}`,
    ip: ipDe(c),
  });

  return c.json({
    message: `Papel de ${alvo.nome} alterado de "${papelAntigo}" para "${role}".`,
    usuario: { id: alvo.id, nome: alvo.nome, role },
    alterado_de: papelAntigo,
  });
});

/**
 * GET /usuarios/:id/perfil-publico — quem e a pessoa por tras do perfil.
 *
 * Atividade 6: a pagina de perfil mostra o NOME de outros usuarios. Como a
 * tabela `usuarios` e do auth-service, e aqui que o nome mora — o catalogo
 * pede por HTTP (mesmo padrao do GET /me), com o token de quem esta logado.
 *
 * So autentica (`autenticado`), sem permissao: ver nome de usuario numa rede
 * social e leitura comum. NUCA devolve e-mail ou senha — so identidade.
 */
usuariosRota.get("/usuarios/:id/perfil-publico", autenticado, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) {
    return c.json({ error: "Usuário inválido" }, 400);
  }

  const [alvo] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1);

  if (!alvo) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  return c.json(alvo);
});

export default usuariosRota;
