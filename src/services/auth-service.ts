/**
 * Cliente HTTP do auth-service.
 *
 * Este arquivo e a "meia-volta" da atividade 3: o catalogo nao decodifica JWT,
 * nao compara senha com bcrypt e nao conhece a tabela `usuarios`. Tudo que
 * envolve autenticacao vira uma chamada de REDE para http://auth-service:3000,
 * alcancavel apenas de dentro da rede do Docker.
 *
 * A troca e deliberada: uma chamada de funcao e instantanea e sempre
 * disponivel; uma chamada de rede pode falhar, demorar e precisa de tratamento
 * de erro. Por isso todo erro aqui vira uma resposta 503 com mensagem clara —
 * o catalogo continua no ar mesmo com o auth-service fora do ar.
 */

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL ?? "http://auth-service:3000").replace(/\/+$/, "");

/** Nao esperamos para sempre: um auth-service travado nao pode travar o catalogo. */
const TIMEOUT_MS = Number(process.env.AUTH_SERVICE_TIMEOUT_MS ?? 5000);

export const MENSAGEM_INDISPONIVEL =
  "Serviço de autenticação indisponível. Tente novamente em instantes.";

export type Papel = "usuario" | "admin";

/**
 * Permissao — `acao:recurso`. Declaracao do que o auth-service entrega no
 * `GET /me`; a decisao de qual papel tem qual permissao e LA, e nunca aqui.
 */
export type Permissao =
  | "ler:comentario"
  | "criar:comentario"
  | "apagar:comentario"
  | "apagar:comentario-de-outro"
  | "listar:usuarios"
  | "alterar:papel"
  | "consultar:logs";

export type Sessao = {
  usuarioId: number;
  nome: string;
  email: string;
  role: Papel;
  /**
   * O que este usuario pode fazer, resolvido pelo auth-service.
   *
   * E alem do papel, e o ponto da atividade 4: as rotas do catalogo consultam
   * `permissoes.includes("...")` e nunca `role === "admin"`. Adicionar um
   * papel novo nao obriga mexer em rota nenhuma daqui.
   */
  permissoes: Permissao[];
};

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string };

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<Resultado<T>> {
  let resposta: Response;

  try {
    resposta = await fetch(`${AUTH_SERVICE_URL}${caminho}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erro) {
    // Servico caiu, reiniciando, name resolution falhou ou deu timeout.
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auth-service] ${caminho} falhou (${AUTH_SERVICE_URL}): ${motivo}`);
    return { ok: false, status: 503, erro: MENSAGEM_INDISPONIVEL };
  }

  const corpo = (await resposta.json().catch(() => null)) as { error?: string } | T | null;

  if (!resposta.ok) {
    return {
      ok: false,
      status: resposta.status,
      erro: (corpo as { error?: string })?.error ?? "Falha na autenticação",
    };
  }

  return { ok: true, dados: corpo as T };
}

function post<T>(
  caminho: string,
  corpo: unknown,
  token?: string,
  extras?: Record<string, string>
): Promise<Resultado<T>> {
  return chamar<T>(caminho, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extras ?? {}) },
  });
}

/** POST /register — cadastro. O `role` nunca vem do navegador. */
export const registrar = (dados: { nome: string; email: string; senha: string }) =>
  post<{ message: string }>("/register", dados);

/**
 * POST /login — devolve o JWT e o papel do usuario.
 *
 * `ip` (bonus do requisito 3 da atividade 5) e repassado por `X-Forwarded-For`:
 * o navegador conhece o catalogo, nao o auth-service, entao sem este header o
 * evento de login gravaria o IP de um container do Docker em vez do de quem
 * digitou a senha.
 */
export const login = (email: string, senha: string, ip?: string | null) =>
  post<{ token: string; nome: string; role: Papel }>(
    "/login",
    { email, senha },
    undefined,
    ip ? { "x-forwarded-for": ip } : undefined
  );

/**
 * POST /logout — registra o fim da sessao no log de auditoria.
 *
 * O JWT continua valido ate expirar (ele e stateless: nao ha servidor de
 * sessao para revogar), entao esta rota nao "desloga" ninguem do ponto de vista
 * de autenticacao — o navegador ja apaga o proprio token. O que ela faz e o que
 * a atividade 5 pede: deixar o rastro de que a pessoa saiu, na hora em que saiu.
 */
export const encerrarSessao = (token: string, ip?: string | null) =>
  post<{ message: string }>(
    "/logout",
    {},
    token,
    ip ? { "x-forwarded-for": ip } : undefined
  );

/**
 * GET /me — "quem e esse usuario?".
 *
 * E a unica forma do catalogo descobrir o id e o PAPEL de quem esta chamando.
 * O catalogo nao valida o token: quem valida e o dono do segredo (o auth-service).
 */
export const sessao = (token: string): Promise<Resultado<Sessao>> =>
  chamar<Sessao>("/me", { headers: { Authorization: `Bearer ${token}` } });

/** POST /forgot-password — envia o link de redefinicao por e-mail. */
export const esquecerSenha = (email: string) =>
  post<{ message: string }>("/forgot-password", { email });

/** POST /reset-password — valida o token e troca a senha. */
export const trocarSenha = (token: string, novaSenha: string) =>
  post<{ message: string }>("/reset-password", { token, novaSenha });

/**
 * GET /usuarios — lista todos os usuarios e o papel de cada um.
 * Exige `listar:usuarios`; o auth-service confere de novo do lado dele.
 */
export const listarUsuarios = (token: string) =>
  chamar<{ usuarios: UsuarioLista[]; total: number }>("/usuarios", {
    headers: { Authorization: `Bearer ${token}` },
  });

/**
 * PATCH /usuarios/:id/role — promove ou rebaixa.
 * Exige `alterar:papel`. Corpo: `{ role: "admin" | "usuario" }`.
 */
export const alterarPapel = (token: string, usuarioId: number, role: Papel) =>
  chamar<{ message: string }>(`/usuarios/${usuarioId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    headers: { Authorization: `Bearer ${token}` },
  });

/** Linha devolvida por GET /usuarios. NUNCA ha `senha_hash` nesta lista. */
export type UsuarioLista = {
  id: number;
  nome: string;
  email: string;
  role: Papel;
  criadoEm: string | null;
};
