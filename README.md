# Catálogo de Filmes — Tom Hanks

Aplicação web que consome a API do TMDB para exibir filmes de Tom Hanks, permitindo que cada usuário favorite e comente seus filmes preferidos.

**Atividade 3 — Serviços desacoplados.** Nesta versão a autenticação saiu do catálogo e virou um microsserviço próprio. O repositório é o mesmo da atividade 2; o que mudou está em [O que mudou](#o-que-mudou).

---

## O que mudou

Na atividade 2 tudo morava num container só: o catálogo tinha a página de login, o cadastro, a emissão do JWT, a validação do token, a consulta da senha e a tabela de usuários. Isso é um **monólito** — para mexer na autenticação era preciso derrubar e republicar a aplicação inteira, e qualquer falha no login derrubava também o catálogo de filmes.

Agora são **dois serviços** que conversam pela rede do Docker:

| | Atividade 2 | Atividade 3 |
|---|---|---|
| Containers | 1 | 2 (`app` + `auth-service`) |
| Autenticação | dentro do catálogo | em um microsserviço separado |
| Segredo do JWT | no catálogo | só no `auth-service` |
| Portas publicadas | 8222 | 8222 (só a do catálogo) |
| Recuperar senha | não existia | e-mail com link de 30 minutos |
| Papéis (role) | não existia | `usuario` e `admin` |

O que **não** mudou: a URL de acesso, o banco de dados, o nome do stack no Portainer e o frontend. Quem tinha conta continua com conta.

```
                      internet
                         │
          ┌──────────────▼───────────────┐
          │  app   (container `app`)      │  ← único ponto de entrada público
          │  porta 8222 publicada         │
          │                               │
          │  catálogo de filmes           │
          │  favoritos · comentários      │
          │  ✗ NÃO valida JWT             │
          │  ✗ NÃO consulta senhas        │
          └──────────────┬───────────────┘
                         │  HTTP pela rede interna do Docker:
                         │  GET  /api/me                 (quem sou eu?)
                         │  POST /api/login
                         │  POST /api/register
                         │  POST /api/forgot-password
                         ▼  http://auth-service:3000
          ┌───────────────────────────────┐
          │  auth-service                 │  ← SEM `ports:`
          │  cadastro · login             │     inalcançável da internet
          │  papéis (role)                │
          │  recuperação de senha         │
          │  guarda o segredo do JWT      │
          └──────────────┬───────────────┘
                         │
          ┌──────────────▼───────────────┐
          │  MariaDB (externo ao compose) │
          │  usuarios, reset_tokens   ← dono: auth-service
          │  favoritos, comentários   ← dono: app
          └──────────────────────────────┘
```

Os dois containers dividilham a rede `interna` (bridge do Docker). Dentro dela o nome `auth-service` resolve para o container do auth-service; fora dela esse nome não existe. É por isso que o link de redefinição de senha volta a entrar pelo catálogo, e nunca pelo auth-service: o navegador do usuário não tem como alcançar um serviço que não publica porta.

### Por que o catálogo não guarda mais o `JWT_SECRET`

Segredo que fica do lado de quem valida não protege nada: qualquer um com acesso ao container do catálogo poderia forjar um token de administrador. Tirar o segredo do catálogo e deixá-lo só no serviço que emite é o que dá consequência prática à separação, e não só diagramas.

### O preço da separação (e por que foi aceito)

O catálogo não valida mais nada sozinho: para saber quem é o usuário, ele faz uma chamada HTTP. Se o `auth-service` estiver fora, tudo que depende de sessão responde **503**, e o catálogo continua no ar servindo o catálogo de filmes.

Essa é uma troca consciente, e é o tipo de coisa que a atividade quer que a gente perceba: **desacoplar de verdade custa uma dependência de rede a mais no caminho crítico**. Se o auth-service cair, ninguém loga — mas ninguém também perde o catálogo. No monólito, uma falha no login derrubava tudo junto.

---

## O `docker-compose.yml` de dois serviços

```yaml
services:
  app:                              # o único container com porta publicada
    build: .
    ports:
      - "8222:8222"
    environment:
      <<: *db                        # mesmo MariaDB da atividade 2
      TMDB_API_KEY: ${TMDB_API_KEY}
      AUTH_SERVICE_URL: http://auth-service:3000
      PORT: "8222"
    depends_on:
      - auth-service
    networks:
      - interna

  auth-service:                     # ✗ sem `ports:` — de propósito
    build: ./auth-service
    environment:
      <<: *db
      NODE_ENV: production
      PORT: "3000"
      JWT_SECRET: ${JWT_SECRET}     # o segredo mora só aqui
      APP_PUBLIC_URL: ${APP_PUBLIC_URL}
      MAIL_HOST: ${MAIL_HOST}
      MAIL_USER: ${MAIL_USER}
      MAIL_PASSWORD: ${MAIL_PASSWORD}
      MAIL_FROM: ${MAIL_FROM}
      # ...
    networks:
      - interna

networks:
  interna:
    driver: bridge
```

O bloco `x-db: &db` é um *anchor* de YAML: as credenciais do MariaDB são escritas uma vez e reaproveitadas pelos dois serviços, para não ficarem duplicadas e divergentes.

### O `auth-service` não publica porta nenhuma

Repare que o serviço `auth-service` **não tem `ports:`**. É o ponto da atividade: o serviço de autenticação existe dentro da rede, e o navegador nunca fala direto com ele.

**Como comprovar:**

```bash
docker compose ps
```

```
NAME                          IMAGE         PORTS
catalogo-app-1                ...           0.0.0.0:8222->8222/tcp
catalogo-auth-service-1       ...           (nada)
```

O `app` aparece com `8222->8222`; o `auth-service` aparece sem nenhuma porta. Só o primeiro é alcançável de fora da máquina.

### Um banco, dois donos

Os dois serviços apontam para o **mesmo** MariaDB (externo ao compose, como na atividade 2), mas cada um é dono de um par de tabelas. A divisão é feita no código, pelo `drizzle.config.ts` do auth-service:

```ts
tablesFilter: ["usuarios", "reset_tokens"]
```

Assim o `db:push` do auth-service nunca toca em `favoritos` e `comentarios`, que são do catálogo. E o inverso também vale: o catálogo não altera mais tabela de ninguém.

---

## Papéis (roles)

Dois papéis: **`usuario`** (padrão, atribuído no cadastro) e **`admin`**. Não existe tela de administração nesta atividade — o papel é um dado da conta.

Quando o catálogo precisa saber quem é o usuário, ele pergunta ao auth-service:

```
GET /me  →  { "usuarioId": 6, "nome": "Ana", "email": "ana@exemplo.com", "role": "admin" }
```

O papel vem **do banco**, não de dentro do token. Assim, promover alguém a `admin` tem efeito no request seguinte, sem esperar o token expirar.

Para promover alguém:

```sql
UPDATE `usuarios` SET `role` = 'admin' WHERE `email` = 'voce@exemplo.com';
```

Para ver o efeito: o dono de um comentário pode apagá-lo; um `usuario` que não é dono recebe **403**; um `admin` apaga o comentário de outra pessoa.

---

## Recuperação de senha

### A tabela `reset_tokens`

```sql
CREATE TABLE `reset_tokens` (
  `id`         int AUTO_INCREMENT NOT NULL,
  `token`      varchar(64) NOT NULL,   -- 32 bytes aleatórios em hexadecimal
  `usuario_id` int NOT NULL,           -- de quem é o link
  `criado_em`  timestamp NOT NULL,     -- quando o link foi gerado
  `expira_em`  timestamp NOT NULL,     -- criado_em + 30 minutos
  `usado`      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (`id`),
  UNIQUE (`token`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
);
```

`criado_em` e `expira_em` são calculados pelo **banco** (`NOW()` e `DATE_ADD(NOW(), INTERVAL 30 MINUTE)`), não pelo container. Se o relógio do container e o do MariaDB divergirem, o prazo continua correto.

### As três validações do link

Quando alguém abre o link, o auth-service confere **três** coisas. Qualquer uma que falhe, a senha não muda:

| # | Verificação | Se falhar |
|---|-------------|-----------|
| 1 | o token existe? | `400` — *"Link inválido. Peça um novo link de recuperação de senha."* |
| 2 | ainda não passou de `expira_em`? | `400` — *"Este link expirou (válido por 30 minutos). Peça um novo link."* |
| 3 | ainda não foi usado? | `400` — *"Este link já foi utilizado. Peça um novo link..."* |

O consumo do token é atômico — um `UPDATE ... WHERE usado = 0`. Se duas pessoas clicarem no mesmo link no mesmo segundo, só uma consegue; a outra cai na verificação 3.

### E-mail de verdade: Mailtrap (dev) e Brevo (prod)

O envio é real via SMTP (nodemailer) — o e-mail chega na caixa de entrada, não aparece na tela.

| | Desenvolvimento | Produção |
|---|---|---|
| Serviço | **Mailtrap** (Email Sandbox) | **Brevo** (envio real, camada gratuita) |
| Host | `smtp.mailtrap.io` (ou `sandbox.smtp.mailtrap.io`) | `smtp-relay.brevo.com` |
| Porta | `2525` | `587` |
| Entrega | chega na inbox da sua conta Mailtrap | chega no e-mail real do usuário |

Os dois hosts do Mailtrap são o mesmo serviço e ambos funcionam — a tela do
sandbox nowadays mostra `sandbox.smtp.mailtrap.io`, mas `smtp.mailtrap.io`
continua válido. O que é diferente entre eles é o **par usuário/senha**: o
sandbox tem credenciais próprias, geradas na tela **Settings / Integrations →
SMTP** do seu sandbox, que *não* são o API token da conta. Token de API não
funciona como credencial SMTP — dá `535 Invalid credentials`.

O código é o mesmo nas duas: muda só o destino. Para alternar, troque o bloco correspondente no `.env`.

No sandbox do Mailtrap, o remetente (`MAIL_FROM`) deve ser o endereço que a
própria tela do sandbox oferece. E-mail de exemplo (`catalogo@exemplo.com`) não
serve. Se o envio for recusado, o log do container traz o motivo exato do SMTP.

Para conferir as credenciais sem enviar e-mail nenhum (não gasta a cota do
sandbox), no console do container:

```bash
docker compose exec auth-service bun -e "
import nodemailer from 'nodemailer';
const t = nodemailer.createTransport({host:process.env.MAIL_HOST,port:+process.env.MAIL_PORT,secure:false,auth:{user:process.env.MAIL_USER,pass:process.env.MAIL_PASSWORD}});
await t.verify();
console.log('SMTP OK');
"
```

### Passo a passo da demonstração

1. Na tela de login, clique em **"Esqueci minha senha"**.
2. Preencha o e-mail e envie.
3. **Abra o Mailtrap** (https://mailtrap.io → Inbox). O e-mail chega em segundos, com o botão de redefinição. Print para a atividade.
4. Clique no link. O navegador abre `/reset-password?token=...` **no catálogo**, com o formulário de nova senha.
5. Troque a senha e faça login com a nova. **Funcionou.**

Para a **tentativa recusada**, use o mesmo link mais de uma vez:

- **Token já usado:** repita o passo 5 com o mesmo token → `400`, *"Este link já foi utilizado"*.
- **Token expirado:** faça o passo 5 mais de 30 minutos depois → `400`, *"Este link expirou"*. Sem esperar 30 minutos para provar na demonstração, suba o container com `RESET_TOKEN_TTL_MINUTES=1` e mostre o mesmo resultado em 1 minuto — a lógica de expiração é a mesma, e a mensagem muda junto ("válido por 1 minuto").
- **Token inválido:** abra `/reset-password?token=inventado` → `400`, *"Link inválido"*.

Existe um script que roda a parte automatizada disso:

```bash
./scripts/verificar-fluxo.sh          # fase 1: cadastro, login, papéis, e-mail
./scripts/verificar-fluxo.sh fase2   # fase 2: usa o link e prova a recusa
```

---

## Segurança — o que foi levado a sério

- **Sem enumeração de usuário.** O "esqueci minha senha" responde `200` com a mesma mensagem tanto para um e-mail cadastrado quanto para um e-mail inventado. Caso contrário, dava para usar o formulário para descobrir quem tem conta no sistema.
- **Token de uso único e atômico.** Descrito acima.
- **Segredo fora do catálogo.** Ver [aqui](#por-que-o-catálogo-não-guarda-mais-o-jwt_secret).
- **Só o último pedido vale.** Pedir a recuperação de novo apaga o token pendente anterior.

**O que daria para endurecer e não foi feito** (anotado de propósito, porque esconder essas escolhas seria enganoso):

- O `token` é gravado em texto puro no banco. O mais defensável seria guardar apenas o hash do token e mandar o valor original por e-mail — assim, quem lê o banco não consegue forjar links. A tabela pedida na atividade tem a coluna `token`, então segui a especificação.
- Não há limite de tentativas por IP no "esqueci minha senha" nem no login.
- O JWT continua sem revogação: trocar a senha não derruba as sessões já abertas.

---

## Tecnologias

- **Runtime**: Bun
- **Backend**: Hono (nos dois serviços)
- **Database**: MariaDB + Drizzle ORM
- **Auth**: JWT + bcrypt, **dentro do auth-service**
- **E-mail**: nodemailer (SMTP)
- **Deploy**: Docker + Portainer

---

## Deploy no Portainer

### 1. Migration do banco (só se ela ainda não tiver sido aplicada)

O `auth-service` precisa da coluna `role` em `usuarios` e da tabela `reset_tokens`. **Se o banco já estiver no estado da atividade 3, pule este passo.**

A forma de saber é deployar e olhar o container: o `auth-service` confere o próprio schema no boot, e o `/health` responde `503` se faltar algo. Deploy com o schema errado não quebra nada — o catálogo continua no ar, e só o que depende de sessão dá erro até a migration rodar.

Se o `/health` responder `200`, acabou. Se responder `503`, rode a migration:

Abra o **console do container** `auth-service` no Portainer:

```bash
bun run db:migrate
```

```
[migrate] alvo: catalogo@SEU_HOST:3306/SEU_BANCO
[migrate] 3 comando(s) em sql/atividade-3.sql
  [aplicado]  ALTER TABLE `usuarios`
  [aplicado]  CREATE TABLE `reset_tokens` (
  [aplicado]  CREATE INDEX `reset_tokens_usuario_idx` ...
[migrate] pronto — coluna `role` e tabela `reset_tokens` criadas.
```

Ou, a partir da máquina que tem o Docker, com o `.env` local preenchido:

```bash
docker compose run --rm auth-service bun run db:migrate
```

O script é idempotente: rodar duas vezes não faz estrago, e se a aplicação falhar no meio ele completa o que falta.

> O usuário do banco precisa de permissão de `ALTER` e `CREATE`. A migration não apaga nem altera dados existentes — todos os usuários atuais nascem com `role = 'usuario'`.
>
> Se a migration não tiver sido aplicada, o serviço avisa no log na partida e o `/health` responde `503`, então o container aparece como **unhealthy** no Portainer, em vez de falhar só quando alguém tenta logar.

### 2. Variáveis de ambiente

As mesmas da atividade 2, mais as do novo serviço:

| Variável | Serviço | Valor |
|----------|---------|-------|
| `TMDB_API_KEY` | app | o mesmo de antes |
| `AUTH_SERVICE_URL` | app | `http://auth-service:3000` (já vem no compose) |
| `AUTH_SERVICE_TIMEOUT_MS` | app | opcional, padrão `5000` |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | os dois | os mesmos de antes |
| `JWT_SECRET` | **só o auth-service** | **mantenha o mesmo** — trocar desloga todo mundo |
| `JWT_EXPIRES_IN` | auth-service | `24h` |
| `APP_PUBLIC_URL` | auth-service | **a URL que você abre no navegador**, ex. `https://seu-subdominio/` |
| `RESET_TOKEN_TTL_MINUTES` | auth-service | `30` |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USER` `MAIL_PASSWORD` `MAIL_FROM` | auth-service | Mailtrap (dev) ou Brevo (prod) |
| `MAIL_FROM_NAME` | auth-service | `Catálogo de Filmes` |

`APP_PUBLIC_URL` é a mais fácil de errar e a mais importante: é por ela que o link de redefinição é montado. Se o e-mail chega com link quebrado, é esse valor.

### 3. Atualizar o stack

"Update the stack", com rebuild — os dois containers mudaram.

**Não é preciso** criar rede, criar volume, mudar o proxy ou abrir porta. A rede `interna` é criada pelo próprio compose, e o proxy reverso continua apontando para `8222`: o auth-service não publica porta, então não há o que configurar para ele.

### Rodando localmente

```bash
cp .env.example .env          # preencha
bun install
cd auth-service && bun install && cd ..
docker compose up --build
```

Sem Docker, dá para subir os dois em terminais separados:

```bash
# terminal 1 — auth-service (porta 3000)
cd auth-service && bun run dev

# terminal 2 — catálogo (porta 8222)
AUTH_SERVICE_URL=http://localhost:3000 bun run dev
```

### Conferindo que está tudo certo

```bash
# 1. o catálogo responde
curl -s localhost:8222/login | head -1

# 2. o auth-service responde, de dentro da rede do Docker
docker compose exec app bun -e "fetch('http://auth-service:3000/health').then(r=>r.text()).then(console.log)"

# 3. o fluxo inteiro, automatizado
./scripts/verificar-fluxo.sh
```

---

## Estrutura do projeto

```
.
├── docker-compose.yml        dois serviços + a rede interna
├── src/                      container `app` — o catálogo
│   ├── index.ts
│   ├── middleware/auth.ts    pergunta ao auth-service quem é o usuário
│   ├── routes/auth.ts        gateway: só repassa para o auth-service
│   ├── services/
│   │   └── auth-service.ts   cliente HTTP do auth-service
│   └── public/               frontend (login, catálogo, /reset-password)
│
├── auth-service/             container `auth-service` — contexto de build próprio
│   ├── Dockerfile
│   ├── drizzle.config.ts     tablesFilter: só as tabelas deste serviço
│   ├── sql/atividade-3.sql   a migration
│   └── src/
│       ├── index.ts
│       ├── config.ts         variáveis de ambiente, validadas na partida
│       ├── mail.ts           envio via SMTP
│       ├── routes/auth.ts    register · login · me
│       ├── routes/password.ts forgot-password · reset-password
│       └── services/reset-token.ts   gerar · validar · consumir o token
│
└── scripts/verificar-fluxo.sh
```

O `auth-service` tem contexto de build próprio: ele **não** está dentro da imagem do catálogo, e o `.dockerignore` da raiz exclui a pasta dele do build do `app`. São duas unidades de deploy separadas, como deve ser.

---

## Professor

Disciplina ministrada por **@siriani** — <https://github.com/siriani>.
