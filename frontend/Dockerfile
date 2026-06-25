FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_HOST_BACKEND=
ARG VITE_KEYCLOAK_URL=http://localhost:8092/auth
ARG VITE_KEYCLOAK_REALM=master
ARG VITE_KEYCLOAK_CLIENT_ID=multiagents-client

ENV VITE_HOST_BACKEND=$VITE_HOST_BACKEND \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
