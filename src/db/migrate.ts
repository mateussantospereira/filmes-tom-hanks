/**
 * Aplicacao da migration da atividade 6 (tabela `perfis`).
 *
 * Mesmo padrao do auth-service/src/migrate.ts: um script que roda FORA do
 * container — basta uma maquina que fale com o MariaDB e tenha as variaveis
 * de ambiente DB_* (ver drizzle.config.ts). O catálogo usa o mesmo banco:
 *
 *   bun run db:migrate                       # ambiente local
 *   bun --env-file=.env.portainer run db:migrate   # contra o banco de producao
 *
 * Idempotente: o .sql e `CREATE TABLE IF NOT EXISTS`, e o script confere o
 * schema antes e depois. NAO e um `db:push`: so cria esta tabela nova, nao
 * altera nada que ja existe.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";

const ARQUIVO_SQL = join(import.meta.dir, "..", "..", "sql", "atividade-6.sql");

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
    `[migrate-perfis] alvo: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  );

  const [tabelas] = await conexao.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'perfis'"
  );

  if (Number(tabelas[0]?.n ?? 0) > 0) {
    console.log("[migrate-perfis] tabela `perfis` ja existe — nada a fazer.");
    await conexao.end();
    return 0;
  }

  try {
    const texto = await readFile(ARQUIVO_SQL, "utf8");
    const comandos = texto
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);

    console.log(`[migrate-perfis] ${comandos.length} comando(s) em sql/atividade-6.sql\n`);
    for (const comando of comandos) {
      await conexao.query(comando);
      console.log(`  [aplicado]  ${resumo(comando)}`);
    }
  } finally {
    await conexao.end();
  }

  console.log("\n[migrate-perfis] pronto — tabela `perfis` criada (bio + foto_chave).");
  console.log("[migrate-perfis] a foto em si vai para o MinIO; aqui fica so a chave.");
  return 0;
}

let codigoSaida = 1;
try {
  codigoSaida = await main();
} catch (erro) {
  console.error(`\n[migrate-perfis] ERRO: ${mensagemReal(erro)}`);
  console.error("[migrate-perfis] Nada foi alterado no banco.");
}
process.exit(codigoSaida);