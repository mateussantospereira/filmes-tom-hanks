/**
 * ISW055 · Atividade 7 — consulta pronta para o print do banco.
 *
 * Mostra, em tabela alinhada, o direito (`usuarios.premium`) e a referencia da
 * assinatura (`assinaturas.stripe_customer_id` / `stripe_subscription_id`).
 * Nenhum dado de cartao existe aqui — so os IDs que o Stripe devolve.
 *
 * Uso (a partir da raiz do repositorio):
 *   bun --env-file=.env.portainer run scripts/mostrar-premium.ts
 *   bun --env-file=.env.portainer run scripts/mostrar-premium.ts voce@exemplo.com
 *
 * O argumento opcional filtra por e-mail. Sem argumento, lista os 10 usuarios
 * mais recentes e todas as assinaturas.
 */
import mysql from "mysql2/promise";

const filtro = process.argv[2]?.trim() || null;

const conexao = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function tabela(titulo: string, colunas: string[], linhas: string[][]) {
  const larguras = colunas.map((c, i) =>
    Math.max(c.length, ...linhas.map((l) => (l[i] ?? "").length))
  );
  const linha = (valores: string[]) =>
    valores.map((v, i) => v.padEnd(larguras[i])).join(" | ");

  console.log(`\n${titulo}`);
  console.log(colunas.map((c, i) => c.padEnd(larguras[i])).join(" | "));
  console.log(larguras.map((l) => "-".repeat(l)).join("-+-"));
  for (const l of linhas) console.log(linha(l));
  if (linhas.length === 0) console.log("(nenhum registro)");
}

const where = filtro ? "WHERE email = ?" : "";
const params = filtro ? [filtro] : [];

const [usuarios] = await conexao.query<mysql.RowDataPacket[]>(
  `SELECT id, nome, email, role, premium
     FROM usuarios ${where}
    ORDER BY id DESC
    LIMIT 10`,
  params
);

tabela(
  `usuarios${filtro ? ` (${filtro})` : " (10 mais recentes)"}`,
  ["id", "nome", "email", "role", "premium"],
  usuarios.map((u) => [
    String(u.id),
    String(u.nome),
    String(u.email),
    String(u.role),
    u.premium ? "TRUE" : "false",
  ])
);

const [assinaturas] = await conexao.query<mysql.RowDataPacket[]>(
  `SELECT a.usuario_id, u.email, a.stripe_customer_id,
          a.stripe_subscription_id, a.status, a.atualizado_em
     FROM assinaturas a
     JOIN usuarios u ON u.id = a.usuario_id
    ${filtro ? "WHERE u.email = ?" : ""}
    ORDER BY a.usuario_id DESC`,
  params
);

tabela(
  "assinaturas (somente IDs do Stripe — nenhum dado de cartão)",
  ["usuario_id", "email", "stripe_customer_id", "stripe_subscription_id", "status", "atualizado_em"],
  assinaturas.map((a) => [
    String(a.usuario_id),
    String(a.email),
    String(a.stripe_customer_id ?? "—"),
    String(a.stripe_subscription_id ?? "—"),
    String(a.status),
    String(a.atualizado_em ?? "—"),
  ])
);

console.log(
  "\npremium = TRUE  -> favoritos ilimitados\n" +
    "status ativa    -> assinatura confirmada pelo webhook do Stripe (modo de teste)\n"
);

await conexao.end();
