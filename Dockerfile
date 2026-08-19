FROM oven/bun:latest
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ENV NODE_ENV=production
EXPOSE 8222
CMD ["bun", "run", "src/index.ts"]
