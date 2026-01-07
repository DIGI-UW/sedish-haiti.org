import { Test, TestingModule } from '@nestjs/testing';
import { Hl7Service } from './hl7.service';

describe('Hl7Service', () => {
  let service: Hl7Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Hl7Service,
        { provide: 'HL7_PARSER', useValue: { parse: jest.fn((msg: string, id: string, cb: any) => cb(null, {})) } },
      ],
    }).compile();

    service = module.get<Hl7Service>(Hl7Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
