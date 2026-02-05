FROM node:20-alpine AS build
WORKDIR /app
COPY duo-world/package*.json ./
RUN npm ci
COPY duo-world/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
