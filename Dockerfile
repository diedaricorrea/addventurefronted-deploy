# Dockerfile para Angular Frontend
# Multi-stage build: compilar y servir con Nginx

# STAGE 1: Build Angular
FROM node:20-alpine AS build
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de producción
RUN npm run build -- --configuration production

# STAGE 2: Servir con Nginx
FROM nginx:alpine

# Copiar archivos compilados de Angular
COPY --from=build /app/dist/addventure-fronted/browser /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Nginx se ejecuta automáticamente
CMD ["nginx", "-g", "daemon off;"]
