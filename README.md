# SEDISH: The Haiti HIE 
This README details the end-to-end deployment of a docker-swarm based HIE using instant OpenHIE. The deployment follows the Jembi platform pattern and includes instructions for setting up the Linux environment, installing and configuring Docker, initializing a Docker Swarm, configuring security best practices, and deploying the project packages.

[![CI](https://github.com/I-TECH-UW/sedish-haiti.org/actions/workflows/main.yml/badge.svg)](https://github.com/I-TECH-UW/sedish-haiti.org/actions/workflows/main.yml)
## Components

### 1. iSantePlus EMR
### Links
https://github.com/IsantePlus/openmrs-distro-isanteplus
https://github.com/IsantePlus/docker-isanteplus-server

### 2. OpenCR
https://github.com/intrahealth/client-registry

### 3. OpenHIM
http://openhim.org/docs/installation/docker

### 4. HAPI JPA Server
https://github.com/hapifhir/hapi-fhir-jpaserver-starter#deploy-with-docker-compose
https://hapifhir.io/hapi-fhir/docs/server_jpa/get_started.html


## Deployment Guide


> **Note:** This deployment uses instant OpenHIE v2. For more background, see the [Instant OpenHIE documentation](https://jembi.gitbook.io/instant-v2) and [Jembi Platform README](https://github.com/jembi/platform/blob/main/README.md).

---

## Table of Contents

- [SEDISH: The Haiti HIE](#sedish-the-haiti-hie)
  - [Components](#components)
    - [1. iSantePlus EMR](#1-isanteplus-emr)
    - [Links](#links)
    - [2. OpenCR](#2-opencr)
    - [3. OpenHIM](#3-openhim)
    - [4. HAPI JPA Server](#4-hapi-jpa-server)
  - [Deployment Guide](#deployment-guide)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [System Requirements](#system-requirements)
  - [Environment Setup](#environment-setup)
    - [Linux VM Setup](#linux-vm-setup)
    - [Installing Git and Docker](#installing-git-and-docker)
    - [Initializing Docker Swarm](#initializing-docker-swarm)
  - [Security Best Practices](#security-best-practices)
    - [Docker and Swarm Security](#docker-and-swarm-security)
    - [Host and OS Hardening](#host-and-os-hardening)
    - [Cloud-Specific Controls (AWS)](#cloud-specific-controls-aws)
  - [Project Configuration](#project-configuration)
    - [Project Structure and .env File](#project-structure-and-env-file)
    - [Docker Secrets and Swarm Locking](#docker-secrets-and-swarm-locking)
  - [Component Modules](#component-modules)
    - [Interoperability Layer – OpenHIM](#interoperability-layer--openhim)
    - [Reverse Proxy – Nginx](#reverse-proxy--nginx)
    - [FHIR Datastore – HAPI FHIR](#fhir-datastore--hapi-fhir)
    - [Monitoring](#monitoring)
    - [Database Modules – Postgres \& MySQL](#database-modules--postgres--mysql)
    - [Analytics Datastore – ElasticSearch](#analytics-datastore--elasticsearch)
    - [Message Bus – Kafka](#message-bus--kafka)
    - [Shared Health Record – FHIR / OpenSHR](#shared-health-record--fhir--openshr)
    - [Sedish Haiti Custom Packages](#sedish-haiti-custom-packages)
  - [Deployment Steps](#deployment-steps)
  - [Post-Deployment Configuration](#post-deployment-configuration)
  - [Troubleshooting \& Logging](#troubleshooting--logging)
  - [Additional Resources](#additional-resources)

---

## Overview

This project deploys a multi-component Health Information Exchange (HIE) on a cloud-based AWS Linux VM using Docker Swarm. The system uses [instant OpenHIE](https://jembi.gitbook.io/instant-v2) to package and deploy several modules following the Jembi platform pattern. The deployed components include core interoperability layers, data stores, identity management, analytics, messaging, and additional custom packages for the Sedish Haiti project.

---

## Suggested System Requirements

- **Operating System:** AWS Linux VM (Ubuntu, Amazon Linux 2, etc.)
- **Docker:** Latest Docker CE installed (with Docker Swarm mode enabled)
- **Git:** Installed for source code retrieval
- **AWS:** Proper IAM roles and security group configuration for port and network isolation

---

## Environment Setup

### Linux VM Setup

1. **Provision an AWS Linux VM:**  
   Use your preferred AWS method (EC2, AWS Marketplace AMI, etc.) and ensure you have SSH access.

2. **Update your system:**  
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

### Installing Git and Docker

1. **Install Git:**  
   ```bash
   sudo apt install -y git
   ```

2. **Install Docker:**  
   Follow [Docker’s installation guide](https://docs.docker.com/engine/install/ubuntu/) for your Linux distribution. 

### Initializing Docker Swarm

1. **Enable Swarm mode:**  
   ```bash
   docker swarm init
   ```
   If you have multiple nodes, join worker nodes using the token provided by the `docker swarm init` command.

2. **Lock the Swarm:**  
   To secure the swarm’s Certificate Authority (CA) key, run:
   ```bash
   docker swarm ca --rotate --passphrase "YourSecurePassphrase"
   ```

---

## HIE Setup and Configuration

### 1. Clone the Repository

```bash
git clone https://github.com/I-TECH-UW/sedish-haiti.org.git
cd sedish-haiti.org
```

### 2. Explore Project Structure
The project follows a modular structure outlined by the Instant OpneHIE V2 framework. The main configuration file is `config.yaml`, and environment variables are defined in the `.env` file. The project structure is as follows:

```
/sedish-haiti.org
  ├── config.yaml           # Main project configuration file
  ├── .env                  # Environment variable definitions
  ├── scripts/              # Helper scripts (e.g., deploy.sh)
  ├── projects/             # Sedish-specific services
  └── packages/
        ├── interoperability-layer-openhim/
        ├── reverse-proxy-nginx/
        ├── fhir-datastore-hapi-fhir/
        ├── monitoring/
        ├── database-postgres/
        ├── database-mysql/
        ├── identity-access-manager-keycloak/
        ├── client-registry-opencr/
        ├── analytics-datastore-elastic-search/
        ├── message-bus-kafka/
        ├── shared-health-record-fhir/
        ├── emr-isanteplus/
        ├── data-pipeline-isanteplus/
        ├── document-data-store-xds/
        ├── shared-health-record-openshr/
        ├── openhim-mediator-openxds/
        └── lnsp-mediator/
```

This template `.env` file can be used as a starting point for configuration:

```bash
# General
CLUSTERED_MODE=false

# Log configuration
DEBUG=1
BASHLOG_FILE=1
BASHLOG_FILE_PATH=platform.log

# Interoperability Layer - OpenHIM
OPENHIM_CORE_INSTANCES=1
OPENHIM_CONSOLE_INSTANCES=1
OPENHIM_MEDIATOR_API_PORT=443
OPENHIM_CORE_MEDIATOR_HOSTNAME=openhimcomms.sedish.live
MONGO_SET_COUNT=1
OPENHIM_MONGO_URL=mongodb://mongo-1:27017/openhim
OPENHIM_MONGO_ATNAURL=mongodb://mongo-1:27017/openhim

# FHIR Datastore - HAPI FHIR
HAPI_FHIR_INSTANCES=1
REPMGR_PARTNER_NODES=postgres-1
POSTGRES_REPLICA_SET=postgres-1:5432

# Reverse Proxy - Nginx
REVERSE_PROXY_INSTANCES=1
DOMAIN_NAME=sedish.live
SUBDOMAINS=openhimcomms.sedish.live,openhimcore.sedish.live,openhimconsole.sedish.live,keycloak.sedish.live,grafana.sedish.live,isanteplus.sedish.live,hueh.sedish.live,lapaix.sedish.live,ofatma.sedish.live,foyer-saint-camille.sedish.live,klinik-eritaj.sedish.live,ofatma-sonapi.sedish.live,gressier.sedish.live,pestel.sedish.live,stdemiragoane.sedish.live,bethel-fdn.sedish.live
STAGING=false
INSECURE=false

# Message Bus - Kafka
KAFKA_TOPICS=map-concepts,map-locations,send-adt-to-ipms,send-orm-to-ipms,save-pims-patient,save-ipms-patient,handle-oru-from-ipms
KAFKA_HOSTS=kafka-01:9092

# Identity Access Manager - Keycloak
KC_FRONTEND_URL=https://keycloak.sedish.live
KC_GRAFANA_ROOT_URL=https://grafana.sedish.live
KC_SUPERSET_ROOT_URL=https://superset.domain
KC_OPENHIM_ROOT_URL=https://openhimconsole.sedish.live
GF_SERVER_DOMAIN=grafana.sedish.live

# Resource limits
OPENHIM_MEMORY_LIMIT=4G
ES_MEMORY_LIMIT=20G
LOGSTASH_MEMORY_LIMIT=8G
KAFKA_MEMORY_LIMIT=8G
KAFDROP_MEMORY_LIMIT=500M

LNSP_RUN_MIGRATIONS=true
LNSP_DATABASE_EXISTS=true
```

### 3. Build the Project

1. Run `./get-cli.sh linux` to download the Instant OpenHIE CLI for Linux.

2. Run `./build-custom-images.sh` to build the necessary project components.

3. Run `./build-images.sh` to build the Docker images for the HIE deployment.


### 4. Configure the Project

1. Update the `.env` file with your specific configuration settings.

### 5. Deploy the Project

1. Run `./instant project up --env-file .env` to deploy the project.

### 6. Manage individual packages

You can use the `mk.sh` file or the `instant` CLI to manage individual packages. For example, to bring up the OpenHIM package:

```bash
./instant package up -n interoperability-layer-openhim --env-file .env
``` 

## Security Best Practices

### Docker and Swarm Security

- **Docker Secrets:**  
  Use Docker secrets to securely manage sensitive data (passwords, API keys). Create secrets during deployment and reference them in your services.
  ```bash
  echo "my-secret-value" | docker secret create my_secret -
  ```

- **Private Networks for Swarm Traffic:**  
  Ensure manager/worker communications occur over a private VLAN/VPC. When creating overlay networks, use:
  ```bash
  docker network create --driver overlay --opt encrypted my_overlay_network
  ```

### Host and OS Hardening

- **Patch & Update:**  
  Regularly update your Linux distribution and kernel to apply security patches.

- **SSH Hardening:**  
  - Enforce key-based authentication.
  - Disable root login.
  - Consider using an SSH bastion host or VPN.
  
- **Firewall Configuration:**  
  Use iptables or nftables to whitelist only necessary inbound/outbound connections.

- **SELinux/AppArmor:**  
  Enable SELinux (for Red Hat-based distros) or AppArmor (for Ubuntu/Debian) to add extra process-level isolation.

### Cloud-Specific Controls (AWS)

- **AWS Security Groups:**  
  Restrict inbound/outbound traffic to only what’s necessary for your HIE components.
  
- **External WAF:**  
  Consider AWS WAF or third-party services to protect your public endpoints.

- **Load Balancer:**  
  Use AWS ALB/NLB to distribute traffic and integrate with AWS WAF.

- **EBS/RDS Encryption:**  
  Use KMS-managed keys to encrypt data volumes and databases.

- **IAM Roles:**  
  Grant least privilege permissions to your EC2 instances and containers.

- **Monitoring:**  
  Enable CloudWatch and GuardDuty for real-time threat detection and log analysis.

---

### Docker Secrets and Swarm Locking

- **Docker Secrets:** Store sensitive configuration (e.g., passwords) as Docker secrets. Reference these secrets in your service definitions.
- **Swarm Locking:** Use the CA rotation command (as shown above) to secure your swarm’s CA key.

---

## Component Modules

Each package listed in the configuration file corresponds to a containerized module in the HIE. Below is a brief description of each:

### Interoperability Layer – OpenHIM
- **Purpose:** Acts as the central mediator for all data exchange. It validates, routes, and logs messages between HIE components.
- **Configuration:** Managed via environment variables (e.g., API ports, MongoDB URLs).

### Reverse Proxy – Nginx
- **Purpose:** Provides a reverse proxy layer to direct incoming requests to the appropriate internal services.
- **Configuration:** Uses the DOMAIN_NAME and SUBDOMAINS to configure virtual hosts.

### FHIR Datastore – HAPI FHIR
- **Purpose:** Serves as the FHIR compliant datastore for healthcare records.
- **Configuration:** Linked with the OpenHIM layer for secure data exchange and uses Postgres as the backend.

### Monitoring
- **Purpose:** Collects metrics and logs from all services to facilitate system health monitoring and debugging.
- **Configuration:** Environment variables define memory and instance limits.

### Database Modules – Postgres & MySQL
- **Purpose:** Provide robust data storage for different parts of the HIE.
- **Configuration:** Integrated with replication settings (for Postgres) and tailored resource allocations.

### Analytics Datastore – ElasticSearch
- **Purpose:** Stores and indexes analytics data, enabling rapid query and reporting.
- **Configuration:** Resource limits ensure that heavy data loads do not impact system performance.

### Message Bus – Kafka
- **Purpose:** Facilitates asynchronous message passing between HIE components.
- **Configuration:** Topics and host addresses are defined through environment variables.

### Shared Health Record – FHIR / OpenSHR
- **Purpose:** Manages shared patient records in a standardized FHIR format.
- **Configuration:** Tightly integrated with the FHIR datastore and OpenHIM for secure data flow.

### Sedish Haiti Custom Packages
- **Modules:** 
  - **emr-isanteplus**
  - **data-pipeline-isanteplus**

- **Purpose:** These packages provide additional functionality specific to the Sedish Haiti deployment, such as electronic medical records, data pipelines, and document storage.
- **Configuration:** Managed through package-specific environment variables and integrated with the core HIE components.

---

## Summary of Deployment Steps

1. **Clone the Repository:**  
   ```bash
   git clone https://github.com/your-org/sedish-haiti.git
   cd sedish-haiti
   ```

2. **Set Up the Environment:**  
   Ensure your `.env` file is correctly configured (see sample above).

3. **Initialize Docker Swarm (if not already):**  
   ```bash
   docker swarm init
   ```

4. **Deploy the Instant Project:**  
   Use the instant OpenHIE CLI command to start the project:
   ```bash
   ./instant project up --env-file .env
   ```
   This command will:
   - Pull the required Docker images.
   - Create Docker services for each package.
   - Mount logs to the specified logPath (e.g., `/tmp/logs`).

5. **Verify Deployment:**  
   Check service status with:
   ```bash
   docker service ls
   ```
   And review logs (e.g., via `docker logs <service_name>`) to ensure each component is running correctly.

---

# Post-Deployment Configuration


After the containers are up, complete the following manual configurations:

## SSL/TLS Certificate Management

This project supports two methods for managing SSL/TLS certificates for HTTPS, primarily for the Nginx reverse proxy:

1.  **Let's Encrypt (Default)**:
    *   Certificates are automatically provisioned and renewed via Certbot.
    *   Active when `USE_PROVIDED_CERTIFICATES="false"` in `.env`.
    *   Handled by `packages/reverse-proxy-nginx/set-secure-mode.sh`.

2.  **Provided Certificates (User-Supplied)**:
    *   Use certificates from a third-party Certificate Authority (CA).
    *   Active when `USE_PROVIDED_CERTIFICATES="true"` in `.env`.

### Using Provided Certificates

1.  **Securely Store Certificates on Host**:
    *   Place your `fullchain.pem` (server certificate + intermediate CAs) and `privkey.pem` (private key) in a secure directory on the host machine where `./build-image.sh` is executed (e.g., `/ssl/your_domain.com/`).
    *   Ensure the private key has restrictive permissions (e.g., `chmod 600 /ssl/your_domain.com/privkey.pem`).

2.  **Configure Host Paths in `.env`**:
    *   In `/home/ubuntu/sedish-haiti.org/.env`, set:
        ```properties
        # Host paths for certificates, used during 'docker build'
        HOST_PROVIDED_CERT_FULLCHAIN_PATH="/ssl/your_domain.com/fullchain.pem"
        HOST_PROVIDED_CERT_PRIVKEY_PATH="/ssl/your_domain.com/privkey.pem"
        ```

3.  **Image Build Process (`./build-image.sh`)**:
    *   `./build-image.sh` reads these host paths from `.env`.
    *   Uses Docker BuildKit's `--secret` feature to securely pass these files to the build process.
    *   Certificates are copied into `/opt/certs/` within the management Docker image. This avoids including them in the build context or image layers directly.

4.  **Nginx Configuration (`packages/reverse-proxy-nginx/swarm.sh`)**:
    *   The `swarm.sh` script uses the in-image paths (defined in `.env` and `package-metadata.json`):
        ```properties
        # Paths inside the management container for swarm.sh
        PROVIDED_CERT_FULLCHAIN_PATH="/opt/certs/fullchain.pem"
        PROVIDED_CERT_PRIVKEY_PATH="/opt/certs/privkey.pem"
        ```
    *   `swarm.sh` creates Docker Swarm secrets from these in-image files.
    *   These Swarm secrets are mounted into the Nginx service container at `/run/secrets/fullchain.pem` and `/run/secrets/privkey.pem`.

### Certificate Renewal

#### Let's Encrypt Certificates
*   Renewal is generally handled by Certbot's standard mechanisms. The initial setup is done by `set-secure-mode.sh`. For ongoing automated renewal, ensure Certbot's renewal process (e.g., via a cron job running `certbot renew` in the Certbot container) is active.

#### Provided Certificates (Manual Process)

1.  **Obtain Renewed Certificates**:
    *   Get the new `fullchain.pem` and `privkey.pem` from your CA.

2.  **Replace Old Certificates on Host**:
    *   Update the files on the host machine at the locations specified by `HOST_PROVIDED_CERT_FULLCHAIN_PATH` and `HOST_PROVIDED_CERT_PRIVKEY_PATH` in your `.env` file.

3.  **Re-build the Management Docker Image**:
    *   This incorporates the new certificates into the image.
        ```bash
        sudo ./build-image.sh
        ```

4.  **Update the Nginx Service**:
    *   Re-initialize or update the `reverse-proxy-nginx` package to apply the new certificates.
        ```bash
        sudo ./instant package init -n reverse-proxy-nginx --env-file .env
        # Or, if already initialized:
        # sudo ./instant package up -n reverse-proxy-nginx --env-file .env
        ```
    *   This triggers `swarm.sh` to create new Docker Swarm secrets from the updated certificates in the management image and updates the Nginx service.

- **OpenHIM Setup:**  
  - Change default passwords.
  - Configure users, roles, and API keys.
  - Set up channels/routes between OpenHIM and HAPI FHIR.
- **Database Authentication:**  
  - Verify that Postgres/MySQL instances are secure and that credentials are correctly passed via Docker secrets.
- **Client Systems Registration:**  
  - Add any external systems or client registries required to interface with the HIE.
- **Connectivity Testing:**  
  - Test data flows between components (e.g., send test FHIR messages through OpenHIM and verify reception in HAPI FHIR).
  
---

## Troubleshooting & Logging

- **Logs:**  
  All service logs are stored in `/tmp/logs` (or the location specified by `BASHLOG_FILE_PATH` in your .env file). Review these logs for error messages and warnings.
- **Health Checks:**  
  Use built-in container health checks and monitor via Docker Swarm’s service status.
- **Security Audits:**  
  Periodically rotate secrets and swarm CA keys. Review AWS CloudWatch and GuardDuty logs for any anomalies.

---

## Additional Resources

- [Instant OpenHIE Documentation](https://jembi.gitbook.io/instant-v2)
- [Jembi Platform README on GitHub](https://github.com/jembi/platform/blob/main/README.md)
- [Docker Swarm Best Practices](https://docs.docker.com/engine/swarm/how-swarm-mode-works/)
- [AWS Security Best Practices](https://aws.amazon.com/security/)
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)

~