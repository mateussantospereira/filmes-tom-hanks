/**
 * Configuracao do microsservico de autenticacao.
 *
 * Toda a configuracao entra por variavel de ambiente e e validada na partida:
 * se faltar algo essencial o processo morre imediatamente com uma mensagem
 * explicita, em vez de subir quebrado e falhar so quando alguem tenta logar.
 */

function obrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    throw new Error(
      `[auth-service] Variavel de ambiente obrigatoria ausente: ${nome}. ` +
        `Copie auth-service/.env.example para auth-service/.env (ou defina no docker-compose.yml) e preencha.`
    );
  }
  return valor;
}

function opcional(nome: string, padrao: string): string {
  const valor = process.env[nome]?.trim();
  return valor ? valor : padrao;
}

function inteiro(nome: string, padrao: number): number {
  const bruto = process.env[nome]?.trim();
  if (!bruto) return padrao;
  const valor = Number(bruto);
  if (!Number.isFinite(valor)) {
    throw new Error(`[auth-service] Variavel de ambiente ${nome} precisa ser um numero, recebido: "${bruto}"`);
  }
  return valor;
}

const nodeEnv = opcional("NODE_ENV", "development");
const appPublicUrl = obrigatorio("APP_PUBLIC_URL").replace(/\/+$/, "");

export const config = {
  nodeEnv,
  production: nodeEnv === "production",

  /** Porta DENTRO do container. Nao e publicada para o host (ver docker-compose.yml). */
  port: inteiro("PORT", 3000),

  /** URL publica do catalogo — o unico container visivel para a internet. */
  app: {
    publicUrl: appPublicUrl,
  },

  db: {
    host: obrigatorio("DB_HOST"),
    port: inteiro("DB_PORT", 3306),
    user: obrigatorio("DB_USER"),
    // Aceita vazia de proposito: MariaDB local raramente exige senha. Uma senha
    // errada aqui aparece como "Access denied" do proprio banco, com nome claro.
    password: opcional("DB_PASSWORD", ""),
    name: obrigatorio("DB_NAME"),
  },

  jwt: {
    secret: obrigatorio("JWT_SECRET"),
    expiresIn: opcional("JWT_EXPIRES_IN", "24h"),
  },

  reset: {
    /** Requisito da atividade: o link de redefinicao para de valer em 30 minutos. */
    ttlMinutos: inteiro("RESET_TOKEN_TTL_MINUTES", 30),
    /** Caminho do link dentro do catalogo (o link volta a entrar pelo catalogo). */
    path: opcional("RESET_PASSWORD_PATH", "/reset-password"),
  },

  mail: {
    /**
     * Dev:  Mailtrap  -> smtp.mailtrap.io:2525 (sandbox, o e-mail nao sai de fato)
     * Prod: Brevo     -> smtp-relay.brevo.com:587 (envio transacional de verdade)
     * O codigo e o mesmo: o que muda sao as variaveis de ambiente.
     */
    host: opcional("MAIL_HOST", ""),
    port: inteiro("MAIL_PORT", 587),
    user: opcional("MAIL_USER", ""),
    pass: opcional("MAIL_PASSWORD", ""),
    from: opcional("MAIL_FROM", ""),
    fromName: opcional("MAIL_FROM_NAME", "Catalogo de Filmes"),
  },
} as const;
