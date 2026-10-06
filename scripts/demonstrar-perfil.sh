#!/bin/bash
# =============================================================================
# ISW055 · Atividade 6 · Armazenamento de objetos (upload e perfil de usuario)
# =============================================================================
# Demonstração automatizada:
#   1. Duas contas comuns + uma conta admin
#   2. O usuário comum monta o próprio perfil (bio) -> 200
#   3. Upload da foto -> arquivo vai pro MINIO, só a chave vai pro MariaDB
#   4. Validações do upload: não-imagem -> 415, foto > 2 MB -> 413
#   5. A foto volta inteira, byte a byte, pelo GET /api/perfil/:id/foto
#   6. Ver o perfil de OUTRA pessoa (GET /api/perfil/:id)
#   7. Tentativas (recusadas com 403) de editar o perfil alheio
#   8. A auditoria (continuação da atividade 5) registra os eventos
#
# Uso:
#   ./scripts/demonstrar-perfil.sh                  # http://127.0.0.1:8222
#   CATALOGO_URL=https://SEU-DOMINIO ./scripts/demonstrar-perfil.sh
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$SCRIPT_DIR")"

BASE="${CATALOGO_URL:-http://127.0.0.1:8222}"
FILME=429
CARIMBO=$(date +%s)
EMAIL_COMUM="perfil-comum-${CARIMBO}@exemplo.com"
EMAIL_OUTRO="perfil-outro-${CARIMBO}@exemplo.com"
EMAIL_ADMIN="perfil-admin-${CARIMBO}@exemplo.com"
SENHA="senha-perfil-${CARIMBO}"
BIO_TESTE="Entusiasta de Tom Hanks. Esta bio foi alterada por PATCH /api/perfil."

FIXTURE="$SCRIPT_DIR/fixtures/avatar-teste.png"

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
    printf "  ${VERDE}OK${RESET}   %-52s [%s]\n" "$desc" "$veio"
  else
    printf "  ${VERMELHO}ERRO${RESET} %-52s esperado %s, veio %s\n" "$desc" "$esperado" "$veio"
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

# Upload multipart: -F envia o arquivo com o Content-Type escolhido (o campo
# do formulario se chama `foto`, igualzinho ao que o frontend envia).
api_upload() {
  local caminho="$1" token="$2" arquivo="$3" tipo="$4"
  local resp
  resp=$(curl -s -m 30 -w $'\n%{http_code}' -X POST "${BASE}${caminho}" \
    -H "Authorization: Bearer $token" \
    -F "foto=@${arquivo};type=${tipo}")
  HTTP_STATUS="${resp##*$'\n'}"
  CORPO="${resp%$'\n'*}"
}

echo
echo "${NEGRITO}ISW055 · Atividade 6 · Armazenamento de objetos (perfil do usuario)${RESET}"
echo "API sob teste: ${BASE}"

# =============================================================================
rotulo "PASSO 1 — contas e logins"
# =============================================================================
api POST /api/register "" "{\"nome\":\"Pessoa Comum\",\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "criar conta do usuário comum" 201 "$HTTP_STATUS"

api POST /api/register "" "{\"nome\":\"Pessoa Outra\",\"email\":\"$EMAIL_OUTRO\",\"senha\":\"$SENHA\"}"
confere "criar conta de outra pessoa" 201 "$HTTP_STATUS"

api POST /api/register "" "{\"nome\":\"Perfil Admin\",\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "criar conta do futuro admin" 201 "$HTTP_STATUS"

api POST /api/login "" "{\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA\"}"
confere "login do usuário comum" 200 "$HTTP_STATUS"
TOKEN_COMUM=$(printf '%s' "$CORPO" | json token)

api POST /api/login "" "{\"email\":\"$EMAIL_OUTRO\",\"senha\":\"$SENHA\"}"
confere "login da outra pessoa" 200 "$HTTP_STATUS"
TOKEN_OUTRO=$(printf '%s' "$CORPO" | json token)

api POST /api/login "" "{\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA\"}"
confere "login do futuro admin" 200 "$HTTP_STATUS"
TOKEN_ADMIN=$(printf '%s' "$CORPO" | json token)

