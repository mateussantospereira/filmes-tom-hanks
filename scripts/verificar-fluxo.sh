#!/usr/bin/env bash
# =============================================================================
# scripts/verificar-fluxo.sh
#
# Roteiro automatizado da demonstracao da atividade 3 (esqueci minha senha).
# Roda contra o catalogo ja no ar (o unico servico com porta publicada).
#
#   Fase 1 (sem token): cadastro, login, /me, e o pedido do link por e-mail.
#          -> abra o e-mail no Mailtrap, copie o link e anote o token
#
#   Fase 2 (com token): troca a senha pelo link, e demonstra as tres recusas
#          do requisito 6 (inexistente, ja usado, expirado).
#
# Uso:
#   ./scripts/verificar-fluxo.sh                          # fase 1
#   ./scripts/verificar-fluxo.sh fase2 <token>            # fase 2
#   CATALOGO_URL=https://meu-subdominio ./scripts/verificar-fluxo.sh
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$SCRIPT_DIR")"

CATALOGO_URL="${CATALOGO_URL:-http://localhost:8222}"
EMAIL="${EMAIL:-aluno-$(date +%s)@exemplo.com}"
SENHA_INICIAL="senha-inicial-123"
SENHA_NOVA="senha-nova-456"
FALHAS=0

verde() { printf '\033[0;32m%s\033[0m\n' "$1"; }
vermelho() { printf '\033[0;31m%s\033[0m\n' "$1"; }
titulo() { printf '\n\033[1m%s\033[0m\n' "── $1"; }

# confere status HTTP esperado; imprime o corpo quando da errado
# uso: conferir <descricao> <status esperado> <url> [metodo] [corpo] [token]
conferir() {
  local descricao="$1" esperado="$2" url="$3" metodo="${4:-POST}" corpo="${5:-}" token="${6:-}"
  local resposta status
  local -a opcoes=(-s -m 10 -w "\n%{http_code}" -X "$metodo" "$url")

  [ -n "$token" ] && opcoes+=(-H "Authorization: Bearer $token")
  if [ -n "$corpo" ]; then
    opcoes+=(-H 'Content-Type: application/json' -d "$corpo")
  fi

  resposta=$(curl "${opcoes[@]}")
  status=$(echo "$resposta" | tail -1)
  local texto=$(echo "$resposta" | sed '$d')

  if [ "$status" = "$esperado" ]; then
    verde "  OK   $descricao [HTTP $status] ${texto}"
  else
    vermelho "  FALHA $descricao — esperado $esperado, veio $status — ${texto}"
    FALHAS=$((FALHAS + 1))
  fi
}

FASE="${1:-fase1}"

