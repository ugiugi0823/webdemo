# Build context: WEBDEMO root directory
# docker build -f prod/Dockerfile -t llm42-demo .

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build
COPY dev/package*.json ./
RUN npm ci

COPY dev/ ./
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /build/dist /usr/share/nginx/html
COPY prod/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
