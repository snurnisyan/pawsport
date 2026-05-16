FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json next.config.ts next-env.d.ts ./
COPY components ./components
COPY icons ./icons
COPY pages ./pages
COPY public ./public
COPY store ./store
COPY styles ./styles
COPY theme ./theme
RUN yarn build

FROM --platform=linux/amd64 node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json yarn.lock* ./
RUN yarn install --production --frozen-lockfile && yarn cache clean
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["yarn", "start"]
