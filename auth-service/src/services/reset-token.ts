import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { resetTokens } from "../db/schema";
import { config } from "../config";

/**
 * Requisito 4 — emissao e validacao dos tokens de recuperacao de senha.
 *
 * O link de redefinicao so funciona se as tres condicoes Holds:
 *   1. o token existe no banco?
 *   2. ainda nao passou de expira_em?
 *   3. ainda nao foi usado?
 * Qualquer uma falhando, a troca e recusada e o usuario precisa pedir um link novo.
 */

/** 32 bytes aleatorios em hexadecimal = 64 caracteres (exigencia: 32+ bytes). */
export function gerarToken(): string {
  return randomBytes(32).toString("hex");
}

export type TokenEmitido = {
  token: string;
  criadoEm: Date;
  expiraEm: Date;
};

/**
 * Gera um link novo para o usuario.
 *
 * Detalhe de seguranca: os tokens pendentes anteriores sao apagados, de forma
 * que pedir um link novo invalida o link antigo (caso contrario, um e-mail
 * antigo ainda valeria).
 *
 * `criado_em` e `expira_em` sao calculados pelo BANCO (NOW() / DATE_ADD), e nao
 * pelo Node: assim o prazo de 30 minutos nao depende do relogio do container.
 */
export async function emitirToken(usuarioId: number): Promise<TokenEmitido> {
  await db
    .delete(resetTokens)
    .where(and(eq(resetTokens.usuarioId, usuarioId), eq(resetTokens.usado, false)));

  const token = gerarToken();

  await db.insert(resetTokens).values({
    token,
    usuarioId,
    criadoEm: sql`NOW()`,
    expiraEm: sql`DATE_ADD(NOW(), INTERVAL ${config.reset.ttlMinutos} MINUTE)`,
    usado: false,
  });

  const [registro] = await db
    .select({ criadoEm: resetTokens.criadoEm, expiraEm: resetTokens.expiraEm })
    .from(resetTokens)
    .where(eq(resetTokens.token, token))
    .limit(1);

  return { token, criadoEm: registro!.criadoEm, expiraEm: registro!.expiraEm };
}

export type MotivoRecusa = "inexistente" | "usado" | "expirado";

export type Validacao =
  | { ok: true; registro: { id: number; usuarioId: number; expiraEm: Date } }
  | { ok: false; motivo: MotivoRecusa };

/**
 * As tres checagens do requisito 6, na ordem em que faz sentido explicar:
 * token inexistente -> link adulterado/ja removido; token usado -> link ja
 * foi clicado uma vez; token expirado -> passou dos 30 minutos.
 *
 * A comparacao de tempo usa NOW() do proprio banco, evitando divergencia de
 * relogio entre o container e o MariaDB.
 */
export async function validarToken(token: string): Promise<Validacao> {
  const [linha] = await db
    .select({
      id: resetTokens.id,
      usuarioId: resetTokens.usuarioId,
      usado: resetTokens.usado,
      expiraEm: resetTokens.expiraEm,
      expirado: sql<number>`(NOW() > ${resetTokens.expiraEm})`,
    })
    .from(resetTokens)
    .where(eq(resetTokens.token, token))
    .limit(1);

  if (!linha) return { ok: false, motivo: "inexistente" };
  if (linha.usado) return { ok: false, motivo: "usado" };
  if (linha.expirado) return { ok: false, motivo: "expirado" };

  return {
    ok: true,
    registro: { id: linha.id, usuarioId: linha.usuarioId, expiraEm: linha.expiraEm },
  };
}

/**
 * Reserva o token para esta troca de senha.
 *
 * O UPDATE e condicional (`AND usado = 0`): se duas requisicoes chegarem no
 * mesmo instante com o mesmo link, apenas uma afeta 1 linha e a outra e
 * recusada. Isso fecha a corrida entre dois cliques simultaneos no link.
 */
export async function reservarToken(id: number): Promise<boolean> {
  const resultado = await db
    .update(resetTokens)
    .set({ usado: true })
    .where(and(eq(resetTokens.id, id), eq(resetTokens.usado, false)));

  const affectedRows = Array.isArray(resultado)
    ? Number(resultado[0]?.affectedRows ?? 0)
    : Number((resultado as unknown as { affectedRows?: number }).affectedRows ?? 0);

  return affectedRows === 1;
}
