# Frontend container — the Module 7 lab's Dockerfile structure.
FROM node:lts

WORKDIR /app

# Dependencies first so a source-only change does not reinstall them.
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
