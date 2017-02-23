FROM node:latest

ADD api.tar /

USER nobody

# Run tests
RUN cd /app/api && node --harmony lib/tests/run_all.js

WORKDIR /app/api
CMD ["node","--harmony","index.js"]

USER root
