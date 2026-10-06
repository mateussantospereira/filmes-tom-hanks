FROM oven/bun:latest
WORKDIR /app

# Contexto de build proprio: nem o catalogo nem o auth-service fazem parte
# deste servico. Cada microsservico tem seu package.json e seu Dockerfile —
# e assim que se garante que um container nao carrega codigo do outro.
COPY package.json ./
RUN bun install

COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
