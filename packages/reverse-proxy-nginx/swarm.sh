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

  log info "Certificate files validated successfully"
  log info "Fullchain path: ${PROVIDED_CERT_FULLCHAIN_PATH}"
  log info "Private key path: ${PROVIDED_CERT_PRIVKEY_PATH}"

  # Remove existing secret objects if they exist to allow updates
  log info "Removing existing secrets if they exist..."
  try "docker secret rm provided-fullchain.pem" catch "Failed to remove existing fullchain secret"
  try "docker secret rm provided-privkey.pem" catch "Failed to remove existing privkey secret"
  
  log info "Creating Docker secrets from certificate files..."
  try \
    "docker secret create --label name=nginx provided-fullchain.pem \"${PROVIDED_CERT_FULLCHAIN_PATH}\"" \
    throw \
    "Failed to create provided fullchain nginx secret"
  try \
    "docker secret create --label name=nginx provided-privkey.pem \"${PROVIDED_CERT_PRIVKEY_PATH}\"" \
    throw \
    "Failed to create provided privkey nginx secret"

  log info "Docker secrets created successfully"

  # Prepare nginx.conf
  log info "Preparing nginx configuration..."
  cp "${COMPOSE_FILE_PATH}/config/nginx-temp-secure.conf" "${COMPOSE_FILE_PATH}/config/nginx.conf"
  sed -i "s/domain_name/${DOMAIN_NAME}/g;" "${COMPOSE_FILE_PATH}/config/nginx.conf"
  log info "Nginx configuration prepared with domain: ${DOMAIN_NAME}"

  # Remove existing config if it exists to allow updates
  log info "Removing existing nginx config if it exists..."
  try "docker config rm \"${TIMESTAMPED_NGINX}\"" catch "Failed to remove existing nginx config"

  log info "Creating new nginx config..."
  try \
    "docker config create --label name=nginx ${TIMESTAMPED_NGINX} ${COMPOSE_FILE_PATH}/config/nginx.conf" \
    throw \
    "Failed to create nginx config for provided certificates"

  log info "Nginx config created successfully: ${TIMESTAMPED_NGINX}"

  # Check current service status before updating
  log info "Checking current service status..."
  local service_status
  service_status=$(try "docker service ps \"${STACK}_${SERVICE_NAMES}\" --format \"{{.CurrentState}}\"" catch "Failed to get service status" 2>/dev/null | head -1 || echo "Service not found")
  log info "Current service status: ${service_status}"

  # Remove any existing secrets from the service that map to these target paths
  log info "Analyzing current service secrets..."
  local current_secrets
  current_secrets=$(try "docker service inspect \"${STACK}_${SERVICE_NAMES}\" --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}},{{.File.Name}}{{\"\\n\"}}{{end}}'" catch "Failed to inspect service secrets" 2>/dev/null || true)

  local old_fullchain_secret_name=""
  local old_privkey_secret_name=""

  while IFS=, read -r secret_name target_path; do
    if [[ "$target_path" == "/run/secrets/fullchain.pem" ]]; then
      old_fullchain_secret_name=$secret_name
      log info "Found existing fullchain secret: ${secret_name}"
    elif [[ "$target_path" == "/run/secrets/privkey.pem" ]]; then
      old_privkey_secret_name=$secret_name
      log info "Found existing privkey secret: ${secret_name}"
    fi
  done <<< "$current_secrets"

  local service_update_args=()
  # Ensure config is removed before adding, to handle cases where it might exist from a previous failed run or different mode
  local current_config_name
  current_config_name=$(try "docker service inspect \"${STACK}_${SERVICE_NAMES}\" --format '{{range .Spec.TaskTemplate.ContainerSpec.Configs}}{{.ConfigName}},{{.File.Name}}{{\"\\n\"}}{{end}}'" catch "Failed to inspect service configs" 2>/dev/null | grep ',/etc/nginx/nginx.conf$' | cut -d, -f1)
  if [[ -n "$current_config_name" ]]; then
      service_update_args+=(--config-rm "$current_config_name")
      log info "Will remove existing config: ${current_config_name}"
  fi

  if [[ -n "$old_fullchain_secret_name" ]]; then
    service_update_args+=(--secret-rm "$old_fullchain_secret_name")
    log info "Will remove existing fullchain secret: ${old_fullchain_secret_name}"
  fi
  if [[ -n "$old_privkey_secret_name" ]]; then
    service_update_args+=(--secret-rm "$old_privkey_secret_name")
    log info "Will remove existing privkey secret: ${old_privkey_secret_name}"
  fi

  log info "Preparing service update with the following arguments:"
  log info "  - Config to add: ${TIMESTAMPED_NGINX}"
  log info "  - Fullchain secret: provided-fullchain.pem"
  log info "  - Privkey secret: provided-privkey.pem"
  log info "  - Network: cert-renewal-network"
  log info "  - Ports: 80:80, 443:443"

  log info "Updating $SERVICE_NAMES service with provided certificates and config..."
  
  # Run docker service update and capture output for debugging
  local update_output
  local update_exit_code
  update_output=$(docker service update \
        "${service_update_args[@]}" \
        --config-add source=${TIMESTAMPED_NGINX},target=/etc/nginx/nginx.conf \
        --secret-add source=provided-fullchain.pem,target=/run/secrets/fullchain.pem,mode=0400 \
        --secret-add source=provided-privkey.pem,target=/run/secrets/privkey.pem,mode=0400 \
        --network-add name=cert-renewal-network,alias=cert-renewal-network \
        --publish-add published=80,target=80 \
        --publish-add published=443,target=443 \
        ${STACK}_${SERVICE_NAMES} 2>&1)
  update_exit_code=$?
  
  if [[ $update_exit_code -ne 0 ]]; then
    log error "Error updating $SERVICE_NAMES service for provided certificates"
    log error "Docker service update failed with exit code: $update_exit_code"
    log error "Docker error output:"
    echo "$update_output" | while IFS= read -r line; do
      log error "  $line"
    done
    exit 1
  fi
  overwrite "Updating $SERVICE_NAMES service with provided certificates and config... Done"
  
  # Verify the update was successful
  log info "Verifying service update..."
  sleep 2
  local updated_status
  updated_status=$(try "docker service ps \"${STACK}_${SERVICE_NAMES}\" --format \"{{.CurrentState}}\"" catch "Failed to get updated service status" 2>/dev/null | head -1 || echo "Service not found")
  log info "Service status after update: ${updated_status}"
  
  # Check for any immediate errors
  local service_errors
  service_errors=$(try "docker service ps \"${STACK}_${SERVICE_NAMES}\" --no-trunc --format '{{.Error}}'" catch "Failed to get service errors" 2>/dev/null | grep -v "^$" | head -1 || echo "No errors")
  if [[ "$service_errors" != "No errors" ]]; then
    log warn "Service has errors after update: ${service_errors}"
  else
    log info "Service update completed successfully"
  fi
  
  rm -f "${COMPOSE_FILE_PATH}/config/nginx.conf"
  log info "Configuration complete"
}

function deploy_nginx() {
  local -r DEPLOY_TYPE=${1:?"FATAL: deploy_nginx DEPLOY_TYPE not provided"}

  log info "Deploying nginx in ${DEPLOY_TYPE} mode..."
  log info "Generating service configs for ${SERVICE_NAMES}..."

  config::generate_service_configs "$SERVICE_NAMES" /etc/nginx/conf.d "${COMPOSE_FILE_PATH}/package-conf-${DEPLOY_TYPE}" "${COMPOSE_FILE_PATH}" "nginx"

  log info "Service configs generated successfully"
  log info "Deploying service using docker-compose..."

  docker::deploy_service $STACK "${COMPOSE_FILE_PATH}" "docker-compose.yml" "docker-compose.tmp.yml"

  log info "Initial service deployment completed"
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
