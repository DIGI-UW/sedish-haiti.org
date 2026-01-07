import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LabOrderService } from './features/lab-order/lab-order.service';
import { LabResultService } from './features/lab-result/lab-result.service';
import { SubscriptionService } from './features/subscription/subscription.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: LabOrderService, useValue: { handleCreateLabOrder: jest.fn(), handleGetLabOrderById: jest.fn() } },
        { provide: LabResultService, useValue: { handleCreateLabResult: jest.fn(), handleGetLabResultsByFacility: jest.fn() } },
        { provide: SubscriptionService, useValue: { handleSubscription: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});
