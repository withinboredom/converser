FROM withinboredom/yarn:latest

COPY src/api /app/api

WORKDIR /app/api
RUN yarn install