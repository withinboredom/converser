FROM node:latest

ENV YARN_VER=0.20.3
RUN npm install -g yarn@$YARN_VER