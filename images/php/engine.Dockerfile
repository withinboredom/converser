FROM php:7-apache

RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && \
    php composer-setup.php --install-dir=/bin --filename=composer --version=1.2.4 &&\
    php -r "unlink('composer-setup.php');"

RUN apt-get update && apt-get install -y git unzip

COPY src/engine/composer.lock /var/www/html/composer.lock
COPY src/engine/composer.json /var/www/html/composer.json

WORKDIR /var/www/html
RUN composer install

COPY src/engine /var/www/html