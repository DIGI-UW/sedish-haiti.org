# Docker API Version (required for compatibility with newer Docker daemon)
export DOCKER_API_VERSION=1.44

./build-custom-images.sh 
./build-image.sh

# Project-Level Commands

#./instant project up --env-file .env
#./instant project down --env-file .env
#./instant project destroy --env-file .env
#./instant project init --env-file .env


# PostGRES
# ./instant package remove -n database-postgres --env-file .env.server
# ./instant package init -n database-postgres --env-file .env.server



# OpenHIM Interoperability Layer
# ./instant package remove -n interoperability-layer-openhim --env-file .env.server
# ./instant package init -n interoperability-layer-openhim --env-file .env.server 
# ./instant package down -n interoperability-layer-openhim --env-file .env
# ./instant package up -n interoperability-layer-openhim --env-file .env 


# Reverse Proxy
./instant package remove -n reverse-proxy-nginx --env-file .env.server
./instant package init -n reverse-proxy-nginx --env-file .env.server -d
# ./instant package down -n reverse-proxy-nginx --env-file .env
# ./instant package up -n reverse-proxy-nginx --env-file .env

# Identity Access Manager - Keycloak
# ./instant package remove -n identity-access-manager-keycloak --env-file .env.server
# ./instant package init -n identity-access-manager-keycloak --env-file .env.server


#iSantePlus EMR & MySQL Database
# ./instant package remove -n database-mysql --env-file .env.server
# ./instant package remove -n emr-isanteplus --env-file .env.server              
# ./instant package init -n database-mysql --env-file .env.server 
# ./instant package init -n emr-isanteplus --env-file .env.server 
# ./instant package down -n database-mysql --env-file .env
# ./instant package up -n database-mysql --env-file .env



# #opencr
# ./instant package remove -n client-registry-opencr --env-file .env.server 
# ./instant package init -n client-registry-opencr --env-file .env.server
#./instant package down -n client-registry-opencr --env-file .env.server
#./instant package up -n client-registry-opencr --env-file .env.server

# monitoring
#./instant package remove -n monitoring --env-file .env.server
#./instant package init -n monitoring --env-file .env.server -d
# ./instant package down -n monitoring --env-file .env
# ./instant package up -n monitoring --env-file .env.server -d



#kafka
# ./instant package remove -n message-bus-kafka --env-file .env.server   
# ./instant package init -n message-bus-kafka --env-file .env.server
#./instant package down -n message-bus-kafka --env-file .env.server
#./instant package up -n message-bus-kafka --env-file .env.server

#fhir-datastore-hapi-fhir
# ./instant package remove -n fhir-datastore-hapi-fhir --env-file .env.server
# ./instant package init -n fhir-datastore-hapi-fhir --env-file .env.server -d
#./instant package down -n fhir-datastore-hapi-fhir --env-file .env.server
#./instant package up -n fhir-datastore-hapi-fhir --env-file .env.server 

#shared-health-record-fhir 
# ./instant package remove -n shared-health-record-fhir --env-file .env.server
# ./instant package init -n shared-health-record-fhir --env-file .env.server 
#./instant package down -n shared-health-record-fhir --env-file .env.server
#./instant package up -n shared-health-record-fhir --env-file .env.server

#data pipeline
# ./instant package remove -n data-pipeline-isanteplus --env-file .env.server
# ./instant package init -n data-pipeline-isanteplus --env-file .env.server
#./instant package down -n data-pipeline-isanteplus --env-file .env.server          
#./instant package up -n data-pipeline-isanteplus --env-file .env.server

# # LNSP Mediator
# ./instant package remove -n lnsp-mediator --env-file .env.server
# ./instant package init -n lnsp-mediator --env-file .env.server   
# ./instant package down -n lnsp-mediator --env-file .env.server
# ./instant package up -n lnsp-mediator --env-file .env.server -d


