# 1단계: 빌드
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: nginx 로 서빙 + /api 프록시
FROM nginx:1.29-alpine
# /etc/nginx/templates/*.template 은 시작할 때 환경변수를 채워 /etc/nginx/conf.d/ 로 만들어진다
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# 게이트웨이 주소 (docker-compose.yml 에서 바꿀 수 있다)
ENV GATEWAY_URL=http://host.docker.internal:8080
EXPOSE 80
