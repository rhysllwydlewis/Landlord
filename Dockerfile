# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Keep the production recipe compatible with hosts that reject secret mounts.
RUN npm ci --strict-ssl=true
COPY . .
ARG DATABASE_URL=postgresql://build:unused@localhost:5432/build
ARG NEXT_PUBLIC_PRODUCT_NAME="Property Management Platform"
ARG NEXT_PUBLIC_ACCENT="#185b4c"
ENV DATABASE_URL=$DATABASE_URL NEXT_PUBLIC_PRODUCT_NAME=$NEXT_PUBLIC_PRODUCT_NAME NEXT_PUBLIC_ACCENT=$NEXT_PUBLIC_ACCENT NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN groupadd --gid 1001 app && useradd --uid 1001 --gid app --create-home app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3000
CMD ["npm","start"]
