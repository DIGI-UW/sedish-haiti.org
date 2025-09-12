#!/bin/bash


# TEMP: Ensure the /tmp/backups folder exists
mkdir /tmp/backups

# Make sure jq is installed; install it if not
if ! command -v jq &> /dev/null; then
  echo "jq could not be found"
  sudo apt-get install jq
fi

docker build \
    -t lnsp-mediator:local \
    -f projects/lnsp-mediator/Dockerfile \
    projects/lnsp-mediator \

# Build lnsp-analytics image
docker build \
    -t lnsp-analytics:local \
    -f projects/lnsp-analytics/Dockerfile \
    projects/lnsp-analytics \

# Load Env vars from json file environmentVariables field
filepath="./packages/emr-isanteplus/package-metadata.json"
envs=$(jq -r '.environmentVariables | to_entries | .[] | "\(.key)=\(.value)"' $filepath)

# Export each environment variable
while IFS= read -r line; do
  export "$line"
done <<< "$envs"

# docker compose \
#     -f packages/emr-isanteplus/docker-compose.yml \
#     build

##
# lnsp migrations
##
filepath="./packages/lnsp-mediator/package-metadata.json"
envs=$(jq -r '.environmentVariables | to_entries | .[] | "\(.key)=\(.value)"' $filepath)

# Export each environment variable
while IFS= read -r line; do
  export "$line"
done <<< "$envs"

migrate_mongo_config_js_DIGEST="$(cat ./packages/lnsp-mediator/importer/migrate-mongo-config.js | md5sum | cut -d ' ' -f1)"
export migrate_mongo_config_js_DIGEST
package_json_DIGEST="$(cat ./packages/lnsp-mediator/importer/package.json | md5sum | cut -d ' ' -f1)"
export package_json_DIGEST

docker compose \
    -f packages/lnsp-mediator/importer/docker-compose.migrate.yml \
    build

##
# Isanteplus DB
##
# Load Env vars from package-metadata.json file
# filepath="./packages/database-mysql/package-metadata.json"
# envs=$(jq -r '.environmentVariables | to_entries | .[] | "\(.key)=\(.value)"' $filepath)

# Export each environment variable
while IFS= read -r line; do
  export "$line"
done <<< "$envs"

# Build the Docker image
# docker build -t isanteplus-mysql:5.7.44 ./projects/isanteplus-db

# Build the Platform to contain the above custom builds
./build-image.sh

echo "You can run the the Platform commands: E.g: ./instant-linux package init -p dev"
