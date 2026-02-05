FROM node:20-alpine AS build
WORKDIR /app
COPY duo-world/package*.json ./
RUN npm ci --prefer-offline
COPY duo-world/src ./src
COPY duo-world/public ./public
COPY duo-world/index.html duo-world/vite.config.ts duo-world/tsconfig*.json duo-world/eslint.config.js ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback + video support (byte-range requests, correct MIME types)
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 80;
    root /usr/share/nginx/html;

    location / {
        try_files $uri /index.html;
    }

    location ~* \.(mp4|webm|ogg)$ {
        types {
            video/mp4 mp4;
            video/webm webm;
            video/ogg ogg;
        }
        add_header Accept-Ranges bytes always;
        add_header Cache-Control "no-cache";
        etag on;
    }
}
NGINX
EXPOSE 80
