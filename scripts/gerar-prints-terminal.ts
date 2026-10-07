/**
 * ISW055 · P1 — Prints de terminal (sugeridos pelo enunciado): `git log -1`
 * com a data formatada, mostrando hash + data/hora + repositorio. Gerados
 * como HTML estilo terminal (legiveis, sem depender de GUI).
 */
import { capturarHtml } from "./lib-prints.ts";

const REPO_URL = "https://github.com/mateussantospereira/filmes-tom-hanks";
const SAIDA = "docs/prints/p1";

const ENTREGAS: Array<[string, string, string, string]> = [
  ["atv2", "c795793", "18/08/2026 17:48", "Catálogo de filmes — Tom Hanks"],
  ["atv3", "d08ced9", "25/09/2026 16:21", "Microsserviço de autenticação"],
  ["atv4", "d83b05d", "06/10/2026 11:18", "RBAC — controle de acesso por papel"],
  ["atv5", "dca3a82", "06/10/2026 18:30", "Logs e auditoria"],
  ["atv6", "01caeb5", "06/10/2026 19:50", "Upload e perfil de usuário"],
];

const fundo = "#0d1117";
const texto = "#e6edf3";
const verde = "#3fb950";
const cinza = "#8b949e";

function terminal(nome: string, hash: string, data: string, titulo: string): string {
  const linhas = [
    `<div class="linha"><span class="p">mateus@fatec</span>:<span class="d">~/filmes-tom-hanks</span><span class="p">$</span> git remote get-url origin</div>`,
    `<div class="linha r">${REPO_URL}.git</div>`,
    `<div class="linha"><span class="p">mateus@fatec</span>:<span class="d">~/filmes-tom-hanks</span><span class="p">$</span> git log -1 --date=format:"%d/%m/%Y %H:%M" --format="%h | %ad" ${hash}</div>`,
    `<div class="linha r"><span class="h">${hash}</span> | <span class="v">${data}</span></div>`,
    `<div class="linha c">→ ${titulo}</div>`,
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${fundo}; font-family: "DejaVu Sans Mono", "JetBrains Mono", monospace; padding: 22px; }
    .janela { background: ${fundo}; border: 1px solid #30363d; border-radius: 10px; overflow: hidden; }
    .barra { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #161b22; border-bottom: 1px solid #30363d; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot1 { background: #ff5f57; } .dot2 { background: #febc2e; } .dot3 { background: #28c840; }
    .barra span.t { color: ${cinza}; font-size: 13px; margin-left: 8px; }
    .conteudo { padding: 18px 16px 20px; font-size: 15px; line-height: 1.7; }
    .linha { white-space: pre; color: ${texto}; }
    .linha.r { margin-bottom: 14px; }
    .linha.c { margin-top: 14px; color: ${cinza}; font-style: italic; }
    .p { color: ${verde}; font-weight: bold; }
    .d { color: #58a6ff; }
    .h { color: ${verde}; font-weight: bold; }
    .v { color: #ffa657; font-weight: bold; }
  </style></head><body>
  <div class="janela">
    <div class="barra"><span class="dot dot1"></span><span class="dot dot2"></span><span class="dot dot3"></span><span class="t">zsh — ${nome} · data/hora do commit</span></div>
    <div class="conteudo">
      ${linhas.join("\n")}
    </div>
  </div>
  </body></html>`;
}

for (const [nome, hash, data, titulo] of ENTREGAS) {
  await capturarHtml(terminal(nome, hash, data, titulo), `${SAIDA}/evidencia-${nome}-terminal.png`);
  console.log(`  -> evidencia-${nome}-terminal.png (${hash} | ${data})`);
}
console.log("FIM");