if [ "$FASE" = "fase1" ]; then
  titulo "FASE 1 — cadastro, login, papel do usuario e pedido do link"
  echo "  Catalogo: $CATALOGO_URL"
  echo "  E-mail de teste: $EMAIL"

  conferir "cadastro de novo usuario" 201 "$CATALOGO_URL/api/register" POST \
    "{\"nome\":\"Aluno de Teste\",\"email\":\"$EMAIL\",\"senha\":\"$SENHA_INICIAL\"}"

  conferir "cadastro repetido (email já em uso)" 409 "$CATALOGO_URL/api/register" POST \
    "{\"nome\":\"Aluno de Teste\",\"email\":\"$EMAIL\",\"senha\":\"$SENHA_INICIAL\"}"

  conferir "login com senha errada é recusado" 401 "$CATALOGO_URL/api/login" POST \
    "{\"email\":\"$EMAIL\",\"senha\":\"senha-errada\"}"

  LOGIN=$(curl -s -m 10 -X POST "$CATALOGO_URL/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA_INICIAL\"}")
  TOKEN=$(echo "$LOGIN" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
  if [ -n "$TOKEN" ]; then
    verde "  OK   login devolve token e papel: ${LOGIN}"
  else
    vermelho "  FALHA login nao devolveu token: ${LOGIN}"
    FALHAS=$((FALHAS + 1))
  fi

  conferir "papel do usuario, perguntado ao auth-service" 200 \
    "$CATALOGO_URL/api/me" GET "" "$TOKEN"

  conferir "favoritar filme com sessao valida" 201 "$CATALOGO_URL/api/favorites" POST \
    '{"tmdb_movie_id":429,"titulo":"Um Sonho de Liberdade","poster_path":"/poster.jpg"}' "$TOKEN"

  conferir "comentar filme com sessao valida" 201 "$CATALOGO_URL/api/comments" POST \
    '{"tmdb_movie_id":429,"texto":"Comentario de verificacao automatica"}' "$TOKEN"

  conferir "acesso sem token é recusado" 401 "$CATALOGO_URL/api/favorites" GET

  conferir "token adulterado é recusado" 401 "$CATALOGO_URL/api/favorites" GET "" "$TOKEN-adulterado"

  conferir "pedido de recuperacao de senha" 200 "$CATALOGO_URL/api/forgot-password" POST \
    "{\"email\":\"$EMAIL\"}"

  conferir "pedido para e-mail inexistente (resposta igual, nao revela quem tem conta)" 200 \
    "$CATALOGO_URL/api/forgot-password" POST '{"email":"ninguem-cadastrado@exemplo.com"}'

  titulo "FASE 1 concluida"
  echo "  1. Abra o e-mail no Mailtrap (https://mailtrap.io) e copie o link."
  echo "  2. Confira no banco: SELECT criado_em, expira_em, usado FROM reset_tokens;"
  echo "     a diferenca entre criado_em e expira_em tem que ser 30 minutos."
  echo "  3. Rode a fase 2 com o token do link:"
  echo "     ./scripts/verificar-fluxo.sh fase2 <token>"

elif [ "$FASE" = "fase2" ]; then
  TOKEN_LINK="${2:-}"
  EMAIL="${3:-$EMAIL}"
  if [ -z "$TOKEN_LINK" ]; then
    vermelho "Uso: $0 fase2 <token-do-link> [email]"
    exit 1
  fi

  titulo "FASE 2 — troca de senha e as tres recusas do requisito 6"
  echo "  Catalogo: $CATALOGO_URL"
  echo "  Token do link: $TOKEN_LINK"

  conferir "link inexistente é recusado" 400 "$CATALOGO_URL/api/reset-password" POST \
    "{\"token\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"novaSenha\":\"$SENHA_NOVA\"}"

  conferir "senha curta é recusada" 400 "$CATALOGO_URL/api/reset-password" POST \
    "{\"token\":\"$TOKEN_LINK\",\"novaSenha\":\"123\"}"

  conferir "troca de senha pelo link valido" 200 "$CATALOGO_URL/api/reset-password" POST \
    "{\"token\":\"$TOKEN_LINK\",\"novaSenha\":\"$SENHA_NOVA\"}"

  conferir "MESMO link usado de novo é recusado" 400 "$CATALOGO_URL/api/reset-password" POST \
    "{\"token\":\"$TOKEN_LINK\",\"novaSenha\":\"outra-senha-789\"}"

  conferir "login com a senha antiga é recusado" 401 "$CATALOGO_URL/api/login" POST \
    "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA_INICIAL\"}"

  conferir "login com a senha nova funciona" 200 "$CATALOGO_URL/api/login" POST \
    "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA_NOVA\"}"

  titulo "FASE 2 concluida"
  echo "  Para provar a EXPIRACAO de 30 minutos sem esperar:"
  echo "    a) suba o auth-service com RESET_TOKEN_TTL_MINUTES=1, peça um link,"
  echo "       espere 1 minuto e tente usar; ou"
  echo "    b) no banco: UPDATE reset_tokens SET expira_em = DATE_SUB(NOW(), INTERVAL 1 MINUTE);"
  echo "       e tente usar o link (a resposta deve ser 'Este link expirou')."

elif [ "$FASE" = "rbac" ]; then
  titulo "ATIVIDADE 4 — RBAC: controle de acesso por papel"
  echo "  Catalogo: $CATALOGO_URL"

  EMAIL_AUTOR="autor-$(date +%s)@exemplo.com"
  EMAIL_COMUM="outro-$(date +%s)@exemplo.com"
  SENHA_PADRAO="senha-123456"

  # 1. Cadastra o autor do comentario
  conferir "cadastro do autor do comentario (papel: usuario)" 201 "$CATALOGO_URL/api/register" POST \
    "{\"nome\":\"Usuario Autor\",\"email\":\"$EMAIL_AUTOR\",\"senha\":\"$SENHA_PADRAO\"}"
  LOGIN_AUTOR=$(curl -s -m 10 -X POST "$CATALOGO_URL/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL_AUTOR\",\"senha\":\"$SENHA_PADRAO\"}")
  TOKEN_AUTOR=$(echo "$LOGIN_AUTOR" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

  # 2. Cadastra outro usuario comum
  conferir "cadastro de outro usuario comum (papel: usuario)" 201 "$CATALOGO_URL/api/register" POST \
    "{\"nome\":\"Outro Usuario\",\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA_PADRAO\"}"
  LOGIN_COMUM=$(curl -s -m 10 -X POST "$CATALOGO_URL/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL_COMUM\",\"senha\":\"$SENHA_PADRAO\"}")
  TOKEN_COMUM=$(echo "$LOGIN_COMUM" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)

  # 3. Autor publica um comentario no filme 429
  conferir "autor publica comentario no catalogo" 201 "$CATALOGO_URL/api/comments" POST \
    '{"tmdb_movie_id":429,"texto":"Comentario original para teste de moderacao RBAC"}' "$TOKEN_AUTOR"

  # Obtem o ID do comentario criado
  COMMENTS_LIST=$(curl -s -m 10 -H "Authorization: Bearer $TOKEN_AUTOR" "$CATALOGO_URL/api/comments/429")
  COMMENT_ID=$(echo "$COMMENTS_LIST" | grep -oE '"id":[0-9]+' | tail -1 | cut -d':' -f2)
  echo "  ID do comentario criado: $COMMENT_ID"

  # 4. Outro usuario comum tenta apagar o comentario do autor -> RECUSA COM 403
  conferir "usuario comum tenta apagar comentario de outro (RECUSA COM 403 FORBIDDEN)" 403 \
    "$CATALOGO_URL/api/comments/$COMMENT_ID" DELETE "" "$TOKEN_COMUM"

  # 5. Administrador apaga o comentario de outro usuario -> SUCESSO 200
  TOKEN_ADMIN="${ADMIN_TOKEN:-}"
  if [ -z "$TOKEN_ADMIN" ]; then
    EMAIL_ADMIN="admin-fluxo-$(date +%s)@exemplo.com"
    conferir "cadastro do admin (papel: usuario)" 201 "$CATALOGO_URL/api/register" POST \
      "{\"nome\":\"Usuario Admin\",\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA_PADRAO\"}"
    if [ -f "$RAIZ/.env.portainer" ] && [[ "$CATALOGO_URL" =~ lapps\.studio|https?://[^1l] ]]; then
      (cd "$RAIZ/auth-service" && bun --env-file="$RAIZ/.env.portainer" run criar-admin "$EMAIL_ADMIN" >/dev/null 2>&1)
    else
      (cd "$RAIZ/auth-service" && bun run criar-admin "$EMAIL_ADMIN" >/dev/null 2>&1)
    fi
    LOGIN_ADMIN=$(curl -s -m 10 -X POST "$CATALOGO_URL/api/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL_ADMIN\",\"senha\":\"$SENHA_PADRAO\"}")
    TOKEN_ADMIN=$(echo "$LOGIN_ADMIN" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
  fi

  if [ -n "$TOKEN_ADMIN" ]; then
    conferir "administrador apaga comentario de outro usuario (MODERACAO PERMITIDA COM 200 OK)" 200 \
      "$CATALOGO_URL/api/comments/$COMMENT_ID" DELETE "" "$TOKEN_ADMIN"
  else
    vermelho "  FALHA nao foi possivel obter o token do administrador"
    FALHAS=$((FALHAS + 1))
  fi
else
  vermelho "Fase desconhecida: $FASE (use fase1, fase2 ou rbac)"
  exit 1
fi

echo
if [ "$FALHAS" -eq 0 ]; then
  verde "TODAS AS CONFERENCIAS PASSARAM"
else
  vermelho "$FALHAS CONFERENCIA(S) FALHARAM"
fi
exit "$FALHAS"
