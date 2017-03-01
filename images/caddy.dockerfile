FROM ubuntu:16.10

ENV caddy-ver=0.9.5
ENV caddy-opts="cors,expires,jwt,minify,realip"
ENV caddy-dns="digitalocean,namecheap"

COPY ./images/builder/caddy /caddy
COPY ./Caddyfile /Caddyfile

USER nobody

CMD ["/caddy","-conf","/Caddyfile"]

USER root