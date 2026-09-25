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

export type Sessao = {
  usuarioId: number;
  nome: string;
  email: string;
  role: Papel;
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

function post<T>(caminho: string, corpo: unknown, token?: string): Promise<Resultado<T>> {
  return chamar<T>(caminho, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/** POST /register — cadastro. O `role` nunca vem do navegador. */
export const registrar = (dados: { nome: string; email: string; senha: string }) =>
  post<{ message: string }>("/register", dados);

/** POST /login — devolve o JWT e o papel do usuario. */
export const login = (email: string, senha: string) =>
  post<{ token: string; nome: string; role: Papel }>("/login", { email, senha });

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
