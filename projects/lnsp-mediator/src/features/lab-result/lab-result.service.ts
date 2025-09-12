import { Injectable, HttpStatus } from '@nestjs/common';
import { LabResult } from './lab-result.schema';
import { parseStringPromise } from 'xml2js';
import * as xpath from 'xml2js-xpath';
import { Hl7Service } from 'src/core/hl7/hl7.service';
import { LabResultDAO } from './lab-result.dao';

const labResultCreationErrorTemplate = `------=_Part_59931_102464640.1723834961072
Content-Type: application/xop+xml; charset=utf-8; type="application/soap+xml"


<env:Envelope 
  xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Header 
    xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To env:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
    <wsa:Action>urn:ihe:iti:2007:ProvideAndRegisterDocumentSet-bResponse</wsa:Action>
    <wsa:MessageID>urn:uuid:4e80d1a2-23c6-47b7-8594-13a80491823a</wsa:MessageID>
    <wsa:RelatesTo>urn:uuid:48bee880-ffe9-4b1b-8aeb-51308da7c3ba</wsa:RelatesTo>
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
------=_Part_59931_102464640.1723834961072--`;

const labResultCreationSuccessTemplate = `------=_Part_59931_102464640.1723834961072
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
------=_Part_59931_102464640.1723834961072--`;

