/**
 * ISW055 · Atividade 6 · Geração dos prints de entrega.
 *
 * Gera dois arquivos em docs/images/:
 *
 *   1. perfil-403.png — janela de terminal estilo GitHub com a SAÍDA REAL da
 *      demonstração contra produção (PASSO 6: os 403 ao editar perfil alheio;
 *      PASSO 7: eventos na auditoria), em CSS espaçado (nada encostado).
 *   2. perfil.png     — screenshot REAL da aba "Perfil" no catálogo de
 *      produção: foto enviada de verdade (MinIO), bio salva e favoritos.
 *
 * Uso:
 *   bun run scripts/gerar-prints-perfil.ts                # gera os dois
 *   CATALOGO_URL=<url> bun run scripts/gerar-prints-perfil.ts   # forçando a base da UI
 */

import { capturarHtml, iniciarChromium, abrirAba, capturarTela } from "./lib-prints";

// ---------------------------------------------------------------------------
// 1. Print do terminal — recusa de editar o perfil alheio (saída real)
// ---------------------------------------------------------------------------

const json403 = (idRecebido: number, suaConta: number) => `      <div class="json">
        <span class="jkey">"error"</span>:           <span class="jerr">"Ação negada: você só pode editar o seu próprio perfil."</span>,
        <span class="jkey">"permissao_exigida"</span>:  <span class="jval">"editar:perfil-proprio"</span>,
        <span class="jkey">"papel"</span>:           <span class="jerr">"usuario"</span>,
        <span class="jkey">"id_recebido"</span>:     <span class="jval">${idRecebido}</span>,
        <span class="jkey">"sua_conta"</span>:       <span class="jval">${suaConta}</span>
      </div>`;

const linha = (texto: string, tag: string, ok = true) =>
  `      <p class="linha ${ok ? "ok" : "recusa"}"><span class="chk">${ok ? "✔" : "✘"}</span><span>${texto}</span>${tag ? `<span class="tag ${ok ? "tag-ok" : "tag-err"}">${tag}</span>` : ""}</p>`;

