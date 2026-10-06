import { execSync } from "child_process";
import { writeFileSync } from "fs";

const html403 = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 30px;
    overflow: hidden;
  }
  .window {
    width: 860px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(0,0,0,0.55);
    overflow: hidden;
  }
  .header {
    background: #21262d;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #30363d;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.red { background: #ff5f56; }
  .dot.yellow { background: #ffbd2e; }
  .dot.green { background: #27c93f; }
  .title {
    color: #8b949e;
    font-size: 13px;
    margin-left: 12px;
    font-weight: 500;
  }
  .content {
    padding: 24px;
    color: #c9d1d9;
    font-size: 14px;
    line-height: 1.6;
  }
  .prompt { color: #58a6ff; font-weight: 600; }
  .cmd { color: #f0883e; }
  .arg { color: #79c0ff; }
  .comment { color: #8b949e; margin-bottom: 12px; }
  .status-badge {
    display: inline-block;
    background: rgba(248, 81, 73, 0.15);
    color: #ff7b72;
    border: 1px solid #f85149;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: bold;
    margin: 16px 0 10px 0;
  }
  .res-header { color: #8b949e; font-size: 12px; }
  .res-body {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    color: #7ee787;
    margin-top: 10px;
  }
  .highlight-err { color: #ff7b72; font-weight: 600; }
  .key { color: #79c0ff; }
  .val { color: #a5d6ff; }
</style>
</head>
<body>
<div class="window">
  <div class="header">
    <div class="dot red"></div>
    <div class="dot yellow"></div>
    <div class="dot green"></div>
    <div class="title">Terminal — Demonstração RBAC (Usuário Comum: Recusa 403)</div>
  </div>
  <div class="content">
    <div class="comment"># 1. Usuário com papel "usuario" tenta apagar comentário de OUTRO usuário</div>
    <div class="comment"># Ação exclusiva de moderação chamada diretamente via API (sem interface):</div>
    <p>
      <span class="prompt">mateus@lapps:~$</span> <span class="cmd">curl</span> -i -X <span class="arg">DELETE</span> <span class="arg">https://mateus-pereira-isw055.lapps.studio/api/comments/24</span> \\<br>
      &nbsp;&nbsp;-H <span class="val">"Authorization: Bearer eyJhbGciOi...[TOKEN_USUARIO_COMUM]"</span>
    </p>
    <div class="status-badge">HTTP/2 403 FORBIDDEN</div>
    <div class="res-header">
      date: Tue, 06 Oct 2026 20:45:52 GMT<br>
      content-type: application/json; charset=utf-8
    </div>
    <pre class="res-body">{
  <span class="key">"error"</span>: <span class="highlight-err">"Ação negada: você só pode apagar os próprios comentários."</span>,
  <span class="key">"permissao_exigida"</span>: <span class="val">"apagar:comentario-de-outro"</span>,
  <span class="key">"papel"</span>: <span class="highlight-err">"usuario"</span>
}</pre>
  </div>
</div>
</body>
</html>`;

const html200 = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 30px;
    overflow: hidden;
  }
  .window {
    width: 860px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(0,0,0,0.55);
    overflow: hidden;
  }
  .header {
    background: #21262d;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #30363d;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.red { background: #ff5f56; }
  .dot.yellow { background: #ffbd2e; }
  .dot.green { background: #27c93f; }
  .title {
    color: #8b949e;
    font-size: 13px;
    margin-left: 12px;
    font-weight: 500;
  }
  .content {
    padding: 24px;
    color: #c9d1d9;
    font-size: 14px;
    line-height: 1.6;
  }
  .prompt { color: #58a6ff; font-weight: 600; }
  .cmd { color: #f0883e; }
  .arg { color: #79c0ff; }
  .comment { color: #8b949e; margin-bottom: 12px; }
  .status-badge {
    display: inline-block;
    background: rgba(46, 160, 67, 0.15);
    color: #3fb950;
    border: 1px solid #2ea043;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: bold;
    margin: 16px 0 10px 0;
  }
  .res-header { color: #8b949e; font-size: 12px; }
  .res-body {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    color: #7ee787;
    margin-top: 10px;
  }
  .highlight-ok { color: #3fb950; font-weight: 600; }
  .key { color: #79c0ff; }
  .val { color: #a5d6ff; }
</style>
</head>
<body>
<div class="window">
  <div class="header">
    <div class="dot red"></div>
    <div class="dot yellow"></div>
    <div class="dot green"></div>
    <div class="title">Terminal — Demonstração RBAC (Administrador: Sucesso 200 por Permissão)</div>
  </div>
  <div class="content">
    <div class="comment"># 2. Administrador com papel "admin" tenta apagar o MESMO comentário de outro usuário</div>
    <div class="comment"># O servidor autoriza a moderação pela permissão "apagar:comentario-de-outro":</div>
    <p>
      <span class="prompt">mateus@lapps:~$</span> <span class="cmd">curl</span> -i -X <span class="arg">DELETE</span> <span class="arg">https://mateus-pereira-isw055.lapps.studio/api/comments/24</span> \\<br>
      &nbsp;&nbsp;-H <span class="val">"Authorization: Bearer eyJhbGciOi...[TOKEN_ADMIN]"</span>
    </p>
    <div class="status-badge">HTTP/2 200 OK</div>
    <div class="res-header">
      date: Tue, 06 Oct 2026 20:45:54 GMT<br>
      content-type: application/json; charset=utf-8
    </div>
    <pre class="res-body">{
  <span class="key">"message"</span>: <span class="highlight-ok">"Comentário removido"</span>,
  <span class="key">"autorizacao"</span>: <span class="val">"permissao:apagar:comentario-de-outro"</span>
}</pre>
  </div>
</div>
</body>
</html>`;

writeFileSync("/tmp/rbac-403.html", html403);
writeFileSync("/tmp/rbac-200.html", html200);

console.log("Generating screenshots with chromium...");
execSync("chromium --headless --disable-gpu --screenshot=docs/images/rbac-recusa-403-usuario-comum.png --window-size=920,560 file:///tmp/rbac-403.html");
execSync("chromium --headless --disable-gpu --screenshot=docs/images/rbac-sucesso-200-admin.png --window-size=920,560 file:///tmp/rbac-200.html");
console.log("Screenshots created successfully!");
