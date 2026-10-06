#!/bin/bash
# =============================================================================
# ISW055 · Atividade 4 · RBAC — demonstração da autorização por permissão
# =============================================================================
# O que esta prova mostra, na ordem que a atividade pede:
#
#   1. dois logins: um "usuario" comum e um "admin"
#   2. a MESMA ação exclusiva chamada pelos dois, direto na API (curl),
#      sem passar pela interface — porque botão escondido não é segurança
#   3. o comum recebe 403; o admin executa com sucesso
#
# Uso:
#   ./scripts/demonstrar-rbac.sh                 # http://127.0.0.1:8222
#   CATALOGO_URL=https://SEU-DOMINIO ./scripts/demonstrar-rbac.sh
#
# Ele CRIA contas novas a cada execução (com timestamps), então pode rodar
# quantas vezes quiser sem poluir o banco de dados reais.
# =============================================================================
set -u

# Resolve o repositório a partir do PRÓPRIO script, para rodar de qualquer
# diretório (o `bun run criar-admin` precisa do auth-service como CWD).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$SCRIPT_DIR")"

BASE="${CATALOGO_URL:-http://127.0.0.1:8222}"
FILME=429                       # filme qualquer, só para o comentário existir
CARIMBO=$(date +%s)
EMAIL_COMUM="comum-${CARIMBO}@exemplo.com"
EMAIL_ADMIN="admin-${CARIMBO}@exemplo.com"
EMAIL_VITIMA="vitima-${CARIMBO}@exemplo.com"
SENHA="senha-rbac-${CARIMBO}"

VERDE=$'\033[0;32m'; VERMELHO=$'\033[0;31m'; AMARELO=$'\033[0;33m'
CINZA=$'\033[0;90m'; NEGRITO=$'\033[1m'; RESET=$'\033[0m'
FALHAS=0

# --- helpers ----------------------------------------------------------------
# Extrai um valor do JSON, lendo JSON de verdade com o bun. A versao anterior
# usava grep (`grep -o '"chave":"valor"'`) e passou a devolver VAZIO quando o
# valor era numero: /api/me devolve "usuarioId":29, sem aspas, e a regex so
# casava string. ID vazio virava `/api/usuarios//role` — o servidor respondia
# 404 e a falha do SCRIPT aparecia como falha da API. Aceita string, numero e
# booleano.
json() {
  CHAVE="$1" bun -e '
    const corpo = await new Response(process.stdin).text();
    let dado = {};
    try { dado = JSON.parse(corpo); } catch {}
    const valor = dado[process.env.CHAVE];
    process.stdout.write(valor === undefined || valor === null ? "" : String(valor));
  '
}

# Id do comentário de um autor específico. Usa o bun para ler JSON de verdade:
# fatiar JSON com grep/sed é o tipo de coisa que funciona quase sempre e quebra
# justo no dia da entrega — e aqui um id errado faz a prova inteira mentir.
comentario_de() {
  printf '%s' "$CORPO" | ALVO="$1" bun -e '
    const alvo = Number(process.env.ALVO);
    const corpo = await new Response(process.stdin).text();
    let lista = [];
    try { lista = JSON.parse(corpo); } catch {}
    const achou = (Array.isArray(lista) ? lista : []).find((c) => c.usuarioId === alvo);
    process.stdout.write(String(achou ? achou.id : ""));
  '
}

rotulo() { printf "\n${NEGRITO}%s${RESET}\n" "$1"; printf '%s\n' "-----------------------------------------------------------"; }

# $1 = descrição | $2 = HTTP esperado | $3 = corpo da resposta
confere() {
  local desc="$1" esperado="$2" corpo="$3"
  if [ "$corpo" = "$esperado" ]; then
    printf "  ${VERDE}OK${RESET}   %-52s [HTTP %s]\n" "$desc" "$corpo"
  else
    printf "  ${VERMELHO}ERRO${RESET} %-52s esperado %s, veio %s\n" "$desc" "$esperado" "$corpo"
    FALHAS=$((FALHAS + 1))
  fi
}

# Chamada à API. Deixa a resposta no corpo e o status em $HTTP_STATUS.
api() {
  # $1 metodo | $2 caminho | $3 token | $4 corpo (opcional)
  local resp
  if [ -n "${4:-}" ]; then
    resp=$(curl -s -m 20 -w $'\n%{http_code}' -X "$1" "${BASE}$2" \
      -H 'Content-Type: application/json' \
      ${3:+-H "Authorization: Bearer $3"} -d "$4")
  else
    resp=$(curl -s -m 20 -w $'\n%{http_code}' -X "$1" "${BASE}$2" \
      ${3:+-H "Authorization: Bearer $3"})
  fi
  HTTP_STATUS="${resp##*$'\n'}"
  CORPO="${resp%$'\n'*}"
}

echo
echo "${NEGRITO}ISW055 · Atividade 4 · Autorização (RBAC)${RESET}"
echo "API sob teste: ${BASE}"

