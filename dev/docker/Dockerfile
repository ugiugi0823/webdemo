# Build context: dev/ directory
# docker build -f docker/Dockerfile -t llm42-demo .

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /build/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
