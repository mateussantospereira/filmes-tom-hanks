import type { Papel } from "./services/auth-service";

/**
 * Variaveis que o middleware de autenticacao deixa disponiveis para as rotas.
 * Repare que `usuarioId` e `role` NAO vem de decodificar token aqui: eles
 * vieram por HTTP do auth-service, que e o unico que sabe responder isso.
 */
export type Env = {
  Variables: {
    usuarioId: number;
    role: Papel;
    nome: string;
  };
};
