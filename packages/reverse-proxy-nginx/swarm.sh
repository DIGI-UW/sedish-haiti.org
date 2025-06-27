#!/bin/bash

declare ACTION=""
declare MODE=""
declare COMPOSE_FILE_PATH=""
declare UTILS_PATH=""
declare TIMESTAMP
declare TIMESTAMPED_NGINX
declare SERVICE_NAMES=()
declare STACK="reverse-proxy"
declare USE_PROVIDED_CERTIFICATES
declare PROVIDED_CERT_FULLCHAIN_PATH
declare PROVIDED_CERT_PRIVKEY_PATH

function init_vars() {
  ACTION=$1
  MODE=$2

  COMPOSE_FILE_PATH=$(
    cd "$(dirname "${BASH_SOURCE[0]}")" || exit
    pwd -P
  )

  TIMESTAMP="$(date "+%Y%m%d%H%M%S")"
  TIMESTAMPED_NGINX="${TIMESTAMP}-nginx.conf"

  UTILS_PATH="${COMPOSE_FILE_PATH}/../utils"

  SERVICE_NAMES=("reverse-proxy-nginx")

  readonly ACTION
  readonly MODE
  readonly COMPOSE_FILE_PATH
  readonly UTILS_PATH
  readonly TIMESTAMP
  readonly TIMESTAMPED_NGINX
  readonly SERVICE_NAMES
  readonly STACK
  readonly USE_PROVIDED_CERTIFICATES
  readonly PROVIDED_CERT_FULLCHAIN_PATH
  readonly PROVIDED_CERT_PRIVKEY_PATH
}

# shellcheck disable=SC1091
function import_sources() {
  source "${UTILS_PATH}/docker-utils.sh"
  source "${UTILS_PATH}/config-utils.sh"
  source "${UTILS_PATH}/log.sh"
}

function publish_insecure_ports() {
  IFS='-' read -ra PORTS <<<"$INSECURE_PORTS"

  local ports_array=()

  for i in "${PORTS[@]}"; do
    IFS=':' read -ra PORTS_SPLIT <<<"$i"

    if [[ "${PORTS_SPLIT[0]}" != "" ]] && [[ "${PORTS_SPLIT[1]}" != "" ]]; then
      ports_array+=(--publish-add "published=${PORTS_SPLIT[0]},target=${PORTS_SPLIT[1]}")

      log info "Exposing ports: published=%s,target=%s " "${PORTS_SPLIT[0]}" "${PORTS_SPLIT[1]}"
    else
      log error "Failed to expose ports: published=%s,target=%s " "${PORTS_SPLIT[0]}" "${PORTS_SPLIT[1]}"
    fi
  done

  log info "Updating ${SERVICE_NAMES} service with configured ports..."
  try \
    "docker service update ${ports_array[*]} ${STACK}_${SERVICE_NAMES}" \
    throw \
    "Error updating ${SERVICE_NAMES} service"
  overwrite "Updating ${SERVICE_NAMES} service with configured ports... Done"
}

function add_insecure_configs() {
  try \
    "docker config create --label name=nginx ${TIMESTAMPED_NGINX} ${COMPOSE_FILE_PATH}/config/nginx-temp-insecure.conf" \
    throw \
    "Failed to create nginx insecure config"

  log info "Updating nginx service: adding config file..."
  try \
    "docker service update --config-add source=${TIMESTAMPED_NGINX},target=/etc/nginx/nginx.conf ${STACK}_$SERVICE_NAMES" \
    throw \
    "Error updating ${SERVICE_NAMES} service"
  overwrite "Updating nginx service: adding config file... Done"
}

function set_nginx_network_secure() {
  local nginx_network_exists
  nginx_network_exists=$(docker network ls --filter name=cert-renewal-network --format '{{.Name}}')

  if [[ -z "${nginx_network_exists}" ]]; then
    try \
      "docker network create -d overlay --attachable cert-renewal-network" \
      throw \
      "Failed to create cert-renewal-network network"
  fi
}

