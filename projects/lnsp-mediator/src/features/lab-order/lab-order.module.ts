import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabOrderService } from './lab-order.service';
import { LabOrderController } from './lab-order.controller';
import { LabOrder, LabOrderSchema } from './lab-order.schema';
import { ErroredRequest, ErroredRequestSchema } from './errored-request.schema';
import { LabOrderDAO } from './lab-order.dao';
import { ErroredRequestDAO } from './errored-request.dao';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LabOrder.name, schema: LabOrderSchema },
      { name: ErroredRequest.name, schema: ErroredRequestSchema },
    ]),
    NotificationModule,
  ],
  providers: [LabOrderDAO, ErroredRequestDAO, LabOrderService],
  controllers: [LabOrderController],
  exports: [LabOrderService, LabOrderDAO, ErroredRequestDAO],
})
export class LabOrderModule {}
