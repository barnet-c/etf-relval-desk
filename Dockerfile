# etf-relval-desk — multi-stage build for Azure Container Apps.
# Stage 1 builds the Create React App static bundle; stage 2 serves it with nginx.

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# CRA treats warnings as errors in CI; disable so lint warnings don't fail the build.
ENV CI=false
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
