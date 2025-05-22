FROM node:21-alpine

WORKDIR /usr/src/app

ADD ./package.json /usr/src/app/package.json
ADD ./migrate-mongo-config.js /usr/src/app/migrate-mongo-config.js
ADD ./migrations /usr/src/app/migrations

RUN yarn install --immutable

RUN yarn list migrate-mongo

CMD ["npx", "migrate-mongo", "up"]