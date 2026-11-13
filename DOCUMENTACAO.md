# DOCUMENTACAO REVERSA — Catálogo de Filmes Tom Hanks

> *Documentação gerada a posteriori, como se eu tivesse acabado de herdar este código de outra pessoa. Todos os detalhes foram extraídos lendo o código e os arquivos de configuração atuais.*

---

## 1. Especificação do Sistema — Do ponto de vista do usuário

O sistema é uma aplicação web de catálogo de filmes de Tom Hanks que permite:

- **Cadastro e login** de contas de usuário (com papéis `usuario` e `admin`)
- **Recuperação de senha** via link por e-mail (válido por 30 minutos, uso único)
- **Catálogo de filmes** consumindo a API do TMDB (The Movie Database)
- **Favoritar** e **comentar** filmes (usuários comuns podem comentar, admins podem apagar comentários de qualquer pessoa)
- **Perfil de usuário** com bio e foto de avatar (armazenada no MinIO, referência no MariaDB)
- **Plano Premium** — assinatura paga via Stripe (R$ 9,90/mês, modo teste). Usuários premium têm favoritos ilimitados (limite de 5 para usuários gratuitos)
- **Auditoria** — todos os eventos importantes (login, logout, favoritar, comentar, alterar perfil, upload de foto, ações negadas) são enviados a um stream no Redis pelo log-service
- **Acesso restrito** — o middleware `exigePermissao` no catálogo decide o que cada um pode fazer baseado nas permissões entregues pelo auth-service via `GET /me`

### Fluxos principais:

1. **Login/Register** — O usuário fornece e/senha → auth-service valida → retorna JWT + permissões → catálogo busca `GET /me` para saber quem é o usuário e o que pode fazer.
2. **Forgot password** — Usuário informa e-mail → auth-service envia link via SMTP (Mailtrap em dev, Brevo em prod) → link válido por 30 minutos, uso único → usuário define nova senha.
3. **Favoritar filme** — Usuário logado clica no coração → catálogo valida a permissão `criar:favorito` (implícita) → evento `favoritar` enviado ao log-service → Redis stream.
4. **Comentar filme** — Usuário logado digita comentário → validação de permissão `criar:comentário` → evento `comentar` enviado ao log-service.
5. **Apagar próprio comentário** — Usuário pode apagar comentário próprio (perm `apagar:comentário`). Admin pode apagar de qualquer um (perm `apagar:comentario-de-outro`).
6. **Editar perfil** — Usuário pode editar só o próprio perfil (perm `editar:perfil-proprio`). Compara `usuarioId` do token com o `:id` da URL.
7. **Upload de foto de perfil** — Usuário faz upload de imagem (validada tipo/tamanho/magic bytes) → minutos enviados ao MinIO → chave guardada no campo `foto_chave` da tabela `perfis`.
8. **Plano Premium** — Usuário acessa página de checkout → redirecionamento para Stripe Checkout (página hospedada por Stripe, cartão nunca chega ao nosso backend) → pagamento aprovado → Stripe envia webhook assinado → catálogo valida assinatura → chama rota interna `POST /interno/usuarios/:id/premium` → auth-service marca `usuarios.premium = true`.
9. **Consulta de logs (admin)** — Admin com permissão `consultar:logs` pode consultar `GET /api/logs` → eventos do stream Redis, últimos 100 em ordem cronológica.

---

## 2. Arquitetura do Sistema

O projeto atravessa as três camadas de nuvem ao mesmo tempo:

```mermaid
graph TD
    %% SaaS
    stripe[Stripe<br/>(pagamentos)]
    mail[Mailtrap / Brevo<br/>(e-mail transacional)]
    tmdb[TMDB API<br/>(dados de filmes)]

    %% PaaS - Containers (Docker)
    app[app (catálogo)<br/>porta 8222<br/>publicada]
    auth[auth-service<br/>privado, sem porta]
    redis[Redis<br/>Streams de auditoria]
    minio[MinIO<br/>(fotos de perfil)]

    %% IaaS - VM + SO
    vm[VM do Fatec<br/>Ubuntu + Docker]

    %% Redes
    docker_net[Rede Docker `interna`]

    %% Conexões
    navegador -->|HTTP| app
    app -->|AUTH_SERVICE_URL| auth
    app -->|LOG_SERVICE_URL| redis
    app -->|MINIO_ENDPOINT| minio
    app -->|STRIPE_*| stripe
    app -->|MAIL_HOST| mail
    app -->|TMDB_API_KEY| tmdb

    auth -->|banco MariaDB externo| db[[MariaDB<br/>usuarios, reset_tokens]]
    redis -->|streams| redis_img[Redis (dados)]
    minio -->|banco de referência| db

    style stripe fill:#96D4FC,color:#000
    style mail fill="#FF6B6B",color:#fff
    style tmdb fill:#77B7D9,color:#000
    style app fill:#FFF3E0,color:#000
    style auth fill:#FFF3E0,color:#000
    style redis fill:#FFF3E0,color:#000
    style minio fill:#FFF3E0,color:#000
    style vm fill="#CAE6FD",color:#000
    style docker_net fill:#E8E8E8,stroke:#666,stroke-dasharray: 5 5
```

