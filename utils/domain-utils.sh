#!/bin/bash

# Collect env vars matching a prefix and return their values as a comma-separated list
domain::collect_by_prefix() {
    local -r prefix=${1:-}
    local values=()

    while IFS='=' read -r name value; do
        if [[ "${name}" == "${prefix}"* ]] && [[ -n "${value}" ]]; then
            values+=("${value}")
        fi
    done < <(env)

    IFS=','; echo "${values[*]}"
}

# Convert subdomain labels to full domains using DOMAIN_NAME
domain::build_full_domains() {
    local -r labels_csv=${1:-}
    local -r base_domain=${DOMAIN_NAME:-}
    local domains=()

    if [[ -z "${labels_csv}" ]] || [[ -z "${base_domain}" ]]; then
        echo ""
        return
    fi

    IFS=',' read -ra labels <<<"${labels_csv}"
    for label in "${labels[@]}"; do
        local trimmed="${label//[[:space:]]/}"
        if [[ -z "${trimmed}" ]]; then
            continue
        fi
        # If already a full domain, use as-is; otherwise append base domain
        if [[ "${trimmed}" == *"."* ]]; then
            domains+=("${trimmed}")
        else
            domains+=("${trimmed}.${base_domain}")
        fi
    done

    IFS=','; echo "${domains[*]}"
}

domain::init() {
    local -r mode=${1:-}
    local -r base_domain=${DOMAIN_NAME:-}

    # Collect labels from SUBDOMAIN_CORE_* and SUBDOMAIN_DEV_* env vars
    local core_labels
    core_labels=$(domain::collect_by_prefix "SUBDOMAIN_CORE_")
    local dev_labels
    dev_labels=$(domain::collect_by_prefix "SUBDOMAIN_DEV_")

    local core_domains
    core_domains=$(domain::build_full_domains "${core_labels}")
    local dev_domains
    dev_domains=$(domain::build_full_domains "${dev_labels}")

    local combined_domains="${core_domains}"
    if [[ "${mode}" == "dev" ]] && [[ -n "${dev_domains}" ]]; then
        if [[ -n "${combined_domains}" ]]; then
            combined_domains="${combined_domains},${dev_domains}"
        else
            combined_domains="${dev_domains}"
        fi
    fi

    # Export SHR hostname from SUBDOMAIN_DEV_SHR for HAPI and other consumers
    if [[ -n "${SUBDOMAIN_DEV_SHR}" ]] && [[ -n "${base_domain}" ]]; then
        export SHR_HOSTNAME="${SUBDOMAIN_DEV_SHR}.${base_domain}"
        export SHR_FHIR_BASE_URL="https://${SHR_HOSTNAME}/fhir"
    fi

    export SUBDOMAINS="${combined_domains}"
}
