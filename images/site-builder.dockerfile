FROM withinboredom/yarn:latest
COPY ./src/site /app
ARG CALL
ARG STRIPE_P_KEY
ARG API_HOST

RUN cd /app/js && yarn && NODE_ENV=production node_modules/.bin/webpack -p && rm -rf /app/js