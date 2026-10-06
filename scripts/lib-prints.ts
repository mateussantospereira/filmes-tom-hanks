/**
 * ISW055 · Impressão de telas via chromium headless + CDP (compartilhado).
 *
 * Abre um chromium com debugging remoto, conecta numa aba por WebSocket e
 * expõe `cdp`/`evalExpr` para o script chamador. `capturarTela` mede o
 * conteúdo e tira a foto na resolução exata (2x, nítida).
 */

export interface AbaCdp {
  cdp(method: string, params?: Record<string, unknown>): Promise<any>;
  evalExpr(expression: string): Promise<any>;
  fechar(): void;
}

export async function iniciarChromium(opts: { porta?: number; perfil?: string } = {}): Promise<{
  porta: number;
  chrome: import("bun").BunSubprocess | null;
}> {
  const porta = opts.porta ?? 9400 + Math.floor(Math.random() * 400);
  const perfil = opts.perfil ?? `/tmp/opencode/chrome-profile-prints-${Date.now()}`;
  const chrome = Bun.spawn(
    [
      "/usr/bin/chromium",
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${porta}`,
      `--user-data-dir=${perfil}`,
      "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );

  // espera o /json/version responder (chromium sobe em ~1s)
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (r.ok) break;
    } catch {}
    await Bun.sleep(200);
  }
  return { porta, chrome };
}

export async function abrirAba(porta: number, url: string): Promise<AbaCdp> {
  const r = await fetch(`http://127.0.0.1:${porta}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const aba = await r.json();
  const ws = new WebSocket(aba.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let seq = 0;
  const pendentes = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string);
    if (msg.id && pendentes.has(msg.id)) {
      pendentes.get(msg.id)(msg);
      pendentes.delete(msg.id);
    }
  };

  const cdp = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((res) => {
      const id = ++seq;
      pendentes.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evalExpr = async (expression: string): Promise<any> => {
    const rr = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (rr.result?.exceptionDetails) {
      throw new Error(`eval falhou: ${JSON.stringify(rr.result.exceptionDetails).slice(0, 300)}`);
    }
    return rr.result?.result?.value;
  };

  return {
    cdp,
    evalExpr,
    fechar: () => ws.close(),
  };
}

/** Tira a foto na resolução exata passada (deviceScaleFactor 2 = nítida). */
export async function capturarTela(
  aba: AbaCdp,
  destino: string,
  opts: { largura?: number; altura?: number; scale?: number } = {},
): Promise<{ largura: number; altura: number }> {
  const { largura = 1280, altura = 900, scale = 2 } = opts;
  await aba.cdp("Emulation.setDeviceMetricsOverride", {
    width: largura,
    height: altura,
    deviceScaleFactor: scale,
    mobile: false,
  });
  await Bun.sleep(300);
  const shot = await aba.cdp("Page.captureScreenshot", { format: "png" });
  await Bun.write(destino, Buffer.from(shot.result.data, "base64"));
  return { largura, altura };
}

/**
 * Renderiza um arquivo HTML local e tira a foto na resolução exata do
 * conteúdo (mede scrollWidth/scrollHeight — nada de janela que corta).
 */
export async function capturarHtml(html: string, destino: string, margemLateral = 0): Promise<{ largura: number; altura: number }> {
  const arquivo = `/tmp/opencode/print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`;
  await Bun.write(arquivo, html);

  const { porta } = await iniciarChromium();
  const aba = await abrirAba(porta, `file://${arquivo}`);
  try {
    await Bun.sleep(500);
    const medida = await aba.evalExpr(
      `({ w: Math.ceil(document.documentElement.scrollWidth), h: Math.ceil(document.documentElement.scrollHeight) })`,
    );
    const largura = Math.max(medida.w, 200);
    const altura = Math.max(medida.h + 2, 200);
    await aba.cdp("Emulation.setDeviceMetricsOverride", {
      width: largura + margemLateral * 2,
      height: altura,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await Bun.sleep(250);
    const shot = await aba.cdp("Page.captureScreenshot", { format: "png" });
    await Bun.write(destino, Buffer.from(shot.result.data, "base64"));
    return { largura, altura };
  } finally {
    aba.fechar();
  }
}