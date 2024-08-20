import { Injectable } from '@nestjs/common';
import { LabOrder, LabOrderDocument } from './lab-order.schema';
import { LabOrderDAO } from './lab-order.dao';
import { NotificationService } from '../notification/notification.service';
import { Hl7Service } from 'src/core/hl7/hl7.service';
import e from 'express';

const documentSubmissionSuccessTemplate = `------=_Part_60435_1628391534.1724167510003
Content-Type: application/xop+xml; charset=utf-8; type="application/soap+xml"


<env:Envelope 
  xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Header 
    xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To env:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
    <wsa:Action>urn:ihe:iti:2007:ProvideAndRegisterDocumentSet-bResponse</wsa:Action>
    <wsa:MessageID>urn:uuid:38c3d8a5-00b3-4b84-b1f9-2c72c5b239e4</wsa:MessageID>
    <wsa:RelatesTo>uuid:ab7948d8-26e5-4a9d-b719-3c2a477ca120</wsa:RelatesTo>
  </env:Header>
  <env:Body>
    <ns3:RegistryResponse 
      xmlns:ns3="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" 
      xmlns:ns2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" 
      xmlns:ns4="urn:ihe:iti:xds-b:2007" 
      xmlns:ns5="urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0" 
      xmlns:ns6="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success"/>
    </env:Body>
  </env:Envelope>
------=_Part_60435_1628391534.1724167510003--`;

const documentSubmissionGeneralFailureTemplate = `------=_Part_60435_1628391534.1724167510003
Content-Type: application/xop+xml; charset=utf-8; type="application/soap+xml"


<env:Envelope 
  xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Header 
    xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To env:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
    <wsa:Action>urn:ihe:iti:2007:ProvideAndRegisterDocumentSet-bResponse</wsa:Action>
    <wsa:MessageID>urn:uuid:285e9789-9a02-48e0-9fa6-76efa561c249</wsa:MessageID>
    <wsa:RelatesTo>uuid:5c666fec-2b59-4fa0-a660-2967e1a0c67d</wsa:RelatesTo>
  </env:Header>
  <env:Body>
    <ns3:RegistryResponse 
      xmlns:ns3="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" 
      xmlns:ns2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" 
      xmlns:ns4="urn:ihe:iti:xds-b:2007" 
      xmlns:ns5="urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0" 
      xmlns:ns6="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure">
      <ns3:RegistryErrorList>
        <ns3:RegistryError errorCode="XDSRepositoryError" severity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error"/>
      </ns3:RegistryErrorList>
    </ns3:RegistryResponse>
  </env:Body>
</env:Envelope>
------=_Part_60435_1628391534.1724167510003--`;


const documentFoundTemplate = `------=_Part_59239_818160219.1723569579332
Content-Type: application/xop+xml; charset=utf-8; type="application/soap+xml"


<env:Envelope 
  xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Header 
    xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To env:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
    <wsa:Action>urn:ihe:iti:2007:RetrieveDocumentSetResponse</wsa:Action>
    <wsa:MessageID>urn:uuid:0da76f77-05e7-4f5f-a2aa-26a1969d8e03</wsa:MessageID>
    <wsa:RelatesTo>urn:uuid:1551bec4-61a4-4e90-81da-adffa8c5ad49</wsa:RelatesTo>
  </env:Header>
  <env:Body>
    <ns4:RetrieveDocumentSetResponse 
      xmlns:ns4="urn:ihe:iti:xds-b:2007" 
      xmlns:ns2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" 
      xmlns:ns3="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" 
      xmlns:ns5="urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0" 
      xmlns:ns6="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0">
      <ns3:RegistryResponse status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success"/>
      <ns4:DocumentResponse>
        <ns4:RepositoryUniqueId>{{Repository ID}}</ns4:RepositoryUniqueId>
        <ns4:DocumentUniqueId>{{documentId}}</ns4:DocumentUniqueId>
        <ns4:mimeType>text/plain</ns4:mimeType>
        <ns4:Document>
          <xop:Include 
            xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:db353581-b1b7-4421-b941-f1cc46131ea6%40null"/>
          </ns4:Document>
        </ns4:DocumentResponse>
      </ns4:RetrieveDocumentSetResponse>
    </env:Body>
  </env:Envelope>
------=_Part_59239_818160219.1723569579332
Content-Type: text/plain
Content-ID: 
  <db353581-b1b7-4421-b941-f1cc46131ea6@null>
Content-Transfer-Encoding: binary

{{hl7Message}}

------=_Part_59239_818160219.1723569579332--`;

