import { Controller, Post, Body, Res, HttpStatus, Logger } from '@nestjs/common';
import { LabOrderService } from './features/lab-order/lab-order.service';
import { LabResultService } from './features/lab-result/lab-result.service';
import { SubscriptionService } from './features/subscription/subscription.service';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@Controller()
@ApiTags('api')
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(
    private readonly labOrderService: LabOrderService,
    private readonly labResultService: LabResultService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  async handleRequest(@Body() body: any, @Res() res: Response) {
    try {
      let serviceResponse;

      // Handle XML as string
      if (!body) {
        res.status(HttpStatus.BAD_REQUEST).send('Invalid request body');
        return;
      }

      let bodyString = body;

      if (typeof bodyString !== 'string') {
        bodyString = JSON.stringify(body);
      }

      if (
        bodyString
          .split('\n')
          .some(
            (line: string) =>
              line.startsWith('Content-Type:') &&
              line.includes('urn:ihe:iti:2007:ProvideAndRegisterDocumentSet-b'),
          )
      ) {
        serviceResponse = await this.labOrderService.handleCreateLabOrder(body);
      } else if (bodyString.includes('urn:ihe:iti:2007:RetrieveDocumentSet')) {
        serviceResponse =
          await this.labOrderService.handleGetLabOrderById(body);
      } else if (bodyString.includes('ns2:GetMessages')) {
        serviceResponse =
          await this.labResultService.handleGetLabResultsByFacility(body);
      } else if (
        bodyString.includes(
          'http://docs.oasis-open.org/wsn/bw2/NotificationProducer/SubscribeRequest',
        )
      ) {
        serviceResponse =
          await this.subscriptionService.handleSubscription(body);
      } else {
        serviceResponse =
          await this.labResultService.handleCreateLabResult(body);
      }

      if (!serviceResponse) {
        res.status(HttpStatus.BAD_REQUEST).send('Invalid service response');
        return;
      }

      const { contentType, responseBody, status } = serviceResponse;
      res.setHeader('Content-Type', contentType);
      res.status(status).write(responseBody);
    } catch (error) {
      this.logger.error('Unhandled error in root POST', error instanceof Error ? error.stack : String(error));
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .write('Internal Server Error');
    } finally {
      res.end();
    }
  }
}
