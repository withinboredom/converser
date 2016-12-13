@echo off
docker run -it --rm -v %cd%:/code -w /code php:cli php %*