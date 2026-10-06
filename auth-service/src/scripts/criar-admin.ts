/**
 * Cria o PRIMEIRO admin do sistema.
 *
 * Por que isto existe: toda rota que exige `listar:usuarios` ou `alterar:papel`
 * precisa de um admin chamando. E o admin nao pode se criar — se pudesse, o
 * primeiro `POST /usuarios` de qualquer visitante ja nasceria como admin. O
 * ovo e a galinha se resolve fora do HTTP, com um script roda no proprio
 * container, autenticado pelo acesso ao servidor.
 *
 * Depois deste passo, a administracao toda acontece pela API:
 *   PATCH /api/usuarios/:id/role  (um admin promovendo outro)
 *
 * Como rodar (console do Portainer, dentro do container do auth-service):
 *   bun run criar-admin email@exemplo.com
 *
 * Rodar de novo nao faz estrago: se o usuario ja for admin, avisa e sai.
 *
 * Este arquivo NAO e um endpoint e nao pode virar um: nao existe caminho HTTP
 * que alcance este codigo. Ele tambem nao recebe senha, so o e-mail — quem roda
 * ja tem acesso ao banco, entao pedir senha aqui seria teatro.
 */

import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { usuarios } from "../db/schema";
import { permissoesDe } from "../auth/permissoes";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Uso: bun run criar-admin <email-do-usuario>");
  console.error("Ex.: bun run criar-admin maria@exemplo.com");
  process.exit(1);
}

try {
  const [alvo] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  if (!alvo) {
    console.error(`\n  NENHUM USUARIO com e-mail "${email}".`);
    console.error(`  Cadastre pela tela do catalogo e rode o script de novo.\n`);
    process.exit(1);
  }

  if (alvo.role === "admin") {
    console.log(`\n  "${alvo.nome}" (<${alvo.email}>) JA e admin. Nada alterado.\n`);
    console.log(`  Permissoes: ${permissoesDe("admin").join(", ")}\n`);
    process.exit(0);
  }

  await db.update(usuarios).set({ role: "admin" }).where(eq(usuarios.id, alvo.id));

  console.log(`\n  OK  "${alvo.nome}" (<${alvo.email}>) promovido de "usuario" para "admin".`);
  console.log(`\n  Agora ele pode:`);
  for (const p of permissoesDe("admin")) console.log(`    - ${p}`);
  console.log(
    `\n  A partir daqui ele tambem promove outros pela API:\n` +
      `    PATCH /api/usuarios/${alvo.id}/role   {"role":"admin"}\n`
  );
} catch (erro) {
  console.error("\n  FALHOU:", erro instanceof Error ? erro.message : erro);
  console.error("  Confira se as variaveis DB_* apontam para o banco certo.\n");
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
