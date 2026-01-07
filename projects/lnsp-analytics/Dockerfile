FROM node:20-alpine as build
WORKDIR /usr/src/app
COPY package.json package-lock.json* yarn.lock* ./
RUN yarn install --frozen-lockfile || npm ci
COPY . .
RUN npx nest build || ./node_modules/.bin/nest build

FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/dist ./dist
RUN yarn install --production --frozen-lockfile || npm ci --omit=dev
EXPOSE 3101
CMD ["node", "dist/main.js"]


