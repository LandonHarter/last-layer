# Next.js on mybase hosting, built with output: "standalone" (next.config.ts).
# Config comes from the site's linked secrets env (prod) at runtime, not here.
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# postinstall runs `prisma generate`, which needs the schema; the build step does it.
RUN bun install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
