FROM node:10.16.3 as builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:10.16.3-alpine
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app .

CMD [ "node", "./build/index.js" ]
