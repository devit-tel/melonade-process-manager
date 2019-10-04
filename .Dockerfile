FROM node:10.16.3-alpine as builder

# Init
RUN apk add --no-cache --virtual .gyp python make g++ bash
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --no-cache

# Build
COPY . .
RUN npm run build

# Cleanup
RUN npm prune --production
RUN rm -rf ./false
RUN rm -rf ./node_modules/node-rdkafka/.vscode
# RUN apk del .gyp python make g++ bash

FROM node:10.16.3-alpine

WORKDIR /usr/src/app
# RUN apk add --no-cache gcompat
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=builder /usr/src/app/build /usr/src/app/build
# Startup
CMD [ "node", "./build/index.js" ]
