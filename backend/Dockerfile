# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile && pnpm prisma generate

FROM deps AS build
COPY . .
# Biên dịch cả seed: image production không chạy được ts-node
RUN pnpm build && pnpm build:seed

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
# Seed đã biên dịch đọc dữ liệu cạnh chính nó
COPY prisma/seed/data ./dist-seed/data
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3000
# Áp migration rồi chạy
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
