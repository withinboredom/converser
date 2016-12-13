#!/bin/sh

docker run -it --rm -v $(pwd):/code -w /code php:cli php $@