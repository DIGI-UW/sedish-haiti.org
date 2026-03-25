FROM ghcr.io/isanteplus/docker-isanteplus-server:v2.3.4

# Remove base image modules — replace with pure 2.8.5 production set
RUN rm -rf /openmrs/distribution/openmrs_modules/*
ADD ./config/custom_modules /openmrs/distribution/openmrs_modules