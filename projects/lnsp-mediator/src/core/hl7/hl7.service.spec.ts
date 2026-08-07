import { Test, TestingModule } from '@nestjs/testing';
import { Hl7Service } from './hl7.service';

describe('Hl7Service', () => {
  let service: Hl7Service;

  const mockParser = {
    parse: jest.fn((msg: string, id: string, cb: any) => cb(null, {})),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Hl7Service, { provide: 'HL7_PARSER', useValue: mockParser }],
    }).compile();

    service = module.get<Hl7Service>(Hl7Service);
    mockParser.parse.mockImplementation((msg: string, id: string, cb: any) =>
      cb(null, {}),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should resolve the parsed message', async () => {
    const parsed = { segments: [] };
    mockParser.parse.mockImplementation((_msg, _id, cb: any) =>
      cb(null, parsed),
    );

    await expect(
      service.parseMessageContent('MSH|^~\\&|X', 'id'),
    ).resolves.toBe(parsed);
  });

  // nodehl7 signals failure with a bare `{errortype}` object, so callers reading
  // error.message saw undefined and lost the reason for the failure entirely.
  it.each([
    [1000, 'EMPTY'],
    [2000, 'INVALID'],
    [3000, 'IOERROR'],
  ])(
    'should reject errortype %i as an Error naming %s',
    async (errortype, label) => {
      mockParser.parse.mockImplementation((_msg, _id, cb: any) =>
        cb({ errortype }),
      );

      await expect(
        service.parseMessageContent('MSH|^~\\&|X', 'incoming-order-message'),
      ).rejects.toThrow(
        `HL7 parsing failed for incoming-order-message: ${label}`,
      );
    },
  );

  it('should include details when the parser supplies them', async () => {
    mockParser.parse.mockImplementation((_msg, _id, cb: any) =>
      cb({ errortype: 3000, details: 'disk gone' }),
    );

    await expect(
      service.parseMessageContent('MSH|^~\\&|X', 'id'),
    ).rejects.toThrow(/IOERROR \('disk gone'\)/);
  });

  it('should describe an unrecognised rejection value', async () => {
    mockParser.parse.mockImplementation((_msg, _id, cb: any) =>
      cb({ unexpected: true }),
    );

    const error = await service
      .parseMessageContent('MSH|^~\\&|X', 'id')
      .catch((err) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('unexpected');
  });

  it('should pass through a real Error unchanged', async () => {
    const original = new Error('boom');
    mockParser.parse.mockImplementation((_msg, _id, cb: any) => cb(original));

    await expect(service.parseMessageContent('MSH|^~\\&|X', 'id')).rejects.toBe(
      original,
    );
  });
});
