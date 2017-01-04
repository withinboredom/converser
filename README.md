# Converser

An interesting game of telephone

# Building

Building locally is pretty straight forward

## Prerequisites

### Local dependencies

1. npm (for tyche)
1. yarn (only needed if you want locally installed deps)
1. composer (only needed if you want locally installed deps)
1. [grammarly/rocker](https://github.com/grammarly/rocker)
1. [tyche](https://github.com/withinboredom/tyche)
1. docker
1. docker-compose

### An environment script

Create a file called `create_env.sh` at the root of the repo, with the following contents:

``` bash
#!/bin/bash
echo export DB_NAME="converser"
echo export DB_HOST="rethunk"
echo export SMS="an sms number"
echo export CALL="phone number to call from"
echo export CALL_HOST="http://dev.converser.space:YOUR_PORT/"
echo export STRIPE_KEY="your stripe key"
echo export STRIPE_P_KEY="Your publishable stripe key"
echo export PLIVO_ID="Your plivo id"
echo export PLIVO_TOKEN="Your plivo token"
```

Then initialize your environment: `eval "./create_env.sh"`

### Installing dependencies locally

The code's dependencies, as installed by this step, are
not used to run the project. It's only useful if you editor
does auto-complete.

``` bash
tyche develop install
```

Now, after a few minutes, you'll have everything installed.

### Starting the development server

``` bash
tyche develop start
```

This command will start all the development services, and build
all required dependencies inside docker.

## Running production locally

``` bash
docker-compose -f docker-compose-prod.yml up
```

## Building containers from scratch

``` bash
tyche build
```

## Deploying containers

#### Reminder: Deployment containers have your set environment tokens embedded

``` bash
tyche bump --set vVERSION
```