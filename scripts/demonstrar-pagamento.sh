#!/bin/bash
# =============================================================================
# ISW055 · Atividade 7 · Serviço baseado em pagamento (plano Premium/Stripe)
# =============================================================================
# Demonstração automatizada do que dá para provar SEM cartão:
#   1. Conta nova nasce no plano gratuito (premium = false)
#   2. O plano gratuito aceita 5 favoritos e RECUSA o 6º com 403
#   3. O status do plano mostra o limite e o preço
#   4. O webhook recusa chamadas sem assinatura ou com assinatura falsa
#   5. O checkout responde 503 quando o Stripe não está configurado (ou devolve
#      a URL do Stripe quando está)
#
# O pagamento em si (cartão 4242 4242 4242 4242) é feito no navegador, na
# página do Stripe, e a confirmação chega por webhook. Veja o README.
#
# Uso:
#   ./scripts/demonstrar-pagamento.sh                  # http://127.0.0.1:8222
#   CATALOGO_URL=https://SEU-DOMINIO ./scripts/demonstrar-pagamento.sh
# =============================================================================
set -u

BASE="${CATALOGO_URL:-http://127.0.0.1:8222}"
CARIMBO=$(date +%s)
EMAIL="premium-${CARIMBO}@exemplo.com"
SENHA="senha-premium-${CARIMBO}"
FILME_BASE=900

VERDE=$'\033[0;32m'; VERMELHO=$'\033[0;31m'; AMARELO=$'\033[0;33m'
CINZA=$'\033[0;90m'; NEGRITO=$'\033[1m'; RESET=$'\033[0m'
FALHAS=0

json() {
  CHAVE="$1" bun -e '
    const corpo = await new Response(process.stdin).text();
    let dado = {};
    try { dado = JSON.parse(corpo); } catch {}
    const valor = dado[process.env.CHAVE];
    process.stdout.write(valor === undefined || valor === null ? "" : String(valor));
  '
}

rotulo() { printf "\n${NEGRITO}%s${RESET}\n" "$1"; printf '%s\n' "-----------------------------------------------------------"; }

