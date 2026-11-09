FROM node:22-alpine

WORKDIR /app

# Dependencias (incluye devDependencies: nodemon para hot-reload)
COPY package*.json ./
RUN npm ci && chown -R node:node /app

# El código fuente (src/) se monta como volumen en docker-compose.yml
ENV NODE_ENV=development
EXPOSE 3000

USER node

CMD ["npm", "run", "dev"]
