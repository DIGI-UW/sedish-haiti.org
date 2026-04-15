import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionDAO } from './subscription.dao';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let dao: jest.Mocked<Pick<SubscriptionDAO, 'createUnique' | 'find' | 'findOne' | 'updateOne' | 'deleteOne'>>;

  const VALID_ID = '507f1f77bcf86cd799439011';
  const MISSING_ID = '507f1f77bcf86cd799439099';
  const INVALID_ID = 'not-an-id';

  beforeEach(async () => {
    dao = {
      createUnique: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SubscriptionDAO, useValue: dao },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to dao.find', async () => {
      const rows = [{ _id: VALID_ID, targetAddress: 'http://a' }];
      dao.find.mockResolvedValue(rows as any);
      await expect(service.getAll()).resolves.toEqual(rows);
      expect(dao.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('createFromDto', () => {
    it('calls dao.createUnique with the targetAddress', async () => {
      const doc = { _id: VALID_ID, targetAddress: 'http://x' };
      dao.createUnique.mockResolvedValue(doc as any);
      const result = await service.createFromDto({ targetAddress: 'http://x' });
      expect(dao.createUnique).toHaveBeenCalledWith({ targetAddress: 'http://x' });
      expect(result).toEqual(doc);
    });

    it('throws BadRequestException when targetAddress is missing', async () => {
      await expect(service.createFromDto({} as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(dao.createUnique).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when targetAddress is not a string', async () => {
      await expect(service.createFromDto({ targetAddress: 42 as any })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.createFromDto({ targetAddress: '' })).rejects.toBeInstanceOf(BadRequestException);
      expect(dao.createUnique).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when dto is null/undefined', async () => {
      await expect(service.createFromDto(null as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.createFromDto(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getById', () => {
    it('returns doc when found', async () => {
      const doc = { _id: VALID_ID, targetAddress: 'http://x' };
      dao.findOne.mockResolvedValue(doc as any);
      await expect(service.getById(VALID_ID)).resolves.toEqual(doc);
      expect(dao.findOne).toHaveBeenCalledWith({ _id: VALID_ID });
    });

    it('throws NotFoundException when dao returns null', async () => {
      dao.findOne.mockResolvedValue(null);
      await expect(service.getById(MISSING_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on invalid ObjectId without hitting dao', async () => {
      await expect(service.getById(INVALID_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(dao.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('calls dao.updateOne with $set and returns updated doc', async () => {
      const updated = { _id: VALID_ID, targetAddress: 'http://y' };
      dao.updateOne.mockResolvedValue(updated as any);
      const result = await service.update(VALID_ID, { targetAddress: 'http://y' });
      expect(dao.updateOne).toHaveBeenCalledWith({ _id: VALID_ID }, { $set: { targetAddress: 'http://y' } });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when dao returns null', async () => {
      dao.updateOne.mockResolvedValue(null);
      await expect(service.update(MISSING_ID, { targetAddress: 'http://y' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on invalid ObjectId', async () => {
      await expect(service.update(INVALID_ID, { targetAddress: 'http://y' })).rejects.toBeInstanceOf(BadRequestException);
      expect(dao.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('calls dao.deleteOne and returns deleted doc', async () => {
      const deleted = { _id: VALID_ID, targetAddress: 'http://x' };
      dao.deleteOne.mockResolvedValue(deleted as any);
      const result = await service.delete(VALID_ID);
      expect(dao.deleteOne).toHaveBeenCalledWith({ _id: VALID_ID });
      expect(result).toEqual(deleted);
    });

    it('throws NotFoundException when dao returns null', async () => {
      dao.deleteOne.mockResolvedValue(null);
      await expect(service.delete(MISSING_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on invalid ObjectId', async () => {
      await expect(service.delete(INVALID_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(dao.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscription (legacy XML)', () => {
    const xmlBody = {
      'soap:envelope': {
        'soap:body': [
          {
            'wsnt:subscribe': [
              {
                'wsnt:consumerreference': [
                  { 'wsa:address': ['http://subscriber.example/cb'] },
                ],
              },
            ],
          },
        ],
      },
    };

    it('returns success shape when DAO write succeeds', async () => {
      dao.createUnique.mockResolvedValue({ _id: VALID_ID, targetAddress: 'http://subscriber.example/cb' } as any);
      const r = await service.handleSubscription(xmlBody);
      expect(dao.createUnique).toHaveBeenCalledWith({ targetAddress: 'http://subscriber.example/cb' });
      expect(r).toEqual({
        contentType: 'application/json',
        responseBody: 'Subscription created successfully',
        status: 200,
      });
    });

    it('returns failure shape when DAO write rejects (regression for missing-await bug)', async () => {
      dao.createUnique.mockRejectedValue(new Error('db down'));
      const r = await service.handleSubscription(xmlBody);
      expect(r).toEqual({
        contentType: 'application/json',
        responseBody: 'Subscription failed',
        status: 500,
      });
    });
  });
});
