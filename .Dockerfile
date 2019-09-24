FROM node:10-alpine

RUN apk add --no-cache --virtual .gyp python make g++ bash

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN apk del .gyp make g++ bash

CMD [ "node", "./build/index.js" ]
