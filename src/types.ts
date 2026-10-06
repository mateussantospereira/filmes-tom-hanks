import type { Papel } from "./services/auth-service";

/**
 * PERMISSAO — a peca que faltava do RBAC (atividade 4).
 *
 * Uma permissao e "uma acao sobre um recurso", escrita `acao:recurso`.
 *
 * Repare que este tipo e so a DECLARACAO da API de autorizacao entre os dois
 * servicos. Quem decide o que cada papel tem e o auth-service
 * (auth-service/src/auth/permissoes.ts) — o catalogo recebe em `GET /me` a
 * lista ja resolvida e so consulta. Se os dois lados forem editados juntos
 * quando um nome mudar, e porque sao dois pacotes separados (cada um com seu
 * Dockerfile e seu `package.json`) e nao existe modulo em comum: e contrato de
 * API, nao regra de negocio copiada.
 *
 * A prova de que a regra nao mora aqui: procure no catalogo inteiro onde
 * `role` e comparado com `"admin"`. Nao existe mais.
 */
export type Permissao =
  | "ler:comentario"
  | "criar:comentario"
  | "apagar:comentario"
  | "apagar:comentario-de-outro"
  | "listar:usuarios"
  | "alterar:papel";

/**
 * Variaveis que o middleware de autenticacao deixa disponiveis para as rotas.
 *
 * Repare que `usuarioId`, `role` e `permissoes` NAO vao de decodificar token
 * aqui: eles vieram por HTTP do auth-service, que e o unico que sabe responder
 * isso. E por isso `role` esta aqui junto — nao para as rotas compararem com
 * "admin", mas porque a mensagem de erro 403 costuma querer dizer qual papel
 * estava faltando.
 */
export type Env = {
  Variables: {
    usuarioId: number;
    role: Papel;
    nome: string;
    /** Lista pronta de permissoes, entregue pelo auth-service no `GET /me`. */
    permissoes: Permissao[];
  };
};
