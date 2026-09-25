/**
 * Aplicacao da migration da atividade 3.
 *
 * Por que isto existe: a migration precisa rodar no MariaDB da aplicacao (o
 * mesmo banco da atividade 2), e nao dentro do container — o container so
 * enxerga o banco pela rede. Este script roda DE DENTRO do container do
 * auth-service, usando o mesmo `mysql2` e as mesmas variaveis de ambiente, e
 * por isso roda em qualquer maquina que fala com o banco, inclusive via
 * `docker compose run` ou pelo console do Portainer.
 *
 * O que ele faz, em uma frase: acrescenta a coluna `role` em `usuarios` e cria
 * a tabela `reset_tokens`. Nao apaga nem altera dado nenhum.
 *
 * Como usar:
 *   docker compose run --rm auth-service bun run db:migrate
 *   (ou, com o container ja no ar, pelo console do Portainer: bun run db:migrate)
 *
 * Rodar duas vezes nao faz estrago: o script confere o schema antes e depois,
 * e ignora "ja existia".
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { config } from "./config";
import { pool } from "./db";
import { schemaEstaCompleto, verificarSchema } from "./services/schema-check";

/** O mesmo arquivo .sql versionado no repositorio — fonte unica da verdade. */
const ARQUIVO_SQL = join(import.meta.dir, "..", "sql", "atividade-3.sql");

/**
 * Erros que significam "isso aqui ja estava no banco". Tolerados para que uma
 * aplicacao parcial (metade do script rodou antes) possa ser completada rodando
 * o script de novo.
 */
const JA_EXISTIA = new Set([
  "ER_DUP_FIELDNAME", // 1060 — a coluna `role` ja existe
  "ER_TABLE_EXISTS_ERROR", // 1050 — a tabela `reset_tokens` ja existe
  "ER_DUP_KEYNAME", // 1061 — o indice ja existe
]);

/**
 * Separa o .sql em comandos. Comentarios de linha inteira sao removidos antes
 * porque um `;` dentro de um comentario quebraria a conta dos comandos.
 */
function separaComandos(texto: string): string[] {
  return texto
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((comando) => comando.trim())
    .filter(Boolean);
}

/** Primeira linha do comando, encurtada, so para a saida do log. */
function resumo(comando: string): string {
  const linha = comando.split("\n")[0].replace(/\s+/g, " ").trim();
  return linha.length > 62 ? `${linha.slice(0, 62)}...` : linha;
}

/**
 * O driver do drizzle embrulha o erro do MySQL em um `DrizzleQueryError` com um
 * textão de SQL. O que interessa aqui e a causa original ("Access denied for
 * user ..."), que e ela que diz o que fazer.
 */
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

function codigoReal(erro: unknown): string {
  const e = erro as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code ?? "";
}

async function main(): Promise<number> {
  console.log(
    `[migrate] alvo: ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.name}`
  );

  const antes = await verificarSchema();
  if (schemaEstaCompleto(antes)) {
    console.log(
      "[migrate] schema ja atualizado: coluna `role` e tabela `reset_tokens` ja existem."
    );
    console.log("[migrate] nada a fazer.");
    return 0;
  }

  const conexao = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
  });

  try {
    const comandos = separaComandos(await readFile(ARQUIVO_SQL, "utf8"));
    console.log(`[migrate] ${comandos.length} comando(s) em sql/atividade-3.sql\n`);

    for (const comando of comandos) {
      try {
        await conexao.query(comando);
        console.log(`  [aplicado]  ${resumo(comando)}`);
      } catch (erro) {
        const codigo = codigoReal(erro);
        if (JA_EXISTIA.has(codigo)) {
          console.log(`  [ja existia] ${resumo(comando)}`);
          continue;
        }
        console.error(`\n  [FALHOU]     ${resumo(comando)}`);
        throw erro;
      }
    }
  } finally {
    await conexao.end();
  }

  const depois = await verificarSchema();
  if (!schemaEstaCompleto(depois)) {
    console.error("\n[migrate] a migration rodou, mas o schema ainda esta incompleto:");
    console.error(`[migrate]   temColunaRole=${depois.temColunaRole} temTabelaResetTokens=${depois.temTabelaResetTokens}`);
    return 1;
  }

  console.log("\n[migrate] pronto — coluna `role` em `usuarios` e tabela `reset_tokens` criadas.");
  console.log("[migrate] seus usuarios existentes continuam intactos (todos com role = 'usuario').");
  console.log("[migrate] para virar admin:  UPDATE `usuarios` SET `role`='admin' WHERE `email`='voce@exemplo.com';");
  return 0;
}

let codigoSaida = 1;
try {
  codigoSaida = await main();
} catch (erro) {
  const codigo = codigoReal(erro);
  console.error(`\n[migrate] ERRO${codigo ? ` (${codigo})` : ""}: ${mensagemReal(erro)}`);
  if (codigo === "ER_ACCESS_DENIED_ERROR") {
    console.error(
      "[migrate] As credenciais do banco recusaram a conexao. Confira DB_USER, " +
        "DB_PASSWORD e DB_HOST — e se esse usuario tem permissao de ALTER/CREATE."
    );
  }
  console.error("[migrate] Nada foi alterado no banco.");
} finally {
  await pool.end();
}

process.exit(codigoSaida);