### Detalhamento por camada:

| Camada | O que é | Quem gerencia |
|--------|---------|---------------|
| **IaaS** | VM Proxmont (Fatec) com Ubuntu + Docker | **Você**: instala e gerencia o SO, configura a rede, sobe os containers |
| **PaaS** | Containers Docker (app, auth-service, log-service, redis, minio) | **Provedor (Fatec/Proxmox)**: cuida do SO e do runtime Docker; **você**: faz deploy dos seus containers |
| **SaaS** | Stripe (pagamentos), Mailtrap/Brevo (e-mail), TMDB (dados de filmes) | **Terceiros**: cuidam de tudo; você só consome via API/painel |

---

## 3. Regras de Negócio — "Se X, então Y" (extraídas do código)

| # | Regra | Fonte do código |
|---|-------|-----------------|
| 1 | **Usuário comum só edita o próprio perfil** — `PATCH /api/perfil/:id` e `POST /api/perfil/:id/foto` comparam o `usuarioId` do token JWT com o `:id` da URL. Se forem diferentes, retorna `403` com `{"error":"Ação negada: você só pode editar o seu próprio perfil."}` | `src/middleware/permissao.ts` e rotas de perfil |
| 2 | **Admin pode apagar comentário de outro usuário** — A permissão `apagar:comentario-de-outro` concede esse direito. Usuário comum sem essa permissão recebe `403` | `auth-service/src/auth/permissoes.ts` e `src/middleware/permissao.ts` |
| 3 | **Usuário premium tem favoritos ilimitados** — O limite `LIMITE_FAVORITOS_GRATIS: 5` só se aplica usuários com `premium = false`. O campo `premium` vem do auth-service em `GET /me` | `docker-compose.yml` (variável de ambiente) e lógica de validação |
| 4 | **Link de redefinição de senha expira em 30 minutos** — O auth-service confere `expira_em` vs `agora` ao validar o token. Também confere se o token já foi usado (`usado = true`) | `auth-service/src/db/schema.ts` e `config.ts` (reset: ttlMinutos) |
| 5 | **Apenas admin pode listar usuários** — A permissão `listar:usuarios` está mapeada apenas para o papel `admin` no auth-service | `auth-service/src/auth/permissoes.ts` |
| 6 | **Apenas admin pode alterar papel de outro usuário** — A permissão `alterar:papel` está disponível apenas para `admin` | `auth-service/src/auth/permissoes.ts` |
| 7 | **Token de uso único e atômico** — O consumo do token é feito com `UPDATE ... WHERE usado = 0`. Se duas pessoas clicarem no mesmo link, só uma consegue; a outra falha na verificação de "já foi usado" | `auth-service/src/db/schema.ts` (tabela `reset_tokens`) |
| 8 | **401 = "quem é você?" (sem token/inválido/expirado)** vs **403 = "sei quem é você e você não pode"** — O sistema é fail-closed: se o auth-service cair, o catálogo recusa com 503 em vez de deixar passar | `src/middleware/auth.ts` e leitura do README |
| 9 | **Senha nunca guardada em BLOB** — A foto do perfil fica no MinIO; no MariaDB só está a chave (`foto_chave`) do objeto | `src/db/schema.ts` (tabela `perfis`) e README atividade 6 |
| 10 | **Dados de cartão de crédito nunca chegam ao backend** — O Stripe Checkout página hospeda os dados do cartão; nosso backend só recebe a confirmação por webhook assinado | README atividade 7 e fluxo de webhook |

---

## 4. Modelo de Dados — Tabelas e relações

### Tabelas principais no MariaDB:

