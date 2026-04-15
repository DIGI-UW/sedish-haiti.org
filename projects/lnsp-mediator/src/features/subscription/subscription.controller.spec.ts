import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let service: jest.Mocked<
    Pick<
      SubscriptionService,
      | 'handleSubscription'
      | 'createFromDto'
      | 'getAll'
      | 'getById'
      | 'update'
      | 'delete'
    >
  >;

  beforeEach(async () => {
    service = {
      handleSubscription: jest.fn(),
      createFromDto: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [{ provide: SubscriptionService, useValue: service }],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /subscription', () => {
    it('dispatches to handleSubscription when body is parsed SOAP XML', async () => {
      const xmlBody = { 'soap:envelope': { 'soap:body': [{}] } };
      const xmlResp = {
        contentType: 'application/json',
        responseBody: 'Subscription created successfully',
        status: 200,
      };
      service.handleSubscription.mockResolvedValue(xmlResp);

      const result = await controller.create(xmlBody);

      expect(service.handleSubscription).toHaveBeenCalledWith(xmlBody);
      expect(service.createFromDto).not.toHaveBeenCalled();
      expect(result).toEqual(xmlResp);
    });

    it('dispatches to createFromDto when body is JSON', async () => {
      const jsonBody = { targetAddress: 'http://x' };
      const created = {
        _id: '507f1f77bcf86cd799439011',
        targetAddress: 'http://x',
      };
      service.createFromDto.mockResolvedValue(created as any);

      const result = await controller.create(jsonBody);

      expect(service.createFromDto).toHaveBeenCalledWith(jsonBody);
      expect(service.handleSubscription).not.toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('GET /subscription', () => {
    it('delegates to getAll', async () => {
      const rows = [{ _id: 'a', targetAddress: 'http://a' }];
      service.getAll.mockResolvedValue(rows as any);
      await expect(controller.getAll()).resolves.toEqual(rows);
    });
  });

  describe('GET /subscription/:id', () => {
    it('delegates to getById with the id param', async () => {
      const doc = {
        _id: '507f1f77bcf86cd799439011',
        targetAddress: 'http://x',
      };
      service.getById.mockResolvedValue(doc as any);
      await expect(
        controller.getById('507f1f77bcf86cd799439011'),
      ).resolves.toEqual(doc);
      expect(service.getById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  describe('PATCH /subscription/:id', () => {
    it('delegates to update with id and dto', async () => {
      const updated = {
        _id: '507f1f77bcf86cd799439011',
        targetAddress: 'http://y',
      };
      service.update.mockResolvedValue(updated as any);
      const dto = { targetAddress: 'http://y' };
      await expect(
        controller.update('507f1f77bcf86cd799439011', dto),
      ).resolves.toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        dto,
      );
    });
  });

  describe('DELETE /subscription/:id', () => {
    it('delegates to delete with id', async () => {
      const deleted = {
        _id: '507f1f77bcf86cd799439011',
        targetAddress: 'http://x',
      };
      service.delete.mockResolvedValue(deleted as any);
      await expect(
        controller.delete('507f1f77bcf86cd799439011'),
      ).resolves.toEqual(deleted);
      expect(service.delete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });
});
