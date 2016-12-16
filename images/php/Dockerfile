FROM php:cli

RUN echo "deb http://ftp.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/backports.list && \
    apt-get update && \
    apt-get install -y git unzip zlib1g-dev zlib1g && \
    apt-get -t jessie-backports install -y libuv1 libuv1-dev && \
    docker-php-ext-install -j$(nproc) zip

RUN docker-php-source extract && \
    git clone https://github.com/bwoebi/php-uv.git && \
    cd php-uv && \
    phpize && \
    ./configure && \
    make -j$(nproc) && \
    make install && \
    cd .. && \
    rm -rf php-uv && \
    docker-php-ext-enable uv && \
    docker-php-source delete

RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && \
    php -r "if (hash_file('SHA384', 'composer-setup.php') === 'aa96f26c2b67226a324c27919f1eb05f21c248b987e6195cad9690d5c1ff713d53020a02ac8c217dbf90a7eacc9d141d') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;" &&\
    php composer-setup.php --install-dir=/bin --filename=composer --version=1.2.4 &&\
    php -r "unlink('composer-setup.php');"

COPY src /app

WORKDIR /app

CMD ["/app/vendor/amphp/aerys/bin/aerys","-c","/app/vendor/amphp/aerys/demo.php"]