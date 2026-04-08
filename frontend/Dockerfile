FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x /app/start.sh

EXPOSE 5173

CMD ["./start.sh"]