api GET /api/me "$TOKEN_COMUM"
ID_COMUM=$(printf '%s' "$CORPO" | json usuarioId)
api GET /api/me "$TOKEN_OUTRO"
ID_OUTRO=$(printf '%s' "$CORPO" | json usuarioId)

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

[ -n "$ID_COMUM" ] && [ -n "$ID_OUTRO" ] || {
  printf "  ${VERMELHO}ERRO${RESET} nao consegui os ids das contas\n"
  FALHAS=$((FALHAS + 1))
}

# =============================================================================
rotulo "PASSO 2 — o usuário comum monta o próprio perfil (favorito + bio)"
# =============================================================================
api POST /api/favorites "$TOKEN_COMUM" "{\"tmdb_movie_id\":$FILME,\"titulo\":\"Filme Teste Perfil\"}"
confere "comum favorita um filme (aparece no perfil)" 201 "$HTTP_STATUS"

api PATCH "/api/perfil/$ID_COMUM" "$TOKEN_COMUM" "{\"bio\":\"$BIO_TESTE\"}"
confere "comum publica a bio no próprio perfil" 200 "$HTTP_STATUS"

api GET /api/perfil "$TOKEN_COMUM"
BIO_RETORNADA=$(printf '%s' "$CORPO" | json bio)
confere "bio veio de volta no GET /api/perfil" "$BIO_TESTE" "$BIO_RETORNADA"

