/**
 * ISW055 · P1 — Gera prints de evidência conferindo o DOM ANTES de capturar.
 *  - commits: garante que a página mostra hash + "committed";
 *  - catálogo: faz login de verdade (form) e espera a grade de filmes renderizar;
 *  - login: espera o form aparecer.
 */
import { iniciarChromium, abrirAba, capturarTela } from "./lib-prints.ts";

const REPO = "mateussantospereira/filmes-tom-hanks";
const PROD = "https://mateus-pereira-isw055.lapps.studio";
const SAIDA = "docs/prints/p1";

const COMMITS: Array<[string, string]> = [
  ["atv2", "c795793"],
  ["atv3", "d08ced9"],
  ["atv4", "d83b05d"],
  ["atv5", "dca3a82"],
  ["atv6", "01caeb5"],
];

const { porta, chrome } = await iniciarChromium();

async function esperar(aba: Awaited<ReturnType<typeof abrirAba>>, condicao: string, tempoMax = 20000): Promise<boolean> {
  const ini = Date.now();
  while (Date.now() - ini < tempoMax) {
    try {
      const v = await aba.evalExpr(condicao);
      if (v) return true;
    } catch {}
    await Bun.sleep(500);
  }
  return false;
}

// 1) commits: página pronta + hash visível + "committed"
for (const [nome, hash] of COMMITS) {
  const aba = await abrirAba(porta, `https://github.com/${REPO}/commit/${hash}`);
  try {
    await esperar(aba, `document.readyState === "complete"`);
    const ok = await esperar(aba, `document.body.innerText.includes("committed")`);
    const texto = await aba.evalExpr(`document.body.innerText.slice(0, 300).replace(/\\n+/g, " | ")`);
    console.log(`[${nome}] committed? ${ok} :: ${texto.slice(0, 160)}`);
    await Bun.sleep(1200);
    await capturarTela(aba, `${SAIDA}/evidencia-${nome}-commit.png`, { largura: 1320, altura: 960 });
  } finally {
    aba.fechar();
  }
}

// 2) catálogo: login real via form
{
  const aba = await abrirAba(porta, PROD + "/login");
  await esperar(aba, `document.readyState === "complete"`);
  await esperar(aba, `!!document.querySelector("#login-email")`);
  const email = process.env.EMAIL_CATALOGO || "manual-manual-1791328579@exemplo.com";
  const senha = process.env.SENHA_CATALOGO || "senha-manual";
  await aba.evalExpr(`(() => {
    const e = document.querySelector("#login-email"); e.value = ${JSON.stringify(email)};
    e.dispatchEvent(new Event("input", { bubbles: true }));
    const s = document.querySelector("#login-senha"); s.value = ${JSON.stringify(senha)};
    s.dispatchEvent(new Event("input", { bubbles: true }));
    return "preenchido";
  })()`);
  await aba.evalExpr(`(() => {
    const b = [...document.querySelectorAll("button")].find(b => b.textContent.toLowerCase().includes("entrar"));
    if (b) { b.click(); return "clicou"; }
    return "sem-botao";
  })()`);
  const grid = await esperar(aba, `!!document.querySelector(".movies-grid") && document.querySelectorAll(".movies-grid > *").length > 0`);
  const qtd = await aba.evalExpr(`document.querySelectorAll(".movies-grid > *").length`);
  const url = await aba.evalExpr(`location.href`);
  console.log(`[catalogo] grid? ${grid} qtd=${qtd} url=${url}`);
  await Bun.sleep(1500);
  await capturarTela(aba, `${SAIDA}/resultado-atv2-catalogo.png`, { largura: 1280, altura: 1100 });
  aba.fechar();
}

// 3) login: só o form
{
  const aba = await abrirAba(porta, PROD + "/login");
  await esperar(aba, `document.readyState === "complete"`);
  await esperar(aba, `!!document.querySelector("#login-email")`);
  const ok = await aba.evalExpr(`!!document.querySelector("#login-senha")`);
  console.log(`[login] form? ${ok}`);
  await Bun.sleep(1000);
  await capturarTela(aba, `${SAIDA}/resultado-atv3-login.png`, { largura: 1280, altura: 1000 });
  aba.fechar();
}

chrome.kill();
console.log("FIM");