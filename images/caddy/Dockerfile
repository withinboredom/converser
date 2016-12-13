FROM ubuntu:16.04

ADD ./images/caddy/caddy_linux_amd64_custom.tar.gz /caddy
COPY ./Caddyfile /Caddyfile

CMD ["/caddy/caddy","-conf","/Caddyfile"]