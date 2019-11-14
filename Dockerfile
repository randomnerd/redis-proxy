FROM node:12-alpine as builder
RUN apk add ca-certificates python build-base git
WORKDIR /home/node/app
COPY package.json yarn.lock tsconfig.json jest.config.js ./
RUN yarn install
COPY ./src ./src
RUN yarn build

FROM node:12-alpine
EXPOSE 3000
STOPSIGNAL SIGINT
RUN apk --no-cache add ca-certificates git
WORKDIR /home/node/app
COPY package.json yarn.lock tsconfig.json jest.config.js ./
COPY --from=builder /home/node/app/dist ./dist
RUN yarn install --prod
ENTRYPOINT [ "node", "dist" ]
