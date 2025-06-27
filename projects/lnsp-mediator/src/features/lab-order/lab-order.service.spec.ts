import { Test, TestingModule } from '@nestjs/testing';
import { LabOrderService } from './lab-order.service';
import { LabOrderDAO } from './lab-order.dao';
import { ErroredRequestDAO } from './errored-request.dao';
import { NotificationService } from '../notification/notification.service';
import { Hl7Service } from '../../core/hl7/hl7.service';
import { LabOrder } from './lab-order.schema';

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
      expect(mockNotificationService.notifySubscribers).toHaveBeenCalledWith(
        mockLabOrder.documentId
      );
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
    });
  });

  describe('handleCreateLabOrder', () => {
    it('should return 200 status and save errored request when parsing fails', async () => {
      const invalidBody = 'invalid xml content';
      
      // Mock the erroredRequestDAO.create to return a successful save
      mockErroredRequestDAO.create.mockResolvedValue({
        requestId: 'ERROR_123',
        requestBody: invalidBody,
        errorMessage: 'HL7 message not found in XML',
        errorType: 'HL7_PARSING_ERROR',
      });

      const result = await service.handleCreateLabOrder(invalidBody);

      expect(result.status).toBe(200); // Should always return 200
      expect(result.responseBody).toContain('Success'); // Should return success response
      expect(mockErroredRequestDAO.create).toHaveBeenCalled();
      
      // Verify the errored request was saved with correct data
      const savedErroredRequest = mockErroredRequestDAO.create.mock.calls[0][0];
      expect(savedErroredRequest.requestBody).toBe(invalidBody);
      expect(savedErroredRequest.errorMessage).toContain('HL7 message not found');
      expect(savedErroredRequest.errorType).toBe('HL7_PARSING_ERROR');
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
