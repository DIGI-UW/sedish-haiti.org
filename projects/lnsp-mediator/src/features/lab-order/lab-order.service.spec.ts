import { Test, TestingModule } from '@nestjs/testing';
import { LabOrderService } from './lab-order.service';
import { LabOrderDAO } from './lab-order.dao';
import { ErroredRequestDAO } from './errored-request.dao';
import { NotificationService } from '../notification/notification.service';
import { Hl7Service } from '../../core/hl7/hl7.service';
import { LabOrder } from './lab-order.schema';
import Hl7lib from 'nodehl7';

describe('LabOrderService', () => {
  let service: LabOrderService;
  let labOrderDAO: LabOrderDAO;
  let notificationService: NotificationService;

  const mockLabOrderDAO = {
    create: jest.fn(),
    findByInternalIdentifiers: jest.fn(),
    findByDocumentId: jest.fn(),
    find: jest.fn(),
  };

  const mockErroredRequestDAO = {
    create: jest.fn(),
    findByRequestId: jest.fn(),
    findByErrorType: jest.fn(),
    find: jest.fn(),
  };

  const mockNotificationService = {
    notifySubscribers: jest.fn(),
  };

  const mockHl7Service = {
    parseMessageContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrderService,
        {
          provide: LabOrderDAO,
          useValue: mockLabOrderDAO,
        },
        {
          provide: ErroredRequestDAO,
          useValue: mockErroredRequestDAO,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: Hl7Service,
          useValue: mockHl7Service,
        },
      ],
    }).compile();

    service = module.get<LabOrderService>(LabOrderService);
    labOrderDAO = module.get<LabOrderDAO>(LabOrderDAO);
    notificationService = module.get<NotificationService>(NotificationService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseLabOrderDocument', () => {
    const uniqueIdScheme = 'urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab';
    const boundary = '--uuid:f6924879-d62a-4279-9c17-cc65e48ec23e';
    const hl7 = [
      'MSH|^~\\&||LNSP|||20260804145106||ORM^O01^ORM_O01|2026080414510600015|D|2.5',
      'PID||PATIENT-1^^^^^ND|||Demo^Patient|F|19700101',
      'PV1|||FAC-1||||PROV-1|||||||||||||||||||||||||||||||||||||20260803||||||visit-1^^^^alt-visit-1',
      'ORC|NW|ORDER-4417|||||^^^20260803000000',
      'OBR||ORDER-4417||VLCVR|||20260803000000||||O',
    ].join('\r');

    // Documents are listed HL7 last while the attachments are sent HL7 first, so
    // neither "first" nor "last" document is the right one to key on.
    const documents = [
      { registry: 'doc-cda', cid: 'cid-cda', uniqueId: '2.25.111' },
      { registry: 'doc-fhir', cid: 'cid-fhir', uniqueId: '2.25.222' },
      { registry: 'doc-hl7', cid: 'cid-hl7', uniqueId: '2.25.333' },
    ];

    const metadata =
      documents
        .map(
          (doc) =>
            `<ns2:ExternalIdentifier id="eid0" identificationScheme="${uniqueIdScheme}" registryObject="${doc.registry}" value="${doc.uniqueId}"/>`,
        )
        .join('') +
      documents
        .map(
          (doc) =>
            `<Document id="${doc.registry}"><xop:Include href="cid:${doc.cid}"/></Document>`,
        )
        .join('');

    const part = (contentId: string, body: string) =>
      [
        boundary,
        `Content-Id: <${contentId}>`,
        'Content-Type: application/octet-stream',
        'Content-Transfer-Encoding: binary',
        '',
        body,
      ].join('\r\n');

    const payload = [
      [boundary, 'Content-Type: application/xop+xml', '', metadata].join(
        '\r\n',
      ),
      part('cid-hl7', hl7),
      part('cid-cda', '<ClinicalDocument xmlns="urn:hl7-org:v3"/>'),
      part('cid-fhir', '{"resourceType":"Patient","id":"p1"}'),
      `${boundary}--`,
    ].join('\r\n');

    beforeEach(() => {
      mockHl7Service.parseMessageContent.mockResolvedValue({
        get: (segment: string, field: string) => {
          if (segment === 'ORC' && field === 'Placer Order Number')
            return 'ORDER-4417';
          if (segment === 'PV1' && field === 'Assigned Patient Location')
            return 'FAC-1';
          if (segment === 'PV1' && field === 'Alternate Visit')
            return ['alt-visit-1'];
          if (segment === 'PID' && field === 'Patient ID') return ['PATIENT-1'];
          return undefined;
        },
      });
    });

    it('should take the documentId from the document carrying the HL7 message', async () => {
      const labOrder = await service.parseLabOrderDocument(payload);

      expect(labOrder.documentId).toBe('2.25.333');
    });

    it('should store only the HL7 part as hl7Contents', async () => {
      const labOrder = await service.parseLabOrderDocument(payload);

      expect(labOrder.hl7Contents).toBe(hl7);
      expect(labOrder.hl7Contents).not.toContain('ClinicalDocument');
      expect(labOrder.hl7Contents).not.toContain('resourceType');
    });

    it('should match a folded, differently cased Content-ID header', async () => {
      // JAX-WS folds this header onto a continuation line.
      const folded = payload.replace(
        'Content-Id: <cid-hl7>',
        'Content-ID: \r\n  <cid-hl7>',
      );

      await expect(
        service.parseLabOrderDocument(folded),
      ).resolves.toMatchObject({ documentId: '2.25.333' });
    });

    it('should match percent-escaped cid references', async () => {
      const escaped = payload
        .replace('<cid-hl7>', '<cid-hl7@null>')
        .replace('cid:cid-hl7', 'cid:cid-hl7%40null');

      await expect(
        service.parseLabOrderDocument(escaped),
      ).resolves.toMatchObject({ documentId: '2.25.333' });
    });

    it('should fall back to the last referenced document when parts cannot be split', async () => {
      // No leading boundary line, so the payload is scanned as a whole.
      const unsplittable = `${metadata}\r\nContent-Id: <cid-hl7>\r\n\r\n${hl7}`;

      await expect(
        service.parseLabOrderDocument(unsplittable),
      ).resolves.toMatchObject({ documentId: '2.25.333' });
    });

    it('should report a missing unique id rather than persisting null', async () => {
      const withoutIdentifiers = payload.replace(
        /<ns2:ExternalIdentifier[^>]*>/g,
        '',
      );

      await expect(
        service.parseLabOrderDocument(withoutIdentifiers),
      ).rejects.toThrow('Document unique ID not found');
    });
  });

  describe('normalizeSegmentSeparators', () => {
    const normalize = (message: string) =>
      (service as any).normalizeSegmentSeparators(message);

    it('should convert breaks that precede a segment header to carriage returns', () => {
      expect(normalize('MSH|^~\\&|X\nPID|1|Y\r\nPV1|1|Z')).toBe(
        'MSH|^~\\&|X\rPID|1|Y\rPV1|1|Z',
      );
    });

    it('should escape breaks inside a field instead of splitting the segment', () => {
      // A blanket \n -> \r conversion turned the second half of this field into a
      // bogus segment, which nodehl7 rejected as an INVALID message.
      const normalized = normalize(
        'MSH|^~\\&|X\rPID||ADDRESS LINE 1\nTEL: 555-0100^^^^^HTI\rPV1|1|Z',
      );

      expect(normalized).toBe(
        'MSH|^~\\&|X\rPID||ADDRESS LINE 1\\X0A\\TEL: 555-0100^^^^^HTI\rPV1|1|Z',
      );
      expect(normalized.split('\r')).toHaveLength(3);
    });
  });

  describe('findDocumentUniqueId', () => {
    const registryObject = 'urn:uuid:doc-1/2026-08-03/2.25.111';
    const uniqueIdScheme = 'urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab';
    const patientIdScheme = 'urn:uuid:58a6f841-87b3-4a3e-92fd-a8ffeff98427';
    const find = (xml: string) =>
      (service as any).findDocumentUniqueId(xml, registryObject);

    it('should select the uniqueId by identificationScheme, not by element order', () => {
      // iSantePlus numbers identifiers per ExtrinsicObject; keying on id="eid0"
      // would return the patient identifier if the sender reordered them.
      const xml =
        `<ns2:ExternalIdentifier id="eid0" identificationScheme="${patientIdScheme}" registryObject="${registryObject}" value="patient-123">` +
        `</ns2:ExternalIdentifier>` +
        `<ns2:ExternalIdentifier id="eid1" identificationScheme="${uniqueIdScheme}" registryObject="${registryObject}" value="2.25.999">` +
        `</ns2:ExternalIdentifier>`;

      expect(find(xml)).toBe('2.25.999');
    });

    it('should tolerate any element prefix and attribute order', () => {
      const xml =
        `<ExternalIdentifier value="2.25.999" registryObject="${registryObject}" identificationScheme="${uniqueIdScheme}" id="eid7"/>`;

      expect(find(xml)).toBe('2.25.999');
    });

    it('should ignore identifiers belonging to other registry objects', () => {
      const xml = `<ns2:ExternalIdentifier id="eid0" identificationScheme="${uniqueIdScheme}" registryObject="SubmissionSet01" value="2.25.888"/>`;

      expect(find(xml)).toBeNull();
    });
  });

  describe('create', () => {
    const mockLabOrder: Partial<LabOrder> = {
      documentId: 'test-doc-id',
      labOrderId: '12345',
      patientId: 'patient-123',
      facilityId: 'facility-456',
      alternateVisitId: 'visit-789',
      documentContents: 'test contents',
      hl7Contents: 'MSH|test',
      duplicateOrders: 0,
      duplicateDocumentContents: [],
      duplicateHl7Contents: [],
    };

    it('should create a new lab order when no duplicate exists', async () => {
      mockLabOrderDAO.findByInternalIdentifiers.mockResolvedValue(null);
      mockLabOrderDAO.create.mockResolvedValue(mockLabOrder);

      const result = await service.create(mockLabOrder as LabOrder);

      expect(mockLabOrderDAO.findByInternalIdentifiers).toHaveBeenCalledWith(
        mockLabOrder.labOrderId,
        mockLabOrder.patientId,
        mockLabOrder.facilityId
      );
      expect(mockLabOrderDAO.create).toHaveBeenCalledWith(mockLabOrder);
      expect(mockNotificationService.notifySubscribers).toHaveBeenCalledWith(
        mockLabOrder.documentId
      );
      expect(result).toEqual(mockLabOrder);
    });

    it('should update existing lab order when duplicate is detected', async () => {
      const existingOrder = {
        ...mockLabOrder,
        duplicateOrders: 1,
        duplicateDocumentContents: ['previous contents'],
        duplicateHl7Contents: ['previous hl7'],
        save: jest.fn().mockResolvedValue({
          ...mockLabOrder,
          duplicateOrders: 2,
          duplicateDocumentContents: ['previous contents', 'test contents'],
          duplicateHl7Contents: ['previous hl7', 'MSH|test'],
        }),
      };

      mockLabOrderDAO.findByInternalIdentifiers.mockResolvedValue(existingOrder);

      const result = await service.create(mockLabOrder as LabOrder);

      expect(mockLabOrderDAO.findByInternalIdentifiers).toHaveBeenCalledWith(
        mockLabOrder.labOrderId,
        mockLabOrder.patientId,
        mockLabOrder.facilityId
      );
      expect(mockLabOrderDAO.create).not.toHaveBeenCalled();
      expect(existingOrder.save).toHaveBeenCalled();
      expect(existingOrder.duplicateOrders).toBe(2);
      expect(existingOrder.duplicateDocumentContents).toContain('test contents');
      expect(existingOrder.duplicateHl7Contents).toContain('MSH|test');
      // Duplicates should NOT trigger notifications
      expect(mockNotificationService.notifySubscribers).not.toHaveBeenCalled();
    });

    it('should handle first duplicate (when duplicateOrders is undefined)', async () => {
      const existingOrder = {
        ...mockLabOrder,
        duplicateOrders: undefined,
        duplicateDocumentContents: undefined,
        duplicateHl7Contents: undefined,
        save: jest.fn().mockResolvedValue({
          ...mockLabOrder,
          duplicateOrders: 1,
          duplicateDocumentContents: ['test contents'],
          duplicateHl7Contents: ['MSH|test'],
        }),
      };

      mockLabOrderDAO.findByInternalIdentifiers.mockResolvedValue(existingOrder);

      const result = await service.create(mockLabOrder as LabOrder);

      expect(existingOrder.duplicateOrders).toBe(1);
      expect(existingOrder.duplicateDocumentContents).toEqual(['test contents']);
      expect(existingOrder.duplicateHl7Contents).toEqual(['MSH|test']);
      expect(existingOrder.save).toHaveBeenCalled();
      // Duplicates should NOT trigger notifications
      expect(mockNotificationService.notifySubscribers).not.toHaveBeenCalled();
    });
  });

  describe('handleCreateLabOrder', () => {
    it('should return 200 status and save errored request when parsing fails', async () => {
      const invalidBody = 'invalid xml content';
      
      // Mock the erroredRequestDAO.create to return a successful save
      mockErroredRequestDAO.create.mockResolvedValue({
        requestId: 'ERROR_123',
        requestBody: invalidBody,
        errorMessage: 'Document unique ID not found in XML',
        errorType: 'GENERAL_PARSING_ERROR',
      });

      const result = await service.handleCreateLabOrder(invalidBody);

      expect(result.status).toBe(200); // Should always return 200
      expect(result.responseBody).toContain('Success'); // Should return success response
      expect(mockErroredRequestDAO.create).toHaveBeenCalled();

      // Verify the errored request was saved with correct data
      const savedErroredRequest = mockErroredRequestDAO.create.mock.calls[0][0];
      expect(savedErroredRequest.requestBody).toBe(invalidBody);
      expect(savedErroredRequest.errorMessage).toContain(
        'Document unique ID not found',
      );
      expect(savedErroredRequest.errorType).toBe('GENERAL_PARSING_ERROR');
    });

    it('should save an errored request when the parser rejects with a non-Error value', async () => {
      // nodehl7 rejects with plain objects; an undefined message previously broke
      // categorizeError and discarded the request without any audit record.
      mockHl7Service.parseMessageContent.mockRejectedValue({ errortype: 2000 });
      mockErroredRequestDAO.create.mockResolvedValue({});

      const result = await service.handleCreateLabOrder('invalid xml content');

      expect(result.status).toBe(200);
      expect(mockErroredRequestDAO.create).toHaveBeenCalled();
      const savedErroredRequest = mockErroredRequestDAO.create.mock.calls[0][0];
      expect(savedErroredRequest.errorMessage).toBeTruthy();
    });

    it('should return 200 status even when saving errored request fails', async () => {
      const invalidBody = 'invalid xml content';
      
      // Mock the erroredRequestDAO.create to throw an error
      mockErroredRequestDAO.create.mockRejectedValue(new Error('Database error'));

      const result = await service.handleCreateLabOrder(invalidBody);

      expect(result.status).toBe(200); // Should still return 200
      expect(result.responseBody).toContain('Success'); // Should still return success response
      expect(mockErroredRequestDAO.create).toHaveBeenCalled();
    });
  });
});

