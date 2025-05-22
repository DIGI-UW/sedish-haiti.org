#!/bin/bash


# TAG_NAME=${1:-latest}
# ENV_FILE=${2:-./.env.hie}

# set -o allexport; source "$ENV_FILE"; set +o allexport

# TAG_VERSION=${VERSION:-latest}
# PUSH=${2:-false}

# docker build -t itechuw/sedish-haiti:"$TAG_NAME" -t itechuw/sedish-haiti:"$TAG_VERSION" .

# if [ "$PUSH" = true ]; then
#   docker push itechuw/sedish-haiti:"$TAG_NAME"
#   docker push itechuw/sedish-haiti:"$TAG_VERSION"
# fi

#!/bin/bash
TAG_NAME=${1:-latest}

# We did not specify a tag so try and use the tag in the config.yaml if present
if [ -z "$1" ]; then
    # we grep out 'image: jembi/platform:2.x' from which we cut on : and choose the last column
    # this will always be the image tag or an empty string
    ImageTag=$(grep 'image:' ${PWD}/config.yaml | cut -d : -f 3)
    # only overwrite TAG_NAME if we have a tag present, and it's not just the base image name
    if [ -n "$ImageTag" ]; then
        TAG_NAME=${ImageTag}
    fi
fi

# Source the .env file to get configuration variables
ENV_FILE_PATH="${PWD}/.env"
if [ -f "$ENV_FILE_PATH" ]; then
  set -o allexport
  source "$ENV_FILE_PATH"
  set +o allexport
else
  echo "Warning: .env file not found at $ENV_FILE_PATH. Proceeding with environment variables or defaults."
fi

# Use variables from .env for host certificate paths
# Default to empty if not set, but the script will error out if they are needed and not found.
HOST_FULLCHAIN_PATH="${HOST_PROVIDED_CERT_FULLCHAIN_PATH:-}"
HOST_PRIVKEY_PATH="${HOST_PROVIDED_CERT_PRIVKEY_PATH:-}"

# Only proceed with secret mounting if USE_PROVIDED_CERTIFICATES is true
if [ "$USE_PROVIDED_CERTIFICATES" = "true" ]; then
  # Check if certificate files exist before attempting to build
  if [ -z "$HOST_FULLCHAIN_PATH" ] || [ ! -f "$HOST_FULLCHAIN_PATH" ]; then
      echo "Error: USE_PROVIDED_CERTIFICATES is true, but HOST_PROVIDED_CERT_FULLCHAIN_PATH is not set or file not found: $HOST_FULLCHAIN_PATH"
      exit 1
  fi

  if [ -z "$HOST_PRIVKEY_PATH" ] || [ ! -f "$HOST_PRIVKEY_PATH" ]; then
      echo "Error: USE_PROVIDED_CERTIFICATES is true, but HOST_PROVIDED_CERT_PRIVKEY_PATH is not set or file not found: $HOST_PRIVKEY_PATH"
      exit 1
  fi

  echo "Validating provided certificate chain file: $HOST_FULLCHAIN_PATH"
  if ! openssl x509 -in "$HOST_FULLCHAIN_PATH" -noout; then
      echo "Error: Provided fullchain certificate ($HOST_FULLCHAIN_PATH) is not valid or could not be parsed by OpenSSL."
      exit 1
  fi
  echo "Fullchain certificate validation successful."

  echo "Validating provided private key file: $HOST_PRIVKEY_PATH"
  if ! openssl rsa -in "$HOST_PRIVKEY_PATH" -check -noout; then
      echo "Error: Provided private key ($HOST_PRIVKEY_PATH) is not valid or could not be parsed by OpenSSL."
      exit 1
  fi
  echo "Private key validation successful."

  DOCKER_BUILDKIT=1 docker build \
    --secret id=fullchain,src="$HOST_FULLCHAIN_PATH" \
    --secret id=privkey,src="$HOST_PRIVKEY_PATH" \
    -t itechuw/sedish-haiti:"$TAG_NAME" . --no-cache
else
  # Build without secrets if not using provided certificates
  DOCKER_BUILDKIT=1 docker build \
    -t itechuw/sedish-haiti:"$TAG_NAME" . --no-cache
fi