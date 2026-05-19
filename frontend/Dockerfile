FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile

FROM --platform=$BUILDPLATFORM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/yarn.lock* ./
RUN yarn install --frozen-lockfile

FROM --platform=$BUILDPLATFORM node:22-alpine AS api-types
WORKDIR /app/frontend
ENV MONGODB_URI=mongodb://localhost:27017/pawsport_test
ENV JWT_SECRET=build-time-openapi-secret
ENV SMTP_HOST=localhost
ENV SMTP_PORT=1025
ENV SMTP_USER=build
ENV SMTP_PASSWORD=build
ENV SMTP_FROM=build@example.com
ENV S3_ENDPOINT=http://localhost:9000
ENV S3_REGION=us-east-1
ENV S3_BUCKET=pawsport
ENV S3_ACCESS_KEY_ID=build
ENV S3_SECRET_ACCESS_KEY=build
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY --from=backend-deps /app/backend/node_modules ../backend/node_modules
COPY frontend/package.json ./
COPY backend/package.json backend/tsconfig.json ../backend/
COPY backend/scripts ../backend/scripts
COPY backend/src ../backend/src
RUN mkdir -p types && yarn gen:api

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.ts frontend/next-env.d.ts ./
COPY frontend/components ./components
COPY frontend/icons ./icons
COPY frontend/lib ./lib
COPY frontend/pages ./pages
COPY frontend/public ./public
COPY frontend/store ./store
COPY frontend/styles ./styles
COPY frontend/theme ./theme
COPY frontend/types ./types
COPY frontend/utils ./utils
COPY --from=api-types /app/frontend/types/api.ts ./types/api.ts
RUN yarn build

FROM --platform=linux/amd64 node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --production --frozen-lockfile && yarn cache clean
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["yarn", "start"]