# =============================================================================
rotulo "PASSO 1 — dois logins (um comum, um admin)"
# =============================================================================
api POST /api/register "" "{\"nome\":\"Comum\",\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "criar conta comum" 201 "$HTTP_STATUS"

api POST /api/register "" "{\"nome\":\"Chefe\",\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "criar conta futura admin" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "login do usuário comum" 200 "$HTTP_STATUS"
TOKEN_COMUM=$(printf '%s' "$CORPO" | json token)

api POST /api/login "" "{\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "login do futuro admin" 200 "$HTTP_STATUS"
TOKEN_ADMIN=$(printf '%s' "$CORPO" | json token)

# O primeiro admin nasce fora do HTTP (um script no container), porque criar-se
# admin por endpoint seria o mesmo que não ter controle nenhum.
echo
printf "  ${AMARELO}...${RESET} promovendo a segunda conta a admin pelo script do auth-service\n"
if [ -f "$RAIZ/.env.portainer" ] && [[ "$BASE" =~ lapps\.studio|https?://[^1l] ]]; then
  PROMOVIDO=$(cd "$RAIZ/auth-service" && bun --env-file="$RAIZ/.env.portainer" run criar-admin "$EMAIL_ADMIN" 2>&1)
else
  PROMOVIDO=$(cd "$RAIZ/auth-service" && bun run criar-admin "$EMAIL_ADMIN" 2>&1)
fi
if printf '%s' "$PROMOVIDO" | grep -qiE "promovido|ja e admin"; then
  printf "  ${VERDE}OK${RESET}   primeiro admin criado pelo script (sem backdoor HTTP)\n"
else
  printf "  ${VERMELHO}ERRO${RESET} não consegui promover o admin: %s\n" "$PROMOVIDO"
  FALHAS=$((FALHAS + 1))
fi

# Ids das contas: a ordem de criação NÃO é garantia de nada, então nunca se
# deduz quem é quem a partir do lugar da resposta.
api GET /api/me "$TOKEN_COMUM"
ID_COMUM=$(printf '%s' "$CORPO" | json usuarioId)
api GET /api/me "$TOKEN_ADMIN"
ID_ADMIN=$(printf '%s' "$CORPO" | json usuarioId)

# =============================================================================
rotulo "PASSO 2 — o que cada um TEM direito a fazer (permissões vêm do auth-service)"
# =============================================================================
# =============================================================================
api GET /api/me "$TOKEN_COMUM"
PERM_COMUM=$(printf '%s' "$CORPO" | sed -n 's/.*"permissoes":\[\([^]]*\)\].*/\1/p')
printf "  comum  : %s\n" "$PERM_COMUM"

api GET /api/me "$TOKEN_ADMIN"
PERM_ADMIN=$(printf '%s' "$CORPO" | sed -n 's/.*"permissoes":\[\([^]]*\)\].*/\1/p')
printf "  admin  : %s\n" "$PERM_ADMIN"

if printf '%s' "$PERM_COMUM" | grep -q "apagar:comentario-de-outro"; then
  printf "  ${VERMELHO}ERRO${RESET} o usuário comum NÃO deveria ter a permissão de moderar\n"
  FALHAS=$((FALHAS + 1))
else
  printf "  ${VERDE}OK${RESET}   comum NÃO tem 'apagar:comentario-de-outro'\n"
fi

if printf '%s' "$PERM_ADMIN" | grep -q "apagar:comentario-de-outro"; then
  printf "  ${VERDE}OK${RESET}   admin TEM 'apagar:comentario-de-outro'\n"
else
  printf "  ${VERMELHO}ERRO${RESET} admin deveria ter a permissão de moderar\n"
  FALHAS=$((FALHAS + 1))
fi

# =============================================================================
rotulo "PASSO 3 — AÇÃO EXCLUSIVA: apagar comentário de OUTRO usuário"
# =============================================================================
# Por que existe uma TERCEIRA conta aqui: com dois usuários só, seria
# impossível provar as duas metades da regra na mesma tentativa.
#   - se o alvo fosse do COMUM, ele apagaria como dono (200) e o admin também
#     (200) — nenhum 403 na tela;
#   - se o alvo fosse do ADMIN, o comum daria 403, mas o admin apagaria como
#     DONO — e aí o que se provaria é ownership, não autorização.
# A vítima resolve: o alvo não pertence a nenhum dos dois que testam, então o
# admin SÓ consegue apagando pela permissão.
api POST /api/register "" "{\"nome\":\"Vitima\",\"email\":\"$EMAIL_VITIMA\",\"senha\":\"$SENHA\"}"
confere "criar a terceira conta (dono do alvo)" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL_VITIMA\",\"senha\":\"$SENHA\"}"
confere "login da vítima" 200 "$HTTP_STATUS"
TOKEN_VITIMA=$(printf '%s' "$CORPO" | json token)

api POST /api/comments "$TOKEN_VITIMA" "{\"tmdb_movie_id\":$FILME,\"texto\":\"comentario da vitima\"}"
confere "a vítima publica o comentário alvo" 201 "$HTTP_STATUS"

api GET /api/me "$TOKEN_VITIMA"
ID_VITIMA=$(printf '%s' "$CORPO" | json usuarioId)

# O id vem da listagem casado com o autor — nunca pela posição na resposta.
api GET "/api/comments/$FILME" "$TOKEN_COMUM"
ID_ALVO=$(comentario_de "$ID_VITIMA")
if [ -z "$ID_ALVO" ]; then
  printf "  ${VERMELHO}ERRO${RESET} não achei o comentário da vítima (id de autor=%s)\n" "$ID_VITIMA"
  FALHAS=$((FALHAS + 1))
fi

# Cada um publica o seu, para o PASSO 3b mostrar o caminho do dono.
api POST /api/comments "$TOKEN_COMUM" "{\"tmdb_movie_id\":$FILME,\"texto\":\"comentario do comum\"}"
confere "o comum publica o próprio comentário" 201 "$HTTP_STATUS"

echo
printf "  ${NEGRITO}3a. o MESMO pedido pelos dois logins${RESET}\n"
api DELETE "/api/comments/$ID_ALVO" "$TOKEN_COMUM"
confere "COMUM tenta apagar o da vítima" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

api DELETE "/api/comments/$ID_ALVO" "$TOKEN_ADMIN"
printf "  ${VERDE}${NEGRITO}%-54s${RESET} [HTTP %s]\n" "ADMIN apaga o mesmo comentário" "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"
if [ "$HTTP_STATUS" != "200" ]; then
  printf "  ${VERMELHO}ERRO${RESET} o admin deveria ter conseguido apagar\n"
  FALHAS=$((FALHAS + 1))
elif ! printf '%s' "$CORPO" | grep -q "apagar:comentario-de-outro"; then
  # A resposta diz COMO a operação foi autorizada. Se não disser "permissao",
  # o admin apagou por ser dono — e a prova não vale.
  printf "  ${VERMELHO}ERRO${RESET} a resposta não diz que foi por permissão (ownership não prova RBAC)\n"
  FALHAS=$((FALHAS + 1))
else
  printf "  ${VERDE}OK${RESET}   admin foi autorizado pela PERMISSÃO, não por dono\n"
fi

echo
printf "  ${NEGRITO}3b. e o caminho normal: apagar o próprio${RESET}\n"
api GET "/api/comments/$FILME" "$TOKEN_COMUM"
ID_PROPRIO=$(comentario_de "$ID_COMUM")
api DELETE "/api/comments/$ID_PROPRIO" "$TOKEN_COMUM"
confere "COMUM apaga o SEU comentário" 200 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# =============================================================================
rotulo "PASSO 4 — segunda ação exclusiva: listar usuários e trocar papel"
# =============================================================================
api GET /api/usuarios "$TOKEN_COMUM"
confere "COMUM lista os usuários" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

api GET /api/usuarios "$TOKEN_ADMIN"
confere "ADMIN lista os usuários" 200 "$HTTP_STATUS"
TOTAL=$(printf '%s' "$CORPO" | grep -o '"total":[0-9]*' | cut -d: -f2)
printf "       %s%s usuários no sistema%s\n" "$CINZA" "$TOTAL" "$RESET"

# O comum tenta rebaixar o admin — o golpe clássico, feito por curl, sem interface.
api PATCH "/api/usuarios/$ID_ADMIN/role" "$TOKEN_COMUM" '{"role":"usuario"}'
confere "COMUM tenta rebaixar o admin" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# E o admin não se rebaixa sozinho: a trava existe para não deixar o sistema
# sem nenhum admin (promove o colega, depois se rebaixa, e ninguém promove mais).
api PATCH "/api/usuarios/$ID_ADMIN/role" "$TOKEN_ADMIN" '{"role":"usuario"}'
confere "ADMIN tenta rebaixar a SI MESMO (recusado)" 400 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# Papel inventado também não passa: senão nasceria um papel sem permissão nenhuma.
api PATCH "/api/usuarios/$ID_COMUM/role" "$TOKEN_ADMIN" '{"role":"dono"}'
confere "ADMIN manda um papel inventado (recusado)" 400 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# =============================================================================
rotulo "PASSO 5 — sem sessão nenhuma, também não passa"
# =============================================================================
# A ordem importa: 401 (não sei quem você é) vem do middleware, ANTES de a rota
# sequer olhar o id. Um 404 aqui seria vazamento — diria que o recurso existe.
api DELETE "/api/comments/$ID_ALVO" ""
confere "sem token, apagar comentário" 401 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

api GET /api/usuarios ""
confere "sem token, listar usuários" 401 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# =============================================================================
echo
if [ "$FALHAS" -eq 0 ]; then
  printf "  ${VERDE}${NEGRITO}TODAS AS CONFERENCIAS PASSARAM${RESET}\n"
else
  printf "  ${VERMELHO}${NEGRITO}%d CONFERENCIA(S) FALHARAM${RESET}\n" "$FALHAS"
fi
echo
exit "$FALHAS"
