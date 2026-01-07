./build-custom-images.sh 
./build-image.sh

#openhim

# ./instant package remove -n interoperability-layer-openhim --env-file .env
# ./instant package init -n interoperability-layer-openhim --env-file .env 
# ./instant package down -n interoperability-layer-openhim --env-file .env
# ./instant package up -n interoperability-layer-openhim --env-file .env 


#reverse proxy
#./instant package remove -n reverse-proxy-nginx --env-file .env
#./instant package init -n reverse-proxy-nginx --env-file .env
# ./instant package down -n reverse-proxy-nginx --env-file .env
# ./instant package up -n reverse-proxy-nginx --env-file .env


#./instant project up --env-file .env
#./instant project down --env-file .env
#./instant project destroy --env-file .env
#./instant project init --env-file .env

# PostGRES
# ./instant package remove -n database-postgres --env-file .env
#./instant package init -n database-postgres --env-file .env

# keycloak
# ./instant package remove -n identity-access-manager-keycloak --env-file .env
# ./instant package init -n identity-access-manager-keycloak --env-file .env

#mysql 
#./instant package remove -n database-mysql --env-file .env
# ./instant package init -n database-mysql --env-file .env 
# ./instant package down -n database-mysql --env-file .env
# ./instant package up -n database-mysql --env-file .env

#isanteplus
#./instant package remove -n emr-isanteplus --env-file .env
# ./instant package init -n emr-isanteplus --env-file .env 

# #opencr
#./instant package remove -n client-registry-opencr --env-file .env
#./instant package init -n client-registry-opencr --env-file #.env
#./instant package down -n client-registry-opencr --env-file .env
#./instant package up -n client-registry-opencr --env-file .env

# monitoring
./instant package remove -n monitoring --env-file .env
./instant package init -n monitoring --env-file .env -d
# ./instant package down -n monitoring --env-file .env
# ./instant package up -n monitoring --env-file .env -d

#data pipeline
# ./instant package remove -n data-pipeline-isanteplus --env-file .env
#./instant package init -n data-pipeline-isanteplus --env-file .env
#./instant package down -n data-pipeline-isanteplus --env-file .env
#./instant package up -n data-pipeline-isanteplus --env-file .env



#kafka
#./instant package remove -n message-bus-kafka --env-file .env
#./instant package init -n message-bus-kafka --env-file .env
#./instant package down -n message-bus-kafka --env-file .env
#./instant package up -n message-bus-kafka --env-file .env

#fhiratastore-hapi-fhir
#./instant package remove -n fhiratastore-hapi-fhir --env-file .env
#./instant package init -n fhiratastore-hapi-fhir --env-file .env
#./instant package down -n fhiratastore-hapi-fhir --env-file .env
#./instant package up -n fhiratastore-hapi-fhir --env-file .env 

#shared-health-record-fhir 
#./instant package remove -n shared-health-record-fhir --env-file .env
#./instant package init -n shared-health-record-fhir --env-file .env 
#./instant package down -n shared-health-record-fhir --env-file .env
#./instant package up -n shared-health-record-fhir --env-file .env

# # LNSP Mediator
#./instant package remove -n lnsp-mediator --env-file .env
#./instant package init -n lnsp-mediator --env-file .env 
# ./instant package down -n lnsp-mediator --env-file .env
# ./instant package up -n lnsp-mediator --env-file .env -d