const documentNotFoundTemplate = `------=_Part_59241_1582618584.1723571227473
Content-Type: application/xop+xml; charset=utf-8; type="application/soap+xml"


<env:Envelope 
  xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Header 
    xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To env:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
    <wsa:Action>urn:ihe:iti:2007:RetrieveDocumentSetResponse</wsa:Action>
    <wsa:MessageID>urn:uuid:49402a17-a02c-4890-99a2-695ccea412ec</wsa:MessageID>
    <wsa:RelatesTo>urn:uuid:3fa010af-3624-4f03-bdc2-28bb0ca76405</wsa:RelatesTo>
  </env:Header>
  <env:Body>
    <ns4:RetrieveDocumentSetResponse 
      xmlns:ns4="urn:ihe:iti:xds-b:2007" 
      xmlns:ns2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" 
      xmlns:ns3="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" 
      xmlns:ns5="urn:oasis:names:tc:ebxml-regrep:xsd:lcm:3.0" 
      xmlns:ns6="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0">
      <ns3:RegistryResponse status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure">
        <ns3:RegistryErrorList>
          <ns3:RegistryError codeContext="Document not found! document UID:{{documentId}}" errorCode="XDSMissingDocument" location="2.25.8729812114953458533" severity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error">Document not found! document UID:2.25.8729812114953458533</ns3:RegistryError>
        </ns3:RegistryErrorList>
      </ns3:RegistryResponse>
    </ns4:RetrieveDocumentSetResponse>
  </env:Body>
</env:Envelope>
------=_Part_59241_1582618584.1723571227473--`;

@Injectable()
export class LabOrderService {
  constructor(
    private readonly labOrderDAO: LabOrderDAO,
    private readonly notificationService: NotificationService,
    private readonly hl7Service: Hl7Service,
  ) {}

  async create(labOrder: LabOrder) {
    const newLabOrder = (await this.labOrderDAO.create(
      labOrder,
    )) as LabOrderDocument;

    this.notificationService.notifySubscribers(newLabOrder.documentId);

    return newLabOrder;
  }

  async findById(documentId: string) {
    return this.labOrderDAO.findByDocumentId(documentId);
  }

  async findAll() {
    return this.labOrderDAO.find();
  }

