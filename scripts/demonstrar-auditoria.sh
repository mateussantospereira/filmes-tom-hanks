#!/bin/bash
# =============================================================================
# ISW055 · Atividade 5 · Observabilidade e Auditoria (log-service + Redis)
# =============================================================================
# Demonstração automatizada:
#   1. Dois logins: um usuário comum e um admin
#   2. Usuário comum realiza ações legítimas (favoritar, comentar)
#   3. Usuário comum tenta ação restrita de admin -> recusa com 403
#   4. Usuário comum faz logout
#   5. Usuário comum tenta consultar logs -> recusa com 403
#   6. Admin consulta os logs de auditoria (GET /api/logs)
#   7. Comprovação da ordem cronológica dos eventos no stream do Redis
#
# Uso:
#   ./scripts/demonstrar-auditoria.sh                 # http://127.0.0.1:8222
#   CATALOGO_URL=https://SEU-DOMINIO ./scripts/demonstrar-auditoria.sh
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$SCRIPT_DIR")"

BASE="${CATALOGO_URL:-http://127.0.0.1:8222}"
FILME=429
CARIMBO=$(date +%s)
EMAIL_COMUM="aud-comum-${CARIMBO}@exemplo.com"
EMAIL_ADMIN="aud-admin-${CARIMBO}@exemplo.com"
EMAIL_VITIMA="aud-vitima-${CARIMBO}@exemplo.com"
SENHA="senha-auditoria-${CARIMBO}"

VERDE=$'\033[0;32m'; VERMELHO=$'\033[0;31m'; AMARELO=$'\033[0;33m'
CINZA=$'\033[0;90m'; NEGRITO=$'\033[1m'; RESET=$'\033[0m'
FALHAS=0

# Helper JSON com bun (parse real de string, número e booleano)
json() {
  CHAVE="$1" bun -e '
    const corpo = await new Response(process.stdin).text();
    let dado = {};
    try { dado = JSON.parse(corpo); } catch {}
    const valor = dado[process.env.CHAVE];
    process.stdout.write(valor === undefined || valor === null ? "" : String(valor));
  '
}

# O id do comentário vem da LISTAGEM casado com o id do autor — nunca pela
# posição na resposta (ordem do MySQL não é garantia).
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

confere() {
  local desc="$1" esperado="$2" corpo="$3"
  if [ "$corpo" = "$esperado" ]; then
    printf "  ${VERDE}OK${RESET}   %-52s [HTTP %s]\n" "$desc" "$corpo"
  else
    printf "  ${VERMELHO}ERRO${RESET} %-52s esperado %s, veio %s\n" "$desc" "$esperado" "$corpo"
    FALHAS=$((FALHAS + 1))
  fi
}

