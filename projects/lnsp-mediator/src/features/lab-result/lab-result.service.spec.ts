import { Test, TestingModule } from '@nestjs/testing';
import { LabResultService } from './lab-result.service';
import { Hl7Service } from 'src/core/hl7/hl7.service';
import { LabResultDAO } from './lab-result.dao';

describe('LabResultService', () => {
  let service: LabResultService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabResultService,
        { provide: Hl7Service, useValue: { parseMessageContent: jest.fn() } },
        { provide: LabResultDAO, useValue: { findOne: jest.fn(), findByFacilityId: jest.fn(), create: jest.fn() } },
      ],
    }).compile();

    service = module.get<LabResultService>(LabResultService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
