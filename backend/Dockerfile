FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN yarn build

FROM --platform=$BUILDPLATFORM node:22-alpine AS yc-mongodb-ca
RUN apk add --no-cache ca-certificates wget && \
    mkdir -p /root/.mongodb && \
    wget "https://storage.yandexcloud.net/cloud-certs/CA.pem" \
      --output-document /root/.mongodb/root.crt && \
    chmod 0644 /root/.mongodb/root.crt

FROM --platform=linux/amd64 node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock* ./
RUN yarn install --production --frozen-lockfile && yarn cache clean
RUN mkdir -p /root/.mongodb
COPY --from=yc-mongodb-ca /root/.mongodb/root.crt /root/.mongodb/root.crt
COPY --from=build /app/dist ./dist
COPY templates ./templates
EXPOSE 4000
CMD ["node", "dist/server.js"]
