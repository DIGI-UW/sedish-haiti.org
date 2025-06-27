import { Injectable, HttpStatus } from '@nestjs/common';
import { LabOrder, LabOrderDocument } from './lab-order.schema';
import { LabOrderDAO } from './lab-order.dao';
import { ErroredRequest } from './errored-request.schema';
import { ErroredRequestDAO } from './errored-request.dao';
import { NotificationService } from '../notification/notification.service';
import { Hl7Service } from '../../core/hl7/hl7.service';

/*
const example_message = `------=_Part_59239_818160219.1723569579332
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
        <ns4:RepositoryUniqueId>1.3.6.1.4.1.21367.2010.1.2.1125</ns4:RepositoryUniqueId>
        <ns4:DocumentUniqueId>2.25.7430734057429358897</ns4:DocumentUniqueId>
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

MSH|^~\&||LNSP|||20240813131934||ORM^O01^ORM_O01|2024081313193400010|D|2.5
PID||1122132411^^^^^ND11221|||Demo^Patient|LUCIE|19550822|F|||^^^^^HTI|||||^Lòt||685923^^^^^LNSP
PV1|||11221||||11221^Demo^Provider|||||||||||||||||||||||||||||||||||||20240813||||||b26a3921-a7c4-43f3-9501-995ac9cf88e8^f037e97b-471e-4898-a07c-b8e169e0ddc4^^353faea9-198c-4827-a3c8-55eb1570dd4a^671eeb63-047a-42c3-9fb0-6649565f2556
ORC|NW|11221685923|||||^^^20240813131934||20240813131934|||11221^Demo^Provider|||||||||||||||||25836-8
OBR||11221685923||VLCVR|||20240813131934||||O|||||11221^Demo^Provider|||||||||||^^^20240813131934

------=_Part_59239_818160219.1723569579332--`;
*/

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
        <ns3:RegistryError errorCode="XDSRepositoryError" severity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error" codeContext="{{error}}"/>
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
          <ns3:RegistryError codeContext="Document not found! document UID:{{documentId}}" errorCode="XDSMissingDocument" location="{{documentId}}" severity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error">Document not found! document UID:{{documentId}}</ns3:RegistryError>
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
    private readonly erroredRequestDAO: ErroredRequestDAO,
    private readonly notificationService: NotificationService,
    private readonly hl7Service: Hl7Service,
  ) {}

  private readonly contentType =
    'Multipart/Related; boundary="----=_Part_60435_1628391534.1724167510003"; type="application/xop+xml"; start-info="application/soap+xml";charset=UTF-8';

  async handleCreateLabOrder(body: string) {
    let responseBody;
    let status = HttpStatus.OK; // Always return 200 to prevent client retries
    
    try {
      const labOrder: LabOrder = await this.parseLabOrderDocument(body);
      const result = await this.create(labOrder);

      if (result) {
        this.logger.log(`Successfully processed lab order with documentId: ${result.documentId}`);
        responseBody = this.labOrderSubmissionSuccess();
      } else {
        console.log('Lab order creation returned null/undefined result');
        responseBody = this.labOrderSubmissionSuccess(); // Still return success to prevent retries
      }
    } catch (error) {
      // Log the error and save it as an errored order, but still return 200
      console.error('Error processing lab order:', error.message);
      console.error('Request body:', body);
      
      // Try to save the errored request for auditing
      try {
        await this.saveErroredOrder(body, error.message);
      } catch (saveError) {
        console.error('Failed to save errored order:', saveError.message);
      }
      
      // Return success response to prevent client retries
      responseBody = this.labOrderSubmissionSuccess();
    }
    
    return { contentType: this.contentType, responseBody, status };
  }

  async handleGetLabOrderById(xmlPayload: any) {
    const documentId = this.parseLabOrderRequest(xmlPayload);
    const result = await this.findById(documentId);

    let responseBody;
    let status;

    const contentType =
      'multipart/related;boundary="----=_Part_59239_818160219.1723569579332"; type="application/xop+xml"; start-info="application/soap+xml";charset=UTF-8';
    //const contentType = 'multipart/related;start="<rootpart*59239_818160219.1723569579332@example.jaxws.sun.com>";type="application/xop+xml";boundary="uuid:59239_818160219.1723569579332";start-info="application/soap+xml;action="urn:ihe:iti:2007:RetrieveDocumentSet""';

    if (result && result.length === 1) {
      responseBody = this.decorateLabOrderResponse(result[0]);
      status = HttpStatus.OK;
    } else {
      // Return Dummy result to fix client retry issue
      const simResult = new LabOrder();
      simResult.documentId = documentId;
      simResult.hl7Contents = 'MSH|^~\\&|LNSP|||20240813131934||ORM^O01^ORM_O01|2024081313193400010|D|2.5';
      simResult.labOrderId = '';
      simResult.facilityId = '';
      simResult.alternateVisitId = '';
      simResult.patientId = '';
      simResult.documentContents = '';
      responseBody = this.decorateLabOrderResponse(simResult);
      status = HttpStatus.OK;
    }

    return { contentType, responseBody, status };
  }

  async create(labOrder: LabOrder) {
    // Check if a lab order with the same internal identifiers already exists
    const existingOrder = await this.labOrderDAO.findByInternalIdentifiers(
      labOrder.labOrderId,
      labOrder.patientId,
      labOrder.facilityId
    );

    if (existingOrder) {
      // If order exists, update it with duplicate information
      console.log(`Duplicate lab order detected for labOrderId: ${labOrder.labOrderId}, patientId: ${labOrder.patientId}, facilityId: ${labOrder.facilityId}`);
      console.log(`Existing order has ${existingOrder.duplicateOrders || 0} duplicates already`);
      
      existingOrder.duplicateOrders = (existingOrder.duplicateOrders || 0) + 1;
      existingOrder.duplicateDocumentContents = existingOrder.duplicateDocumentContents || [];
      existingOrder.duplicateHl7Contents = existingOrder.duplicateHl7Contents || [];
      
      // Add the new document and HL7 contents to the arrays for auditing
      existingOrder.duplicateDocumentContents.push(labOrder.documentContents);
      existingOrder.duplicateHl7Contents.push(labOrder.hl7Contents);
      
      // Save the updated order
      const updatedOrder = await existingOrder.save();
      
      console.log(`Updated existing order with documentId: ${updatedOrder.documentId}, now has ${updatedOrder.duplicateOrders} duplicates`);
      
      // Still notify subscribers about the duplicate
      this.notificationService.notifySubscribers(updatedOrder.documentId);
      
      return updatedOrder;
    } else {
      // If no existing order, create a new one
      const newLabOrder = (await this.labOrderDAO.create(
        labOrder,
      )) as unknown as LabOrderDocument;

      this.notificationService.notifySubscribers(newLabOrder.documentId);

      return newLabOrder;
    }
  }

  async findById(documentId: string) {
    return this.labOrderDAO.findByDocumentId(documentId);
  }

  async findAll() {
    return this.labOrderDAO.find();
  }

  async saveErroredOrder(body: string, errorMessage: string) {
    try {
      // Create an errored request record
      const erroredRequest = new ErroredRequest();
      erroredRequest.requestId = `ERROR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      erroredRequest.requestBody = body;
      erroredRequest.errorMessage = errorMessage;
      erroredRequest.errorType = this.categorizeError(errorMessage);
      erroredRequest.attemptedParsing = true;
      
      // Try to extract any partial data that might be useful
      erroredRequest.partialData = this.extractPartialData(body);
      
      const savedRequest = await this.erroredRequestDAO.create(erroredRequest);
      console.log(`Saved errored request with requestId: ${erroredRequest.requestId}`);
      
      return savedRequest;
    } catch (error) {
      console.error('Failed to save errored request to database:', error.message);
      throw error;
    }
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('HL7 message not found')) {
      return 'HL7_PARSING_ERROR';
    } else if (errorMessage.includes('Lab Order ID not found')) {
      return 'MISSING_ORDER_ID';
    } else if (errorMessage.includes('Patient ID not found')) {
      return 'MISSING_PATIENT_ID';
    } else if (errorMessage.includes('Facility ID not found')) {
      return 'MISSING_FACILITY_ID';
    } else if (errorMessage.includes('Alternate Visit ID not found')) {
      return 'MISSING_VISIT_ID';
    } else {
      return 'GENERAL_PARSING_ERROR';
    }
  }

  private extractPartialData(body: string): string {
    try {
      // Try to extract any identifiable information from the request
      const contentIdMatch = body.match(/Content-Id:\s*<([^>]+)>/);
      const documentIdMatch = body.match(/<Document id="([^"]+)"/);
      const mshMatch = body.match(/MSH\|[^\r\n]*/);
      
      const partialData: any = {};
      
      if (contentIdMatch) {
        partialData.contentId = contentIdMatch[1];
      }
      
      if (documentIdMatch) {
        partialData.documentId = documentIdMatch[1];
      }
      
      if (mshMatch) {
        partialData.hl7Header = mshMatch[0];
      }
      
      return JSON.stringify(partialData);
    } catch (error) {
      return 'Could not extract partial data';
    }
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
    let lines = xmlMultipart.split('\r\n');

    // Handle postman vs. isanteplus eol encodings
    if (lines.length === 1) {
      lines = xmlMultipart.split('\n');
    }

    let hl7Message = '';

    // Find line that starts HL7 message
    const firstHl7LineI = lines.findIndex((line: string) =>
      line.startsWith('MSH|^~\\&|'),
    );
    const lastHl7LineI = lines.findIndex((line: string) =>
      line.startsWith('OBR|'),
    );

    if (firstHl7LineI === -1) throw new Error('HL7 message not found in XML');
    const firstHl7Line = lines[firstHl7LineI];

    if (lastHl7LineI === -1) {
      if (firstHl7Line.includes('\r')) {
        hl7Message = firstHl7Line;
      } else {
        throw new Error('HL7 message not found in XML');
      }
    } else {
      hl7Message = lines.slice(firstHl7LineI, lastHl7LineI).join('\r');
    }

    hl7Message = hl7Message.trim();
    newLabOrder.hl7Contents = hl7Message;

    const parsedHl7Message = await this.hl7Service.parseMessageContent(
      hl7Message.replaceAll('\n', '\r'),
      'incoming-order-message',
    );

    // 6. Get the Lab Order ID from the HL7 message ORC-2
    const orc2Field = parsedHl7Message.get('ORC', 'Placer Order Number');
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

  labOrderSubmissionGeneralFailure(error?: string) {
    if (!error) {
      error = 'General error';
    }
    return documentSubmissionGeneralFailureTemplate.replace('{{error}}', error);
  }

  decorateLabOrderResponse(labOrder: LabOrder) {
    return documentFoundTemplate
      .replace('{{Repository ID}}', '1.3.6.1.4.1.21367.2010.1.2.1125')
      .replace('{{documentId}}', labOrder.documentId)
      .replace('{{hl7Message}}', labOrder.hl7Contents);
  }

  documentNotFoundResponse(documentId: string) {
    return documentNotFoundTemplate.replaceAll('{{documentId}}', documentId);
  }
}