const resultListTemplate = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns2:GetMessagesResponse xmlns="http://www.w3.org/2005/08/addressing"
  xmlns:ns2="http://docs.oasis-open.org/wsn/b-2"
  xmlns:ns4="http://docs.oasis-open.org/wsn/t-1"
  xmlns:ns3="http://docs.oasis-open.org/wsrf/bf-2">
{{result-list}}
</ns2:GetMessagesResponse>`;

const resultItemTemplate = `  <ns2:NotificationMessage>
    <ns2:Topic>{{facilityId}}</ns2:Topic>
    <ns2:Message>
      <root documentId="{{documentId}}"
        xmlns=""
        xmlns:ns5="http://www.w3.org/2005/08/addressing">{{base64Message}}</root>
    </ns2:Message>
  </ns2:NotificationMessage>`;

@Injectable()
export class LabResultService {
  constructor(
    private readonly hl7Service: Hl7Service,
    private readonly labResultDAO: LabResultDAO,
  ) {}

  private readonly contentType =
    'Multipart/Related; boundary="----=_Part_59931_102464640.1723834961072"; type="application/xop+xml"; start-info="application/soap+xml";charset=UTF-8';

  async handleCreateLabResult(xmlPayload: any) {
    let responseBody;
    let status;
    try {
      const labResult: LabResult =
        await this.parseLabResultDocument(xmlPayload);
      const createdLabResult = await this.create(labResult);

      if (createdLabResult) {
        responseBody = this.labResultSubmissionSuccess();
        status = HttpStatus.OK;
      } else {
        responseBody = this.labResultSubmissionGeneralFailure("Could not create lab result");
        status = HttpStatus.UNPROCESSABLE_ENTITY;
      }
    } catch (error) {
      responseBody = this.labResultSubmissionGeneralFailure(error.message);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }
    return { contentType: this.contentType, responseBody, status };
  }

  async handleGetLabResultsByFacility(xmlPayload: any) {
    const parsedData = await this.parseLabResultRequest(xmlPayload);
    const resultList = await this.findAllByFacilityId(
      parsedData.facilityId,
      parsedData.sinceDate,
    );

    let responseBody;
    let status;
    const contentType = 'application/xml; charset=UTF-8';

    if (resultList.length === 0) {
      status = HttpStatus.ACCEPTED;
      responseBody = this.decorateResultList([]);
    } else {
      responseBody = this.decorateResultList(resultList);
      status = HttpStatus.ACCEPTED;
    }

    return { contentType, responseBody, status };
  }

  async create(labResult: LabResult) {
    const latestResult = await this.labResultDAO.findByLabOrderId(labResult.labOrderId);
    labResult.version = latestResult ? latestResult.version + 1 : 1;
  
    return this.labResultDAO.create(labResult); 
  }
  

  async findByLabOrderId(labOrderId: string) {
    return this.labResultDAO.findOne({ labOrderId });
  }

  async findAllByFacilityId(
    facilityId: string,
    sinceDate: Date,
  ): Promise<LabResult[]> {
    return this.labResultDAO.findByFacilityId(facilityId, sinceDate);
  }

  async parseLabResultDocument(xmlPayload: any): Promise<LabResult> {
    // Extract soap envelope section from xmlPayload and parse xml
    // Grab everything between <soap:Envelope  and </soap:Envelope>

    const soapEnvelope = xmlPayload.match(
      /<soap:Envelope.*<\/soap:Envelope>/s,
    )[0];
    const parsedXml = await parseStringPromise(soapEnvelope, {
      explicitArray: false,
    });

    const xdsDocumentEntryUniqueId = xpath.find(
      parsedXml,
      "//rim:ExternalIdentifier[@id='ei8']",
    );
    // const xdsSubmissionSetUniqueId = xpath.find(
    //   parsedXml,
    //   "//rim:ExternalIdentifier[@id='ei11']",
    // );
    // const xdsSubmissionSetSourceId = xpath.find(
    //   parsedXml,
    //   "//rim:ExternalIdentifier[@id='ei12']",
    // );

    // Grab everything between Content-ID: <Payload> and --uuid excluding both patterns:
    const hl7ContentsMatch = xmlPayload.match(
      /Content-ID: <Payload>(.*?)--uuid/s,
    );

    let hl7Contents = '';
    if (hl7ContentsMatch && hl7ContentsMatch[1])
      hl7Contents = hl7ContentsMatch[1];
    else throw new Error('HL7 contents not found in payload');

    const parsedHl7Message = await this.hl7Service.parseMessageContent(
      hl7Contents.replaceAll('\n', '\r'),
      'incoming-result-message',
    );

    const newLabResult = new LabResult();

    // 6. Get the Lab Order ID from the HL7 message ORC-2
    const orc2Field = parsedHl7Message.get('ORC', 'Placer Order Number');
    if (orc2Field) newLabResult.labOrderId = orc2Field;
    else throw new Error('Lab Order ID not found in HL7 message');

    // 7. Get the Facility ID from the HL7 message PV1-3 (assigned patient location)
    const pv13Field = parsedHl7Message.get('PV1', 'Assigned Patient Location');
    if (pv13Field) newLabResult.facilityId = pv13Field;
    else throw new Error('Facility ID not found in HL7 message');

    // 8. Save the Alternate Visit Id
    const altVisitId = parsedHl7Message.get('PV1', 'Alternate Visit')[0];
    if (altVisitId) newLabResult.alternateVisitId = altVisitId;
    else throw new Error('Alternate Visit ID not found in HL7 message');

    // 9. Save the Patient ID
    const patientId = parsedHl7Message.get('PID', 'Patient ID')[0];
    if (patientId) newLabResult.patientId = patientId;
    else throw new Error('Patient ID not found in HL7 message');

    newLabResult.documentId = xdsDocumentEntryUniqueId[0].$.value;
    newLabResult.hl7Contents = hl7Contents;
    newLabResult.documentContents = xmlPayload;

    return newLabResult;
  }

  labResultSubmissionSuccess() {
    return labResultCreationSuccessTemplate;
  }

  labResultSubmissionGeneralFailure(error?: string) {
    if (!error) {
      error = 'General error';
    }
    return labResultCreationErrorTemplate.replace('{{error}}', error);
  }

  parseLabResultRequest(xmlPayload: any): {
    facilityId: string;
    sinceDate: Date;
  } {
    try {
      // If the payload is a string, extract attributes directly via regex
      if (typeof xmlPayload === 'string') {
        const facilityMatch = xmlPayload.match(/<[^:>]*:GetMessages[^>]*\bfacility="([^"]+)"/i);
        const sinceMatch = xmlPayload.match(/<[^:>]*:GetMessages[^>]*\bsince="([^"]+)"/i);

        const facilityId = facilityMatch?.[1];
        const sinceRaw = sinceMatch?.[1];

        if (!facilityId || !sinceRaw) {
          throw new Error('Missing facility or since');
        }

        const sinceDate = new Date(sinceRaw);
        if (isNaN(sinceDate.getTime())) {
          throw new Error('Invalid since date');
        }

        return { facilityId, sinceDate };
      }

      // If the payload is an object (from XML parser), try common shapes
      const envelope =
        xmlPayload['soap-env:envelope'] ||
        xmlPayload['SOAP-ENV:Envelope'] ||
        xmlPayload['Envelope'] ||
        xmlPayload['env:Envelope'] ||
        xmlPayload['soap:Envelope'];

      const bodyNode =
        envelope?.['soap-env:body'] ||
        envelope?.['SOAP-ENV:Body'] ||
        envelope?.['Body'] ||
        envelope?.['env:Body'] ||
        envelope?.['soap:Body'];

      const container = Array.isArray(bodyNode) ? bodyNode[0] : bodyNode;
      const getMessagesNode =
        container?.['ns2:getmessages'] ||
        container?.['ns2:GetMessages'] ||
        container?.['GetMessages'] ||
        container?.['getmessages'];

      const gm = Array.isArray(getMessagesNode) ? getMessagesNode[0] : getMessagesNode;
      const attrs = gm?.$ || gm;

      const facilityId = attrs?.facility;
      const sinceRaw = attrs?.since;
      const sinceDate = new Date(sinceRaw);

      if (!facilityId || isNaN(sinceDate.getTime())) {
        throw new Error('Could not parse facility ID and since date from request');
      }

      return { facilityId, sinceDate };
    } catch (error) {
      throw new Error('Could not parse facility ID and since date from request');
    }
  }

  decorateResultList(resultList: LabResult[]): string {
    let resultItems = '';
    for (const result of resultList) {
      let base64Message = undefined;
      if (result.hl7Contents) {
        const buffer = Buffer.from(result.hl7Contents, 'utf-8');
        base64Message = buffer.toString('base64');
      }

      if (!result.documentId || !result.facilityId || !base64Message) continue;

      resultItems += resultItemTemplate
        .replace('{{facilityId}}', result.facilityId)
        .replace('{{documentId}}', result.documentId)
        .replace('{{base64Message}}', base64Message);
    }

    return resultListTemplate.replace('{{result-list}}', resultItems);
  }
}