```mermaid
erDiagram
    USUARIOS ||--o FAVORITOS: "tem muitos favoritos"
    USUARIOS ||--o COMENTARIOS: "comentou muitos"
    USUARIOS ||--1 PERFIS: "tem um perfil"
    USUARIOS ||--o ASSINATURAS: "tem uma assinatura"
    FAVORITOS }|--| TMDB: "filme TMDB"
    COMENTARIOS }|--| TMDB: "filme TMDB"

    USUARIOS {
        int id PK
        varchar nome
        varchar email UK
        varchar senhaHash
        varchar role
        timestamp criadoEm
        boolean premium
    }

    FAVORITOS {
        int id PK AI
        int usuarioId FK → usuários.id
        int tmdbMovieId
        varchar titulo
        varchar posterPath
        timestamp criadoEm
    }

    COMENTARIOS {
        int id PK AI
        int usuarioId FK → usuários.id
        int tmdbMovieId
        texto
        timestamp criadoEm
    }

    PERFIS {
        int usuarioId PK PK
        text bio
        varchar fotoChave
        timestamp atualizadoEm
    }

    ASSINATURAS {
        int usuarioId PK PK
        varchar stripeCustomerId
        varchar stripeSubscriptionId UK
        varchar status
        varchar plano
        timestamp atualizadoEm
    }
```

### Relações-chave:

- **usuários → favoritos**: 1:N (um usuário pode ter muitos favoritos; FK `usuarioId`)
- **usuários → comentarios**: 1:N (um usuário pode ter muitos comentários; FK `usuarioId`)
- **usuários → perfis**: 1:1 (perfil é exclusivo por usuário; `usuarioId` é PK própria)
- **usuários → assinaturas**: 1:1 (assinatura está ligada a um usuário; `usuarioId` é PK)
- **favoritos / comentarios → tmdbMovieId**: referência ao filme na API TMDB (não é FK formal no banco, mas o código trata como identificador)

> **Observação importante**: A tabela `usuarios` é compartilhada entre catálogo e auth-service, mas cada um tem seu próprio `tablesFilter` no `drizzle.config.ts`. O auth-service só "vê" as tabelas `usuarios` e `reset_tokens`; o catálogo só altera `favoritos`, `comentarios` e `perfis`. A divisão de responsabilidade está no código, não no banco.

---

## 5. Classificação SaaS / PaaS / IaaS deste Projeto

Cada peça do sistema fica na seguinte camada:

| Peça do Sistema | Camada | Justificativa |
|-----------------|--------|---------------|
| **VM Proxmont (Fatec) com Ubuntu** | **IaaS** | Você gerencia o Sistema Operacional (Ubuntu), instala o Docker, configura redes e volumes. O provedor entrega a máquina virtual e a rede base; o resto é por sua conta. |
| **Docker containers (app, auth-service, log-service, redis, minio)** | **PaaS** | O provedor (Fatec/Proxmox) cuida do SO e do runtime Docker. Você só faz deploy dos seus containers via `docker-compose`. Não se preocupa em reinstalar o SO a cada mudança. |
| **Stripe (pagamentos)** | **SaaS** | Você só consome uma funcionalidade via API. O número do cartão, CVV, validade são digitados na página hospedada pelo Stripe; seu backend nunca vê esses dados. Você usa o Checkout e os webhooks, não gerencia infraestrutura nenhuma. |
| **Mailtrap / Brevo (e-mail transacional)** | **SaaS** | Você consome o serviço de envio de e-mail via SMTP. Não administra servidor SMTP próprio. Em dev usa-se Mailtrap (sandbox), em prod usa Brevo (envio real). Apenas configura credenciais em variáveis de ambiente. |
| **TMDB API (dados de filmes)** | **SaaS** | Você consome uma API externa para obter dados de filmes de Tom Hanks. Não gerencia o banco de dados de filmes, nem a infraestrutura que o serve. Apenas faz requisições HTTP e processa o retorno. |
| **MinIO (fotos de perfil)** | **PaaS** (borderline) | O MinIO roda dentro de um container Docker na sua VM. Você gerencia o bucket e as credenciais, mas o armazenamento de objetos e o servidor MinIO vêm da imagem container. Fica entre PaaS e SaaS porque a lógica de armazenamento é sua, mas a execução é delegada ao container. |
| **Redis (streams de auditoria)** | **PaaS** | O Redis roda dentro de um container Docker na sua VM. Você configura o stream e o MAXLEN, mas o serviço de cache/stream em si vem do container oficial Redis. |

---

## Entrega — Próximos passos

Este arquivo `DOCUMENTACAO.md` já foi adicionado ao repositório. O `README.md` principal já contém a seção de classificação SaaS/PaaS/IaaS (adicionada durante a leitura deste documento). Todas as seções acima cobrem os 5 requisitos da atividade:

1. ✅ Classificação SaaS/PaaS/IaaS — tabela no final do documento
2. ✅ Especificação do sistema (seção 1)
3. ✅ Arquitetura (seção 2 + diagrama Mermaid)
4. ✅ Regras de negócio (seção 3)
5. ✅ Modelo de dados (seção 4)

---

> *Projeto encerrado em 16/10/2026. Série ISW055 — Catálogo de Filmes Tom Hanks.*