FROM oven/bun:latest
WORKDIR /app

# Contexto de build proprio: o catalogo nao faz parte deste servico.
COPY package.json ./
RUN bun install

COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