QTD_FAVORITOS=$(printf '%s' "$CORPO" | bun -e '
  const corpo = await new Response(process.stdin).text();
  try { process.stdout.write(String(JSON.parse(corpo).favoritos?.length ?? 0)); } catch { process.stdout.write("0"); }
')
if [ "${QTD_FAVORITOS:-0}" -ge 1 ]; then
  printf "  ${VERDE}OK${RESET}   perfil lista os filmes favoritados (%s)\n" "$QTD_FAVORITOS"
else
  printf "  ${VERMELHO}ERRO${RESET} perfil devia listar os favoritos, veio %s\n" "$QTD_FAVORITOS"
  FALHAS=$((FALHAS + 1))
fi

# =============================================================================
rotulo "PASSO 3 — upload da foto (arquivo -> MinIO, chave -> MariaDB)"
# =============================================================================
api_upload "/api/perfil/$ID_COMUM/foto" "$TOKEN_COMUM" "$FIXTURE" "image/png"
confere "upload da foto de perfil (multipart)" 201 "$HTTP_STATUS"

FOTO_URL=$(printf '%s' "$CORPO" | json fotoUrl)
if [ -n "$FOTO_URL" ]; then
  printf "  ${VERDE}OK${RESET}   a resposta traz a referencia (fotoUrl) e não o binário\n"
else
  printf "  ${VERMELHO}ERRO${RESET} fotoUrl veio vazia: %s\n" "$CORPO"
  FALHAS=$((FALHAS + 1))
fi

# Prova de que a foto "aparece de verdade": baixar a URL e comparar byte a byte.
STATUS_FOTO=$(curl -s -o /tmp/avatar-baixado.png -w '%{http_code}' -m 20 \
  "${BASE}${FOTO_URL}" -H "Authorization: Bearer $TOKEN_COMUM")
confere "GET na URL da foto devolve os bytes" 200 "$STATUS_FOTO"

CT_FOTO=$(curl -s -D - -o /dev/null -m 20 "${BASE}${FOTO_URL}" -H "Authorization: Bearer $TOKEN_COMUM" | tr -d '\r' | awk 'tolower($1)=="content-type:"{print $2}')
confere "content-type da foto servida" "image/png" "$CT_FOTO"

MD5_FIXTURE=$(md5sum "$FIXTURE" | cut -d' ' -f1)
MD5_BAIXADO=$(md5sum /tmp/avatar-baixado.png | cut -d' ' -f1)
confere "a foto baixada é idêntica à enviada (md5)" "$MD5_FIXTURE" "$MD5_BAIXADO"

# =============================================================================
rotulo "PASSO 4 — validações do upload (não-imagem e tamanho)"
# =============================================================================
printf 'isto nao e uma imagem, so um texto qualquer' > /tmp/nao-imagem.txt
api_upload "/api/perfil/$ID_COMUM/foto" "$TOKEN_COMUM" "/tmp/nao-imagem.txt" "text/plain"
confere "arquivo que não é imagem (text/plain) recusado" 415 "$HTTP_STATUS"

dd if=/dev/zero of=/tmp/foto-grande.png bs=1M count=3 2>/dev/null
api_upload "/api/perfil/$ID_COMUM/foto" "$TOKEN_COMUM" "/tmp/foto-grande.png" "image/png"
confere "foto acima de 2 MB recusada" 413 "$HTTP_STATUS"

# =============================================================================
rotulo "PASSO 5 — ver o perfil de OUTRA pessoa (rede social)"
# =============================================================================
api GET "/api/perfil/$ID_OUTRO" "$TOKEN_COMUM"
confere "GET no perfil de outra pessoa" 200 "$HTTP_STATUS"
NOME_OUTRO=$(printf '%s' "$CORPO" | json nome)
confere "nome vindo do auth-service (perfil-publico)" "Pessoa Outra" "$NOME_OUTRO"
MEU_OUTRO=$(printf '%s' "$CORPO" | json meuPerfil)
confere "marcado como perfil de OUTRO (meuPerfil=false)" "false" "$MEU_OUTRO"

# =============================================================================
rotulo "PASSO 6 — tentativa (recusada) de editar o perfil de outrem"
# =============================================================================
# O backend usa a identidade do TOKEN (auth-service/GET /me), nunca o id do
# corpo/URL. Mandou o id de outra pessoa? 403 antes de olhar o conteúdo.
api PATCH "/api/perfil/$ID_OUTRO" "$TOKEN_COMUM" "{\"bio\":\"tentativa de invadir a bio alheia\"}"
confere "comum edita a bio de outro -> 403" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

api_upload "/api/perfil/$ID_OUTRO/foto" "$TOKEN_COMUM" "$FIXTURE" "image/png"
confere "comum envia foto para o perfil de outro -> 403" 403 "$HTTP_STATUS"
printf "       %s%s%s\n" "$CINZA" "$CORPO" "$RESET"

# A bio e a foto do OUTRO seguem intactas:
api GET "/api/perfil/$ID_OUTRO" "$TOKEN_COMUM"
BIO_OUTRO_APOS=$(printf '%s' "$CORPO" | json bio)
confere "bio de outra pessoa segue intacta" "" "$BIO_OUTRO_APOS"
FOTO_OUTRO_APOS=$(printf '%s' "$CORPO" | json fotoUrl)
confere "foto de outra pessoa segue ausente" "" "$FOTO_OUTRO_APOS"

# =============================================================================
rotulo "PASSO 7 — auditoria captura os eventos (continuação da atividade 5)"
# =============================================================================
api GET "/api/logs?limite=60" "$TOKEN_ADMIN"
ACOES_NO_LOG=$(printf '%s' "$CORPO" | bun -e '
  const corpo = await new Response(process.stdin).text();
  try {
    const d = JSON.parse(corpo);
    process.stdout.write((d.eventos || []).map((e) => e.acao).join(" "));
  } catch {}
')

echo
for ACAO_ESPERADA in "upload_foto" "editar_perfil" "acao_negada"; do
  if [[ "$ACOES_NO_LOG" =~ $ACAO_ESPERADA ]]; then
    printf "  ${VERDE}OK${RESET}   evento '${ACAO_ESPERADA}' presente no log de auditoria\n"
  else
    printf "  ${AMARELO}AVISO${RESET} evento '${ACAO_ESPERADA}' não localizado nesta amostra\n"
  fi
done

echo
if [ "$FALHAS" -eq 0 ]; then
  printf "  ${VERDE}${NEGRITO}TODAS AS CONFERENCIAS DA ATIVIDADE 6 PASSARAM${RESET}\n"
else
  printf "  ${VERMELHO}${NEGRITO}%d CONFERENCIA(S) FALHARAM${RESET}\n" "$FALHAS"
fi
echo
exit "$FALHAS"