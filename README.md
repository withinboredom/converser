# Caddy + PHP == <3

This is a reference implementation of caddyserver + php-fpm in docker.

# Getting Started

1. Clone and copy the contents of this repo somewhere 
1. Replace `images/caddy/caddy_linux_amd64_custom.tar.gz` with the version of caddyserver you'd like.
2. If you need to run one-off php cli commands, in the repo root Windows: `php src/index.php` and bash: `./php src/index.php`
3. Launch the containers: `docker-compose up`
4. Destroy the containers: `docker-compose down -v`
5. Rebuild caddy: `docker-compose build`