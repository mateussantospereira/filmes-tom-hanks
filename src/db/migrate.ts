/**
 * Aplicacao das migrations do CATALOGO (atividades 6 e 7).
 *
 * Mesmo padrao do auth-service/src/migrate.ts: um script que roda FORA do
 * container — basta uma maquina que fale com o MariaDB e tenha as variaveis
 * de ambiente DB_* (ver drizzle.config.ts). O catálogo usa o mesmo banco:
 *
 *   bun run db:migrate                       # ambiente local
 *   bun --env-file=.env.portainer run db:migrate   # contra o banco de producao
 *
 * Idempotente: os .sql sao `CREATE TABLE IF NOT EXISTS`, e o script confere o
 * schema antes e depois. NAO e um `db:push`: so cria estas tabelas novas, nao
 * altera nada que ja existe.
 */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import mysql from "mysql2/promise";

const ARQUIVOS_SQL = ["atividade-6.sql", "atividade-7.sql"].map((nome) =>
  join(import.meta.dir, "..", "..", "sql", nome)
);

/** Tabelas que estas migrations criam (o script confere todas antes de rodar). */
const TABELAS = ["perfis", "assinaturas"];

function resumo(comando: string): string {
  const linha = comando.split("\n")[0].replace(/\s+/g, " ").trim();
  return linha.length > 62 ? `${linha.slice(0, 62)}...` : linha;
}

function mensagemReal(erro: unknown): string {
  const e = erro as {
    message?: string;
    sqlMessage?: string;
    code?: string;
    cause?: { message?: string; sqlMessage?: string; code?: string };
  };
  const causa = e.cause;
  return causa?.sqlMessage ?? causa?.message ?? e.sqlMessage ?? e.message ?? String(erro);
}

async function main(): Promise<number> {
  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log(
    `[migrate-catalogo] alvo: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  );

  const marcadores = TABELAS.map(() => "?").join(", ");
  const [linhas] = await conexao.query<mysql.RowDataPacket[]>(
    `SELECT table_name AS nome FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN (${marcadores})`,
    TABELAS
  );

  const existentes = new Set(linhas.map((l) => String(l.nome)));
  const faltando = TABELAS.filter((t) => !existentes.has(t));

  if (faltando.length === 0) {
    console.log(`[migrate-catalogo] tabelas ${TABELAS.join(", ")} ja existem — nada a fazer.`);
    await conexao.end();
    return 0;
  }

  console.log(`[migrate-catalogo] faltando: ${faltando.join(", ")}\n`);

  try {
    for (const arquivo of ARQUIVOS_SQL) {
      const texto = await readFile(arquivo, "utf8");
      const comandos = texto
        .split("\n")
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);

      console.log(`[migrate-catalogo] ${comandos.length} comando(s) em ${basename(arquivo)}\n`);
      for (const comando of comandos) {
        await conexao.query(comando);
        console.log(`  [aplicado]  ${resumo(comando)}`);
      }
    }
  } finally {
    await conexao.end();
  }

  console.log("\n[migrate-catalogo] pronto — tabelas `perfis` e `assinaturas` criadas.");
  console.log("[migrate-catalogo] a foto vai para o MinIO e os IDs do Stripe ficam em `assinaturas`;");
  console.log("[migrate-catalogo] o direito `usuarios.premium` e do auth-service (rode o migrate dele).");
  return 0;
}

let codigoSaida = 1;
try {
  codigoSaida = await main();
} catch (erro) {
  console.error(`\n[migrate-catalogo] ERRO: ${mensagemReal(erro)}`);
  console.error("[migrate-catalogo] Nada foi alterado no banco.");
}
process.exit(codigoSaida);
