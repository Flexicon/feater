#!/usr/bin/env bash

set -ex

docker pull alpine:3.9
docker pull docker/compose:${FEATER_DOCKER_COMPOSE_VERSION}

docker network connect ${FEATER_PROXY_NETWORK_NAME} ${HOSTNAME}

nginx -g "daemon on;" # TODO It may vary depending on OS used.
mongod --fork --bind_ip 0.0.0.0 --logpath /var/log/mongodb.log --dbpath /data/mongo # TODO It may vary depending on OS used.

(cd ./server && yarn install && yarn start:dev:watch 1>&1 2>&2 &)
(cd ./client && yarn install && yarn start:dev:watch 1>&1 2>&2 &)

set +x

while true; do sleep 10; done
