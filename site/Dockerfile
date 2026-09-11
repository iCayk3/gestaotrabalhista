FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/sites-env.mjs ./scripts/sites-env.mjs
COPY docker-entrypoint.mjs ./docker-entrypoint.mjs
RUN mkdir -p /data/wrangler
EXPOSE 8787
VOLUME ["/data"]
ENTRYPOINT ["node", "docker-entrypoint.mjs"]