  async parseLabOrderDocument(xmlMultipart: any): Promise<LabOrder> {
    // 1. Get Content-Id of the last document in multipart message
    // Content-Id: <780d4ac3-bf6e-48cc-acd4-b3208c65f974>
    const contentIdPattern = /Content-Id:\s*<([^>]+)>/g;
    let lastContentId: string | null = null;
    let contentMatch: RegExpExecArray | null;
    while ((contentMatch = contentIdPattern.exec(xmlMultipart))) {
      lastContentId = contentMatch[1];
    }

    // 2. Look up Document id of related Document tag in the XML
    /* 
    <Document id="699866eb-c6da-42f3-a09e-e2f652d73bf6/1accccd7-dc27-4ac8-bbf3-84c500130202/f037e97b-471e-4898-a07c-b8e169e0ddc4/56cf5b28-c0b5-4d57-8dde-a43e93e269d2/2023-03-24/2.25.7749110347209424508">
      <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:780d4ac3-bf6e-48cc-acd4-b3208c65f974"></xop:Include>
    </Document>
    */
    const documentIdPattern = new RegExp(
      `<Document id="([^"]+)"[\\s\\S]*?<xop:Include[^>]+href="cid:${lastContentId}"[^>]*>`,
    );
    const documentMatch = xmlMultipart.match(documentIdPattern);
    const documentId = documentMatch ? documentMatch[1] : null;

    // 3. Find ExternalIdentifier tag for this document ID:
    /*
    <ns2:ExternalIdentifier id="eid0" identificationScheme="urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab" registryObject="699866eb-c6da-42f3-a09e-e2f652d73bf6/1accccd7-dc27-4ac8-bbf3-84c500130202/f037e97b-471e-4898-a07c-b8e169e0ddc4/56cf5b28-c0b5-4d57-8dde-a43e93e269d2/2023-03-24/2.25.7749110347209424508" value="2.25.{{documentId2}}">
      <ns2:Name>
        <ns2:LocalizedString value="XDSDocumentEntry.uniqueId"></ns2:LocalizedString>
      </ns2:Name>
    </ns2:ExternalIdentifier>
    */
    const externalIdentifierPattern = new RegExp(
      `<ns2:ExternalIdentifier id="eid0" identificationScheme="[^"]+" registryObject="${documentId}" value="([^"]+)">`,
    );
    const externalIdentifierMatch = xmlMultipart.match(
      externalIdentifierPattern,
    );
    const externalIdentifierValue = externalIdentifierMatch
      ? externalIdentifierMatch[1]
      : null;

    const newLabOrder = new LabOrder();

    // 4. Grab the value attribute to get the document ID to use as the documentId in the LabOrder objec
    newLabOrder.documentId = externalIdentifierValue;

    // 5. Get HL7 message from the XML
    const lines = xmlMultipart.split('\n');
    let hl7Message = '';
    let startParsing = false;

    for (const line of lines) {
      if (line.startsWith('MSH|^~\\&|')) {
        startParsing = true;
      }

      if (startParsing) {
        hl7Message += line + '\n';
      }

      if (line.startsWith('OBR|')) {
        break;
      }
    }

    hl7Message = hl7Message.trim();
    newLabOrder.hl7Contents = hl7Message;

    const parsedHl7Message = await this.hl7Service.parseMessageContent(
      hl7Message.replaceAll('\n', '\r'),
      'incoming-order-message',
    );

    // 6. Get the Lab Order ID from the HL7 message ORC-2
    const orc2Field = parsedHl7Message.get('ORC', 'Placer Order Number')
    if (orc2Field) newLabOrder.labOrderId = orc2Field;
    else throw new Error('Lab Order ID not found in HL7 message');

    // 7. Get the Facility ID from the HL7 message PV1-3 (assigned patient location)
    const pv13Field = parsedHl7Message.get('PV1', 'Assigned Patient Location');
    if (pv13Field) newLabOrder.facilityId = pv13Field;
    else throw new Error('Facility ID not found in HL7 message');

    // 8. Save the Alternate Visit Id
    const altVisitId = parsedHl7Message.get('PV1', 'Alternate Visit')[0];
    if (altVisitId) newLabOrder.alternateVisitId = altVisitId;
    else throw new Error('Alternate Visit ID not found in HL7 message');
    
    // 9. Save the Patient ID
    const patientId = parsedHl7Message.get('PID', 'Patient ID')[0];
    if (patientId) newLabOrder.patientId = patientId;
    else throw new Error('Patient ID not found in HL7 message');
    
    newLabOrder.documentContents = xmlMultipart;

    return newLabOrder;
  }

  parseLabOrderRequest(xmlPayload: any): string {
    return xmlPayload['soap:envelope']['soap:body'][0][
      'xdsb:retrievedocumentsetrequest'
    ][0]['xdsb:documentrequest'][0]['xdsb:documentuniqueid'][0];
  }

  labOrderSubmissionSuccess() {
    return documentSubmissionSuccessTemplate;
  }

  labOrderSubmissionGeneralFailure() {
    return documentSubmissionGeneralFailureTemplate;
  }

  decorateLabOrderResponse(labOrder: LabOrder) {
    return documentFoundTemplate
      .replace('{{Repository ID}}', '1.3.6.1.4.1.21367.2010.1.2.1125')
      .replace('{{documentId}}', labOrder.documentId)
      .replace('{{hl7Message}}', labOrder.hl7Contents);
  }

  documentNotFoundResponse(documentId: string) {
    return documentNotFoundTemplate.replace('{{documentId}}', documentId);
  }
}
