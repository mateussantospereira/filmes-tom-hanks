/**
 * O MAPA DE PERMISSOES — a peca que faltava do RBAC (atividade 4).
 *
 * As quatro pecas do RBAC:
 *
 *   Usuário    -> o cadastro                        (existe desde a atividade 2)
 *   Papel      -> "usuario", "admin"                (existe desde a atividade 3)
 *   Atribuição -> o campo `role` na tabela usuarios (existe desde a atividade 3)
 *   PERMISSÃO  -> ESTE ARQUIVO. E o que a atividade 4 pede.
 *
 * A diferenca pratica entre a atividade 3 e esta e sutil e e o ponto inteiro:
 *
 *   antes:  if (role !== "admin") recusa     <- o codigo compara um PAPEL
 *   agora:  if (!temPermissao(role, p)) ...  <- o codigo pergunta uma PERMISSAO
 *
 * Por que isso importa? Porque "quem pode apagar comentario alheio" deixa de
 * ser uma frase colada em cada rota e vira um dado num lugar so. Se amanha o
 * papel "moderador" for criado, muda-se ESTE ARQUIVO — nenhuma rota, nenhum
 * endpoint, nenhum `if` espalhado pelo codigo precisa ser lembrado. E e o
 * requisito da atividade: "Mudar o que um admin pode fazer e uma mudanca num
 * lugar so, nao em cada usuario admin, um por um."
 *
 * ATENÇÃO sobre onde este mapa mora: no AUTH-SERVICE, e nao no catalogo.
 * O catalogo NAO tem este mapa. Ele recebe ja pronto o resultado
 * (`GET /me` devolve `permissoes: [...]`) e so consulta a lista que chegou.
 * Assim o catalogo continua sem saber quem decide — a politica mora com o dono
 * da identidade.
 */

/** Papel de um usuario. Mesmo conjunto da atividade 3. */
export type Papel = "usuario" | "admin";

/**
 * Uma permissao e "uma acao sobre um recurso", escrita como `acao:recurso`.
 *
 * Os nomes sao a API de autorizacao entre os dois servicos: mudar um deles
 * obriga a mudar os dois, por isso sao declarados de forma explicita.
 */
export type Permissao =
  /** Ler os comentarios de um filme. */
  | "ler:comentario"
  /** Publicar um comentario proprio. */
  | "criar:comentario"
  /** Apagar comentario do qual sou autor. */
  | "apagar:comentario"
  /** Apagar comentario de OUTRO usuario — moderacao. EXCLUSIVO de admin. */
  | "apagar:comentario-de-outro"
  /** Listar todos os usuarios do sistema e o papel de cada um. EXCLUSIVO de admin. */
  | "listar:usuarios"
  /** Promover ou rebaixar o papel de outro usuario. EXCLUSIVO de admin. */
  | "alterar:papel"
  /**
   * Ler o stream de auditoria (atividade 5). EXCLUSIVO de admin.
   *
   * Permissao nova, entao o requisito "mudar o que um admin pode fazer e uma
   * mudanca num lugar so" e testavel aqui: esta linha mais uma linha abaixo
   * e TUDO que foi preciso para o log passar a existir como coisa consultavel.
   * Nenhuma rota do catalogo, nenhuma rota do log-service e nenhum `if` sobre
   * papel foi mexido — os dois servicos apenas perguntam por este nome.
   */
  | "consultar:logs";

/**
 * O que cada papel pode fazer.
 *
 * `admin` CONTEN `usuario`: um admin continua sendo um usuario. Nao sao
 * permissoes separadas, e um conjunto que cresce — por isso promover alguem
 * nao faz nada dele deixar de funcionar.
 */
const POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  usuario: ["ler:comentario", "criar:comentario", "apagar:comentario"],
  admin: [
    "ler:comentario",
    "criar:comentario",
    "apagar:comentario",
    "apagar:comentario-de-outro",
    "listar:usuarios",
    "alterar:papel",
    "consultar:logs",
  ],
} as const;

/**
 * Converte um papel guardado no banco na lista de permissoes dele.
 *
 * FALHA PARA O MENOR PRIVILÉGIO: papel desconhecido ou corrompido nao vira
 * admin por milagre — vira "usuario". Se a coluna `role` estiver com lixo
 * (`NULL`, `ADMIN` maiusculo, texto antigo), o resultado e recusar, nunca
 * conceder.
 */
export function permissoesDe(role: unknown): Permissao[] {
  const papel = String(role ?? "") as Papel;
  return [...(POR_PAPEL[papel] ?? POR_PAPEL.usuario)];
}

/** Pergunta rapida: esse papel tem essa permissao? */
export function temPermissao(role: unknown, permissao: Permissao): boolean {
  const papel = String(role ?? "") as Papel;
  return (POR_PAPEL[papel] ?? POR_PAPEL.usuario).includes(permissao);
}
