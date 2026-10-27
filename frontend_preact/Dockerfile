FROM node:20-alpine

WORKDIR /app

# Instala as dependências primeiro para cache eficiente de camadas
COPY package.json package-lock.json* ./
RUN npm install

# Copia os fontes da aplicação
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