function configure_nginx_with_provided_certs() {
  log info "Configuring Nginx with provided certificates"

  if [[ -z "${PROVIDED_CERT_FULLCHAIN_PATH}" ]] || [[ ! -f "${PROVIDED_CERT_FULLCHAIN_PATH}" ]]; then
    log error "Provided fullchain certificate path is not set or file does not exist: ${PROVIDED_CERT_FULLCHAIN_PATH}"
    exit 1
  fi
  if [[ -z "${PROVIDED_CERT_PRIVKEY_PATH}" ]] || [[ ! -f "${PROVIDED_CERT_PRIVKEY_PATH}" ]]; then
    log error "Provided private key path is not set or file does not exist: ${PROVIDED_CERT_PRIVKEY_PATH}"
    exit 1
  fi

  # Remove existing secret objects if they exist to allow updates
  docker secret rm provided-fullchain.pem &>/dev/null || true
  docker secret rm provided-privkey.pem &>/dev/null || true
  
  try \
    "docker secret create --label name=nginx provided-fullchain.pem \"${PROVIDED_CERT_FULLCHAIN_PATH}\"" \
    throw \
    "Failed to create provided fullchain nginx secret"
  try \
    "docker secret create --label name=nginx provided-privkey.pem \"${PROVIDED_CERT_PRIVKEY_PATH}\"" \
    throw \
    "Failed to create provided privkey nginx secret"

  # Prepare nginx.conf
  cp "${COMPOSE_FILE_PATH}/config/nginx-temp-secure.conf" "${COMPOSE_FILE_PATH}/config/nginx.conf"
  sed -i "s/domain_name/${DOMAIN_NAME}/g;" "${COMPOSE_FILE_PATH}/config/nginx.conf"

  # Remove existing config if it exists to allow updates
  docker config rm "${TIMESTAMPED_NGINX}" &>/dev/null || true

  try \
    "docker config create --label name=nginx ${TIMESTAMPED_NGINX} ${COMPOSE_FILE_PATH}/config/nginx.conf" \
    throw \
    "Failed to create nginx config for provided certificates"

  # Remove any existing secrets from the service that map to these target paths
  local current_secrets
  current_secrets=$(docker service inspect "${STACK}_${SERVICE_NAMES}" --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}},{{.File.Name}}{{"\n"}}{{end}}' 2>/dev/null || true)

  local old_fullchain_secret_name=""
  local old_privkey_secret_name=""

  while IFS=, read -r secret_name target_path; do
    if [[ "$target_path" == "/run/secrets/fullchain.pem" ]]; then
      old_fullchain_secret_name=$secret_name
    elif [[ "$target_path" == "/run/secrets/privkey.pem" ]]; then
      old_privkey_secret_name=$secret_name
    fi
  done <<< "$current_secrets"

  local service_update_args=()
  # Ensure config is removed before adding, to handle cases where it might exist from a previous failed run or different mode
  local current_config_name
  current_config_name=$(docker service inspect "${STACK}_${SERVICE_NAMES}" --format '{{range .Spec.TaskTemplate.ContainerSpec.Configs}}{{.ConfigName}},{{.File.Name}}{{"\n"}}{{end}}' 2>/dev/null | grep ',/etc/nginx/nginx.conf$' | cut -d, -f1)
  if [[ -n "$current_config_name" ]]; then
      service_update_args+=(--config-rm "$current_config_name")
  fi

  if [[ -n "$old_fullchain_secret_name" ]]; then
    service_update_args+=(--secret-rm "$old_fullchain_secret_name")
  fi
  if [[ -n "$old_privkey_secret_name" ]]; then
    service_update_args+=(--secret-rm "$old_privkey_secret_name")
  fi

  log info "Updating $SERVICE_NAMES service with provided certificates and config..."
  try "docker service update \
        "${service_update_args[@]}" \
        --config-add source=${TIMESTAMPED_NGINX},target=/etc/nginx/nginx.conf \
        --secret-add source=provided-fullchain.pem,target=/run/secrets/fullchain.pem,mode=0400 \
        --secret-add source=provided-privkey.pem,target=/run/secrets/privkey.pem,mode=0400 \
        --network-add name=cert-renewal-network,alias=cert-renewal-network \
        --publish-add published=80,target=80 \
        --publish-add published=443,target=443 \
        ${STACK}_${SERVICE_NAMES}" \
      throw \
      "Error updating $SERVICE_NAMES service for provided certificates"
  overwrite "Updating $SERVICE_NAMES service with provided certificates and config... Done"
  
  rm -f "${COMPOSE_FILE_PATH}/config/nginx.conf"
}

function deploy_nginx() {
  local -r DEPLOY_TYPE=${1:?"FATAL: deploy_nginx DEPLOY_TYPE not provided"}

  config::generate_service_configs "$SERVICE_NAMES" /etc/nginx/conf.d "${COMPOSE_FILE_PATH}/package-conf-${DEPLOY_TYPE}" "${COMPOSE_FILE_PATH}" "nginx"

  docker::deploy_service $STACK "${COMPOSE_FILE_PATH}" "docker-compose.yml" "docker-compose.tmp.yml"
}

function initialize_package() {
  if [[ "${INSECURE}" == "true" ]]; then
    log info "Running package in INSECURE mode"
    (
      deploy_nginx "insecure"

      if [[ "${INSECURE_PORTS}" != "" ]]; then
        publish_insecure_ports
      fi
      add_insecure_configs
    ) ||
      {
        log error "Failed to deploy package in INSECURE MODE"
        exit 1
      }
  else
    log info "Running package in SECURE mode"
    if [[ "${USE_PROVIDED_CERTIFICATES}" == "true" ]]; then
      (
        deploy_nginx "secure"
        set_nginx_network_secure
        configure_nginx_with_provided_certs
      ) ||
      {
        log error "Failed to deploy package in SECURE MODE with provided certificates"
        exit 1
      }
    else
      (
        deploy_nginx "secure"

        # shellcheck disable=SC1091
        source "${COMPOSE_FILE_PATH}/set-secure-mode.sh"
      ) ||
      {
        log error "Failed to deploy package in SECURE MODE with Let's Encrypt"
        exit 1
      }
    fi
  fi
}

function destroy_package() {
  docker::stack_destroy $STACK

  mapfile -t nginx_secrets < <(docker secret ls -qf label=name=nginx)
  if [[ "${#nginx_secrets[@]}" -ne 0 ]]; then
    try "docker secret rm ${nginx_secrets[*]}" catch "Failed to remove nginx secrets"
  fi

  mapfile -t nginx_network < <(docker network ls -qf name=cert-renewal-network)
  if [[ "${#nginx_network[@]}" -ne 0 ]]; then
    try "docker network rm ${nginx_network[*]}" catch "Failed to remove nginx networks"
  fi

  docker::prune_configs "nginx"
}

main() {
  init_vars "$@"
  import_sources

  if [[ "${ACTION}" == "init" ]] || [[ "${ACTION}" == "up" ]]; then
    log info "Running package"

    initialize_package
  elif [[ "${ACTION}" == "down" ]]; then
    log info "Scaling down package"

    docker::scale_services $STACK 0
  elif [[ "${ACTION}" == "destroy" ]]; then
    log info "Destroying package"
    destroy_package
  else
    log error "Valid options are: init, up, down, or destroy"
  fi
}

main "$@"
