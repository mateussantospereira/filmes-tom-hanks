FROM oven/bun:latest
WORKDIR /app

# Contexto de build do CATALOGO. O .dockerignore da raiz tira daqui o
# auth-service inteiro: sao duas unidades de deploy separadas.
COPY package.json ./
RUN bun install

COPY . .
ENV NODE_ENV=production
EXPOSE 8222
CMD ["bun", "run", "src/index.ts"]
