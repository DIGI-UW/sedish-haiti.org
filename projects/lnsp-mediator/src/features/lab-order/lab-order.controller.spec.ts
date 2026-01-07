import { Test, TestingModule } from '@nestjs/testing';
import { LabOrderController } from './lab-order.controller';
import { LabOrderService } from './lab-order.service';

describe('LabOrderController', () => {
  let controller: LabOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabOrderController],
      providers: [
        { provide: LabOrderService, useValue: { handleCreateLabOrder: jest.fn(), handleGetLabOrderById: jest.fn(), findAll: jest.fn() } },
      ],
    }).compile();

    controller = module.get<LabOrderController>(LabOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
