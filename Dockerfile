FROM node:20-alpine AS builder

WORKDIR /app

ARG PORT
ARG DATABASE_URL

ENV PORT=$PORT \
    DATABASE_URL=$DATABASE_URL

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY prisma ./prisma
RUN yarn prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN yarn tsc

FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["yarn", "run", "start"]