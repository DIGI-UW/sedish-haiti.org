ARG PLATFORM_VERSION=latest

FROM jembi/platform:$PLATFORM_VERSION
ADD . /implementation

# ADD ./utils /instant/utils

# Create a directory in the image to store provided certificates
RUN mkdir -p /opt/certs/

# Mount the fullchain certificate secret and copy it to /opt/certs/
# The secret 'fullchain' will be provided during the 'docker build' command.
RUN --mount=type=secret,id=fullchain,target=/tmp/fullchain.pem cp /tmp/fullchain.pem /opt/certs/fullchain.pem && chmod 644 /opt/certs/fullchain.pem

# Mount the private key secret and copy it to /opt/certs/
# The secret 'privkey' will be provided during the 'docker build' command.
RUN --mount=type=secret,id=privkey,target=/tmp/privkey.pem cp /tmp/privkey.pem /opt/certs/privkey.pem && chmod 600 /opt/certs/privkey.pem

RUN chmod +x /implementation/scripts/cmd/override-configs/override-configs
RUN /implementation/scripts/cmd/override-configs/override-configs

