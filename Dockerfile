FROM node:22-bookworm-slim AS base
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Use the system trust store until updated Node.js removes compromised intermediate CAs, see: https://github.com/nodejs/node/pull/66871
ENV NODE_OPTIONS=--use-openssl-ca

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server/server.js"]
