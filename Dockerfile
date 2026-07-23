FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Lets docker-compose tell this build which backend to talk to (the local
# Docker backend, reachable from the browser at localhost:5000) instead of
# Vite's own dev-vs-not-dev guess, which can't tell "built for Docker"
# apart from "built for the real Vercel deployment" — both just look like
# "not dev mode" to it. Empty by default so a plain `docker build` (no
# --build-arg) still works, falling back to the existing MODE-based logic
# in authServices.js/studentService.js/SocketContext.jsx.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]