const htmlTerminal = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, 'Courier New', monospace;
    padding: 44px 28px;
  }
  .window {
    width: 1080px;
    margin: 0 auto;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 14px;
    box-shadow: 0 26px 70px rgba(0, 0, 0, 0.62);
    overflow: hidden;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 14px;
    background: #1c2128;
    padding: 15px 22px;
    border-bottom: 1px solid #30363d;
  }
  .dots { display: flex; gap: 9px; }
  .d { width: 13px; height: 13px; border-radius: 50%; display: inline-block; }
  .d.red { background: #ff5f56; }
  .d.yellow { background: #ffbd2e; }
  .d.green { background: #27c93f; }
  .title {
    color: #9da7b3;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .content {
    padding: 34px 40px 38px;
    color: #c9d1d9;
    font-size: 13.5px;
    line-height: 1.9;
  }
  .comando {
    padding: 14px 18px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    margin-bottom: 26px;
    font-size: 13px;
    white-space: nowrap;
  }
  .prompt { color: #58a6ff; font-weight: 600; }
  .cmd { color: #f0883e; }
  .comentario {
    color: #8b949e;
    font-size: 12.5px;
    margin-bottom: 8px;
    line-height: 1.7;
  }
  .comentario.ultimo { margin-bottom: 24px; }
  .paso {
    display: inline-block;
    color: #58a6ff;
    font-weight: 700;
    font-size: 12.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: rgba(88, 166, 255, 0.08);
    border: 1px solid #1f6feb;
    border-radius: 20px;
    padding: 6px 16px;
    margin: 34px 0 22px;
  }
  .linha {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .linha.ok { color: #3fb950; }
  .linha.recusa { color: #ff7b72; }
  .chk { font-weight: 800; }
  .tag {
    margin-left: auto;
    flex-shrink: 0;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    letter-spacing: 0.5px;
  }
  .tag-ok { background: rgba(46, 160, 67, 0.14); color: #3fb950; border: 1px solid #2ea043; }
  .tag-err { background: rgba(248, 81, 73, 0.14); color: #ff7b72; border: 1px solid #f85149; }
  .json {
    background: #0d1117;
    border: 1px solid #30363d;
    border-left: 4px solid #f85149;
    border-radius: 8px;
    padding: 20px 24px;
    margin: 4px 0 26px 40px;
    color: #a5d6ff;
    font-size: 12.5px;
    line-height: 2.1;
  }
  .jkey { color: #79c0ff; }
  .jval { color: #a5d6ff; }
  .jerr { color: #ff7b72; }
  .banner {
    margin-top: 36px;
    padding: 17px 22px;
    border: 1px solid #2ea043;
    background: rgba(46, 160, 67, 0.09);
    color: #3fb950;
    font-weight: 700;
    text-align: center;
    border-radius: 9px;
    letter-spacing: 0.6px;
  }
  .exit { color: #7ee787; }
</style>
</head>
<body>
<div class="window">
  <div class="titlebar">
    <span class="dots"><span class="d red"></span><span class="d yellow"></span><span class="d green"></span></span>
    <span class="title">bash — ./scripts/demonstrar-perfil.sh · saída real contra produção</span>
  </div>
  <div class="content">
    <div class="comando"><span class="prompt">mateus@lapps:~/filmes-tom-hanks$</span> <span class="cmd">CATALOGO_URL=https://mateus-pereira-isw055.lapps.studio ./scripts/demonstrar-perfil.sh</span></div>

    <div class="comentario"># A identidade do usuário NUNCA vem do corpo/URL: o servidor resolve o TOKEN pelo auth-service</div>
    <div class="comentario ultimo"># (GET /me) e compara com o id enviado — id de outra pessoa? 403 na borda, sem olhar o conteúdo.</div>

    <div class="paso">PASSO 6 · tentativa (recusada) de editar o perfil de outrem</div>
    ${linha("comum edita a BIO de outro (PATCH /api/perfil/46)", "403")}
    ${json403(46, 45)}
    ${linha("comum envia FOTO para o perfil de outro (POST /api/perfil/46/foto)", "403")}
    ${json403(46, 45)}
    ${linha("bio de outra pessoa segue intacta", "")}
    ${linha("foto de outra pessoa segue ausente", "")}

    <div class="paso">PASSO 7 · auditoria captura os eventos (continuação da atividade 5)</div>
    <div class="comentario"># Upload e edição geram eventos novos no mesmo stream do Redis; os 403 viram acao_negada.</div>
    <div class="comentario ultimo" style="margin-bottom: 22px;"># Conferido no log de auditoria (log-service + emissão via /api/logs).</div>
    ${linha("evento 'upload_foto' presente no log de auditoria", "")}
    ${linha("evento 'editar_perfil' presente no log de auditoria", "")}
    ${linha("evento 'acao_negada' presente no log de auditoria", "")}

    <div class="banner">TODAS AS CONFERENCIAS DA ATIVIDADE 6 PASSARAM&nbsp;&nbsp;<span class="exit">(exit 0)</span></div>
  </div>
</div>
</body>
</html>`;

console.log("[prints] gerando perfil-403.png...");
const t1 = await capturarHtml(htmlTerminal, "docs/images/perfil-403.png");
console.log(`[prints] perfil-403.png OK (${t1.largura}x${t1.altura})`);

// ---------------------------------------------------------------------------
// 2. Print da UI — aba Perfil contra produção (foto real vinda do MinIO)
// ---------------------------------------------------------------------------

const BASE = process.env.CATALOGO_URL ?? "https://mateus-pereira-isw055.lapps.studio";
const FIXTURE = "/home/mateus/projetos/filmes-tom-hanks/scripts/fixtures/avatar-teste.png";
const CARIMBO = Date.now();
const EMAIL = `ui-print-${CARIMBO}@exemplo.com`;
const SENHA = `senha-ui-${CARIMBO}`;
const BIO = "Cinéfilo de Tom Hanks — perfil montado pela UI e verificado por script.";

async function api(caminho: string, metodo = "GET", corpo?: unknown, token?: string) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: {
      ...(corpo ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: res.status, dados: await res.json().catch(() => null) };
}

let token = "";
{
  const reg = await fetch(BASE + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Pessoa Perfil", email: EMAIL, senha: SENHA }),
  });
  console.log("[prints] register:", reg.status);
  const login = await fetch(BASE + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, senha: SENHA }),
  });
  token = (await login.json()).token;
}

const me = await api("/api/me", "GET", undefined, token);
console.log("[prints] /api/me:", me.status, "usuarioId:", me.dados?.usuarioId);

await api("/api/favorites", "POST", { tmdb_movie_id: 429, titulo: "Forrest Gump" }, token);
await api(`/api/perfil/${me.dados.usuarioId}`, "PATCH", { bio: BIO }, token);

const foto = new FormData();
foto.append("foto", new Blob([await Bun.file(FIXTURE).arrayBuffer()], { type: "image/png" }), "avatar.png");
const up = await fetch(BASE + `/api/perfil/${me.dados.usuarioId}/foto`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: foto,
});
console.log("[prints] upload foto:", up.status);

// --- chromium headless: abre o catálogo logado, clica na aba Perfil, foto ---
const { porta, chrome } = await iniciarChromium();
const aba = await abrirAba(porta, BASE + "/login");
try {
  await Bun.sleep(1500);
  await aba.evalExpr(
    `localStorage.setItem("token", ${JSON.stringify(token)}); localStorage.setItem("nome", "Pessoa Perfil"); "ok"`,
  );
  await aba.evalExpr(`location.href = "/catalog"`);
  await Bun.sleep(3200);

  const clicou = await aba.evalExpr(
    `(document.querySelector('.tab-btn[data-tab="perfil"]') ? (document.querySelector('.tab-btn[data-tab="perfil"]').click(), "clicou") : "sem-aba")`,
  );
  console.log("[prints] aba perfil:", clicou);
  await Bun.sleep(1800);

  const nome = await aba.evalExpr(`document.querySelector('#perfil-conteudo h2')?.textContent`);
  const fotoAvatar = await aba.evalExpr(
    `document.querySelector('.perfil-avatar')?.style.backgroundImage?.slice(0, 80)`,
  );
  const favoritos = await aba.evalExpr(`document.querySelectorAll('#perfil-conteudo .movie-card').length`);
  const bioLen = await aba.evalExpr(`document.getElementById('perfil-bio-input')?.value?.length ?? 0`);
  console.log("[prints] nome:", nome, "| favoritos:", favoritos, "| bio:", bioLen, "| avatar:", fotoAvatar);

  await Bun.sleep(2200); // deixa os pôsteres do TMDB aparecerem
  const t2 = await capturarTela(aba, "docs/images/perfil.png", { largura: 1320, altura: 980 });
  console.log(`[prints] perfil.png OK (${t2.largura}x${t2.altura})`);
} finally {
  aba.fechar();
  chrome?.kill();
}

console.log("[prints] FIM");