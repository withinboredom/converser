FROM ubuntu:16.10

COPY ./images/builder/caddy /caddy
COPY ./Caddyfile /Caddyfile

USER nobody

CMD ["/caddy","-conf","/Caddyfile"]

USER root