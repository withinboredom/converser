FROM node:latest

ENV YARN_VER=0.19.1
RUN npm install -g yarn@$YARN_VER

ENTRYPOINT ['yarn']