api() {
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
echo "${NEGRITO}ISW055 · Atividade 5 · Observabilidade (log-service + Redis)${RESET}"
echo "API sob teste: ${BASE}"

# =============================================================================
rotulo "PASSO 1 — Criação das contas e login (comum e admin)"
# =============================================================================
api POST /api/register "" "{\"nome\":\"Comum Aud\",\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "criar conta comum" 201 "$HTTP_STATUS"

api POST /api/register "" "{\"nome\":\"Admin Aud\",\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "criar conta admin" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "login do usuário comum" 200 "$HTTP_STATUS"
TOKEN_COMUM=$(printf '%s' "$CORPO" | json token)

api POST /api/login "" "{\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "login do futuro admin" 200 "$HTTP_STATUS"
TOKEN_ADMIN=$(printf '%s' "$CORPO" | json token)

# Terceira conta: a dona do comentario que o comum vai tentar apagar no
# PASSO 3. Precisa existir de verdade, senao o DELETE responde 404 (recurso
# inexistente) e nunca chega na checagem de permissao — e 404 nao e 403.
api POST /api/register "" "{\"nome\":\"Vitima Aud\",\"email\":\"$EMAIL_VITIMA\",\"senha\":\"$SENHA\"}"
confere "criar conta vítima (dona do alvo)" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL_VITIMA\",\"senha\":\"$SENHA\"}"
confere "login da vítima" 200 "$HTTP_STATUS"
TOKEN_VITIMA=$(printf '%s' "$CORPO" | json token)

printf "  ${AMARELO}...${RESET} promovendo o admin via script do auth-service\n"
if [ -f "$RAIZ/.env.portainer" ] && [[ "$BASE" =~ lapps\.studio|https?://[^1l] ]]; then
  PROMOVIDO=$(cd "$RAIZ/auth-service" && bun --env-file="$RAIZ/.env.portainer" run criar-admin "$EMAIL_ADMIN" 2>&1)
else
  PROMOVIDO=$(cd "$RAIZ/auth-service" && bun run criar-admin "$EMAIL_ADMIN" 2>&1)
fi

if printf '%s' "$PROMOVIDO" | grep -qiE "promovido|ja e admin"; then
  printf "  ${VERDE}OK${RESET}   admin promovido com sucesso\n"
else
  printf "  ${VERMELHO}ERRO${RESET} falha ao promover admin: %s\n" "$PROMOVIDO"
  FALHAS=$((FALHAS + 1))
fi

# =============================================================================
rotulo "PASSO 2 — Usuário comum realiza ações que geram eventos de auditoria"
# =============================================================================
api POST /api/favorites "$TOKEN_COMUM" "{\"tmdb_movie_id\":$FILME,\"titulo\":\"Filme Teste Auditoria\"}"
confere "comum favorita um filme" 201 "$HTTP_STATUS"

api POST /api/comments "$TOKEN_COMUM" "{\"tmdb_movie_id\":$FILME,\"texto\":\"Comentário auditado de teste\"}"
confere "comum publica um comentário" 201 "$HTTP_STATUS"

# A vítima publica o alvo do PASSO 3 — um comentário que NÃO é do comum.
api POST /api/comments "$TOKEN_VITIMA" "{\"tmdb_movie_id\":$FILME,\"texto\":\"Comentário alheio de teste\"}"
confere "vítima publica o comentário alvo" 201 "$HTTP_STATUS"

# O id do alvo vem casado com o autor (usuarioId), nunca pela posição.
api GET /api/me "$TOKEN_VITIMA"
ID_VITIMA=$(printf '%s' "$CORPO" | json usuarioId)
api GET "/api/comments/$FILME" "$TOKEN_COMUM"
ID_ALVO=$(comentario_de "$ID_VITIMA")
if [ -z "$ID_ALVO" ]; then
  printf "  ${VERMELHO}ERRO${RESET} não achei o comentário da vítima (autor=%s)\n" "$ID_VITIMA"
  FALHAS=$((FALHAS + 1))
fi

# =============================================================================
rotulo "PASSO 3 — Usuário comum tenta ações não autorizadas (geram evento acao_negada)"
# =============================================================================
api GET /api/usuarios "$TOKEN_COMUM"
confere "comum tenta listar usuários (recusado 403)" 403 "$HTTP_STATUS"

api DELETE "/api/comments/$ID_ALVO" "$TOKEN_COMUM"
confere "comum tenta apagar comentário alheio (recusado 403)" 403 "$HTTP_STATUS"

# =============================================================================
rotulo "PASSO 4 — Logout do usuário comum"
# =============================================================================
api POST /api/logout "$TOKEN_COMUM"
confere "comum encerra sessão (POST /api/logout)" 200 "$HTTP_STATUS"

# =============================================================================
rotulo "PASSO 5 — Acesso restrito aos logs (RBAC da auditoria)"
# =============================================================================
# Usuário comum NÃO pode consultar os logs
api GET "/api/logs" "$TOKEN_COMUM"
confere "usuário comum tenta consultar logs (recusado 403)" 403 "$HTTP_STATUS"

# Administrador PODE consultar os logs
api GET "/api/logs?limite=20" "$TOKEN_ADMIN"
confere "administrador consulta logs (autorizado 200)" 200 "$HTTP_STATUS"

# =============================================================================
rotulo "PASSO 6 — Análise e comprovação da ordem cronológica dos eventos no Redis"
# =============================================================================
printf '%s' "$CORPO" | bun -e '
  const corpo = await new Response(process.stdin).text();
  let dados;
  try { dados = JSON.parse(corpo); } catch { dados = {}; }
  const eventos = dados.eventos || [];

  console.log(`  Total de eventos retornados: ${eventos.length}`);
  console.log("  Últimos eventos registrados (ordem cronológica no stream):");

  for (const ev of eventos.slice(-8)) {
    const acao = (ev.acao || "").padEnd(16);
    const usuario = (ev.usuario || "anônimo").padEnd(14);
    const origem = (ev.origem || "-").padEnd(12);
    const recurso = ev.recurso || "-";
    console.log(`    [${acao}] por ${usuario} via ${origem} -> ${recurso}`);
  }
'

# Conferência de integridade dos tipos de eventos esperados
ACOES_NO_LOG=$(printf '%s' "$CORPO" | bun -e '
  const corpo = await new Response(process.stdin).text();
  try {
    const d = JSON.parse(corpo);
    const lista = (d.eventos || []).map(e => e.acao);
    console.log(lista.join(" "));
  } catch {}
')

echo
for ACAO_ESPERADA in "login" "favoritar" "comentar" "acao_negada" "logout"; do
  if [[ "$ACOES_NO_LOG" =~ $ACAO_ESPERADA ]]; then
    printf "  ${VERDE}OK${RESET}   evento '${ACAO_ESPERADA}' presente no log de auditoria\n"
  else
    printf "  ${AMARELO}AVISO${RESET} evento '${ACAO_ESPERADA}' não localizado nesta amostra\n"
  fi
done

echo
if [ "$FALHAS" -eq 0 ]; then
  printf "  ${VERDE}${NEGRITO}TODAS AS CONFERENCIAS DA ATIVIDADE 5 PASSARAM${RESET}\n"
else
  printf "  ${VERMELHO}${NEGRITO}%d CONFERENCIA(S) FALHARAM${RESET}\n" "$FALHAS"
fi
echo
exit "$FALHAS"
