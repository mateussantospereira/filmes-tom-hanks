import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Conference de schema na partida do servico.
 *
 * O auth-service e dono de `usuarios` (coluna `role`) e de `reset_tokens`. Se o
 * banco ainda for o da atividade 2, essas duas coisas nao existem — e sem elas o
 * servico sobe "de pe" e so quebra depois, com um erro 500 dificil de
 * entender. Aqui a gente descobre no boot e diz exatamente o que fazer.
 */

export type Pendencia = {
  temColunaRole: boolean;
  temTabelaResetTokens: boolean;
  /** Atividade 7 — o direito `premium` em `usuarios`. */
  temColunaPremium: boolean;
};

/**
 * Le a coluna `total` de um `SELECT COUNT(*)` executado com `db.execute`.
 *
 * O driver mysql2 devolve o par do proprio mysql2, `[linhas, campos]`, e o tipo
 * que o drizzle declara (`ResultSetHeader`) nao descreve esse formato — por isso
 * a leitura e explicita.
 */
function totalDaPrimeiraLinha(resultado: unknown): number {
  const linhas = (resultado as [unknown[], unknown[]])[0];
  const linha = linhas?.[0] as { total?: number } | undefined;
  return Number(linha?.total ?? 0);
}

export async function verificarSchema(): Promise<Pendencia> {
  const colunaRole = await db.execute(
    sql`SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'usuarios'
           AND COLUMN_NAME = 'role'`
  );

  const tabelaResetTokens = await db.execute(
    sql`SELECT COUNT(*) AS total
          FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'reset_tokens'`
  );

  const colunaPremium = await db.execute(
    sql`SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'usuarios'
           AND COLUMN_NAME = 'premium'`
  );

  return {
    temColunaRole: totalDaPrimeiraLinha(colunaRole) > 0,
    temTabelaResetTokens: totalDaPrimeiraLinha(tabelaResetTokens) > 0,
    temColunaPremium: totalDaPrimeiraLinha(colunaPremium) > 0,
  };
}

export function schemaEstaCompleto(p: Pendencia): boolean {
  return p.temColunaRole && p.temTabelaResetTokens && p.temColunaPremium;
}

export function avisoSchemaPendente(p: Pendencia): string {
  const faltando: string[] = [];
  if (!p.temColunaRole) faltando.push("coluna `role` na tabela `usuarios`");
  if (!p.temTabelaResetTokens) faltando.push("tabela `reset_tokens`");
  if (!p.temColunaPremium) faltando.push("coluna `premium` na tabela `usuarios`");

  return (
    "\n" +
    "=============================================================================\n" +
    "[auth-service] SCHEMA PENDENTE no banco: falta " +
    faltando.join(", ") +
    ".\n" +
    "\n" +
    "Aplique as migrations do servico (atividades 3 e 7):\n" +
    "\n" +
    "    bun run db:migrate\n" +
    "\n" +
    "Elas criam `reset_tokens`, a coluna `role` e a coluna `premium` em\n" +
    "`usuarios`, sem alterar os dados que ja existem. Enquanto isso nao for\n" +
    "feito, cadastro, login, recuperacao de senha e o plano Premium vao falhar\n" +
    "com erro 500.\n" +
    "=============================================================================\n"
  );
}