confere() {
  local desc="$1" esperado="$2" veio="$3"
  if [ "$veio" = "$esperado" ]; then
    printf "  ${VERDE}OK${RESET}   %-56s [%s]\n" "$desc" "$veio"
  else
    printf "  ${VERMELHO}ERRO${RESET} %-56s esperado %s, veio %s\n" "$desc" "$esperado" "$veio"
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
echo "${NEGRITO}ISW055 · Atividade 7 · Pagamento (plano Premium)${RESET}"
echo "API sob teste: ${BASE}"

# =============================================================================
rotulo "PASSO 1 — conta nova nasce no plano gratuito"
# =============================================================================
api POST /api/register "" "{\"nome\":\"Pessoa Premium\",\"email\":\"$EMAIL\",\"senha\":\"$SENHA\"}"
confere "criar conta de teste" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\"}"
confere "login" 200 "$HTTP_STATUS"
TOKEN=$(printf '%s' "$CORPO" | json token)

api GET /api/me "$TOKEN"
confere "GET /api/me traz o campo premium" "false" "$(printf '%s' "$CORPO" | json premium)"

api GET /api/premium/status "$TOKEN"
confere "status do plano gratuito" "gratuito" "$(printf '%s' "$CORPO" | json plano)"
confere "limite de favoritos do plano gratuito" "5" "$(printf '%s' "$CORPO" | json limiteFavoritos)"

# =============================================================================
rotulo "PASSO 2 — o benefício: 5 favoritos no gratuito, o 6º é recusado"
# =============================================================================
for i in 1 2 3 4 5; do
  ID=$((FILME_BASE + i))
  api POST /api/favorites "$TOKEN" "{\"tmdb_movie_id\":$ID,\"titulo\":\"Filme Teste $i\"}"
  confere "favoritar filme $i (dentro do limite)" 201 "$HTTP_STATUS"
done

api POST /api/favorites "$TOKEN" "{\"tmdb_movie_id\":$((FILME_BASE + 6)),\"titulo\":\"Filme Teste 6\"}"
confere "6º favorito no plano gratuito -> 403" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

api GET /api/premium/status "$TOKEN"
confere "status mostra 5 de 5 usados" "5" "$(printf '%s' "$CORPO" | json favoritos)"
confere "restantes no plano gratuito" "0" "$(printf '%s' "$CORPO" | json restantes)"

# =============================================================================
rotulo "PASSO 3 — o webhook recusa quem não é o Stripe"
# =============================================================================
# Rota pública: sem assinatura (ou com assinatura inventada) tem que dar 400.
# Sem segredo configurado no ambiente, a rota responde 503 antes de olhar o
# header — os dois casos são recusa.
api POST /api/premium/webhook "" '{"type":"checkout.session.completed"}'
if [ "$HTTP_STATUS" = "400" ] || [ "$HTTP_STATUS" = "503" ]; then
  printf "  ${VERDE}OK${RESET}   %-56s [%s]\n" "webhook sem stripe-signature é recusado" "$HTTP_STATUS"
else
  printf "  ${VERMELHO}ERRO${RESET} webhook sem assinatura devia recusar, veio %s\n" "$HTTP_STATUS"
  FALHAS=$((FALHAS + 1))
fi

RESP=$(curl -s -m 20 -w $'\n%{http_code}' -X POST "${BASE}/api/premium/webhook" \
  -H 'Content-Type: application/json' \
  -H 'stripe-signature: t=1700000000,v1=assinatura-falsa' \
  -d '{"type":"checkout.session.completed"}')
HTTP_STATUS="${RESP##*$'\n'}"
CORPO="${RESP%$'\n'*}"
if [ "$HTTP_STATUS" = "400" ] || [ "$HTTP_STATUS" = "503" ]; then
  printf "  ${VERDE}OK${RESET}   %-56s [%s]\n" "webhook com assinatura falsa é recusado" "$HTTP_STATUS"
else
  printf "  ${VERMELHO}ERRO${RESET} webhook com assinatura falsa devia recusar, veio %s\n" "$HTTP_STATUS"
  FALHAS=$((FALHAS + 1))
fi
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# =============================================================================
rotulo "PASSO 4 — checkout (depende das chaves do Stripe no ambiente)"
# =============================================================================
api POST /api/premium/checkout "$TOKEN"
if [ "$HTTP_STATUS" = "503" ]; then
  printf "  ${AMARELO}AVISO${RESET} Stripe não configurado neste ambiente (503).\n"
  printf "         Defina STRIPE_SECRET_KEY, STRIPE_PRICE_ID e STRIPE_WEBHOOK_SECRET.\n"
elif [ "$HTTP_STATUS" = "200" ]; then
  URL_STRIPE=$(printf '%s' "$CORPO" | json url)
  printf "  ${VERDE}OK${RESET}   Checkout Session criada no Stripe (modo de teste)\n"
  printf "         %s\n" "$URL_STRIPE"
  printf "         Abra a URL acima e pague com 4242 4242 4242 4242 (qualquer validade futura).\n"
else
  printf "  ${VERMELHO}ERRO${RESET} checkout respondeu %s: %s\n" "$HTTP_STATUS" "$CORPO"
  FALHAS=$((FALHAS + 1))
fi

echo
if [ "$FALHAS" -eq 0 ]; then
  printf "  ${VERDE}${NEGRITO}TODAS AS CONFERENCIAS DA ATIVIDADE 7 PASSARAM${RESET}\n"
  printf "  ${CINZA}(a cobrança em si é feita no navegador, na página do Stripe)${RESET}\n"
else
  printf "  ${VERMELHO}${NEGRITO}%d CONFERENCIA(S) FALHARAM${RESET}\n" "$FALHAS"
fi
echo
exit "$FALHAS"