// Exercised against the real parser rather than a mock: the 2026-08-04 loss came
// from how nodehl7 reacted to the message this service handed it, which a stubbed
// Hl7Service cannot reproduce.
describe('LabOrderService with the real HL7 parser', () => {
  let service: LabOrderService;

  const mockLabOrderDAO = {
    create: jest.fn(),
    findByInternalIdentifiers: jest.fn(),
  };
  const mockErroredRequestDAO = { create: jest.fn() };
  const mockNotificationService = { notifySubscribers: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrderService,
        Hl7Service,
        {
          provide: 'HL7_PARSER',
          useValue: new Hl7lib({
            mapping: false,
            profiling: true,
            debug: true,
            fileEncoding: 'utf-8',
          }),
        },
        { provide: LabOrderDAO, useValue: mockLabOrderDAO },
        { provide: ErroredRequestDAO, useValue: mockErroredRequestDAO },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<LabOrderService>(LabOrderService);
    jest.clearAllMocks();
  });

  const uniqueIdScheme = 'urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab';
  const boundary = '--uuid:f6924879-d62a-4279-9c17-cc65e48ec23e';

  // A line break inside the PID address/phone field, as sent on 2026-08-04.
  const hl7 = [
    'MSH|^~\\&||LNSP|||20260804145106||ORM^O01^ORM_O01|2026080414510600015|D|2.5',
    'PID||PATIENT-1^^^^^ND|||Demo^Patient|F|19700101|||ADDRESS\\X000d\\\nTEL: 779-0467  567-9171)^^^^^HTI',
    'PV1|||FAC-1||||PROV-1|||||||||||||||||||||||||||||||||||||20260803||||||visit-1^^^^alt-visit-1',
    'ORC|NW|ORDER-4417|||||^^^20260803000000',
    'OBR||ORDER-4417||VLCVR|||20260803000000||||O',
  ].join('\r');

  const payload = [
    [
      boundary,
      'Content-Type: application/xop+xml',
      '',
      `<ns2:ExternalIdentifier id="eid0" identificationScheme="${uniqueIdScheme}" registryObject="doc-hl7" value="2.25.333"/>` +
        '<Document id="doc-hl7"><xop:Include href="cid:cid-hl7"/></Document>',
    ].join('\r\n'),
    [
      boundary,
      'Content-ID: <cid-hl7>',
      'Content-Type: application/octet-stream',
      'Content-Transfer-Encoding: binary',
      '',
      hl7,
    ].join('\r\n'),
    `${boundary}--`,
  ].join('\r\n');

  it('should parse an order whose PID contains an in-field line break', async () => {
    const labOrder = await service.parseLabOrderDocument(payload);

    expect(labOrder.documentId).toBe('2.25.333');
    expect(labOrder.labOrderId).toBe('ORDER-4417');
    expect(labOrder.facilityId).toEqual(expect.anything());
    expect(labOrder.patientId).toBe('PATIENT-1');
    // The stored contents keep the original break; only parsing is normalised.
    expect(labOrder.hl7Contents).toContain('TEL: 779-0467');
  });

  // A break is only treated as a segment separator when a three-character segment
  // header follows, and nodehl7 accepts unknown three-character segments, so a
  // stray line break can no longer make it reject the message. The rejection path
  // itself is covered by the errortype tests in hl7.service.spec.ts and by the
  // mocked non-Error rejection above.
  it('should still parse when an unknown segment follows a line break', async () => {
    const withUnknownSegment = payload.replace('ORC|NW|', 'ZZZ|nope\rORC|NW|');

    await expect(
      service.parseLabOrderDocument(withUnknownSegment),
    ).resolves.toMatchObject({ labOrderId: 'ORDER-4417' });
  });
});
