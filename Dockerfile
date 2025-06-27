ARG PLATFORM_VERSION=latest

FROM jembi/platform:$PLATFORM_VERSION
ADD . /implementation

# ADD ./utils /instant/utils

# Create a directory in the image to store provided certificates
RUN mkdir -p /opt/certs/

# Mount the fullchain certificate secret and copy it to /opt/certs/
# The secret 'fullchain' will be provided during the 'docker build' command.
# Handle missing certificates gracefully for CI builds
RUN --mount=type=secret,id=fullchain,target=/tmp/fullchain.pem \
    if [ -f /tmp/fullchain.pem ]; then \
        cp /tmp/fullchain.pem /opt/certs/fullchain.pem && chmod 644 /opt/certs/fullchain.pem; \
    else \
        echo "Warning: fullchain.pem secret not provided, creating placeholder" && \
        echo "# Placeholder certificate file" > /opt/certs/fullchain.pem && chmod 644 /opt/certs/fullchain.pem; \
    fi

# Mount the private key secret and copy it to /opt/certs/
# The secret 'privkey' will be provided during the 'docker build' command.
# Handle missing certificates gracefully for CI builds
RUN --mount=type=secret,id=privkey,target=/tmp/privkey.pem \
    if [ -f /tmp/privkey.pem ]; then \
        cp /tmp/privkey.pem /opt/certs/privkey.pem && chmod 600 /opt/certs/privkey.pem; \
    else \
        echo "Warning: privkey.pem secret not provided, creating placeholder" && \
        echo "# Placeholder private key file" > /opt/certs/privkey.pem && chmod 600 /opt/certs/privkey.pem; \
    fi

RUN chmod +x /implementation/scripts/cmd/override-configs/override-configs
RUN /implementation/scripts/cmd/override-configs/override-configs

