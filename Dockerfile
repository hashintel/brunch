FROM node:22-slim AS base
WORKDIR /app

# Distrust until updated base image removes compromised intermediate CAs, see: https://bugs.debian.org/1151413
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    sed -i \
    -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' \
    -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' \
    /etc/ca-certificates.conf && \
    update-ca-certificates && \
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
