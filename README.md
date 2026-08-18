# Catálogo de Filmes — Tom Hanks

Aplicação web que consome a API do TMDB para exibir filmes de Tom Hanks, permitindo que cada usuário favorite e comente seus filmes preferidos.

## Funcionalidades

- **Login e cadastro** com autenticação JWT
- **Catálogo de filmes** com dados obtidos em tempo real da API do TMDB (pôster, título, sinopse)
- **Favoritar filmes** — persistido no MariaDB
- **Comentar filmes** — persistido no MariaDB
- **Isolamento de dados** — cada usuário só vê seus próprios favoritos e comentários

## Tecnologias

- **Runtime**: Bun
- **Backend**: Hono
- **Database**: MariaDB + Drizzle ORM
- **Auth**: JWT + bcrypt
- **Deploy**: Docker + Portainer

## Setup

```bash
cp .env.example .env
# Preencha as variáveis de ambiente no .env
bun install
bun run dev
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `TMDB_API_KEY` | Chave de API do TMDB |
| `DB_HOST` | Host do MariaDB |
| `DB_PORT` | Porta do MariaDB |
| `DB_USER` | Usuário do MariaDB |
| `DB_PASSWORD` | Senha do MariaDB |
| `DB_NAME` | Nome do banco de dados |
| `JWT_SECRET` | Segredo para assinatura JWT |
| `PORT` | Porta do servidor (padrão: 3000) |

## Professor

Disciplina ministrada por **@siriani**.
