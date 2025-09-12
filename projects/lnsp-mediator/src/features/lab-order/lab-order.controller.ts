import { Controller, Post, Body, Get, Res, HttpStatus, Logger } from '@nestjs/common';
import { LabOrderService } from './lab-order.service';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@Controller('lab-orders')
@ApiTags('lab-orders')
export class LabOrderController {
  private readonly logger = new Logger(LabOrderController.name);

  constructor(private readonly labOrderService: LabOrderService) {}

  @Post('create')
  async create(@Body() body: string, @Res() res: Response) {
    try {
      const { contentType, responseBody, status } =
        await this.labOrderService.handleCreateLabOrder(body);
      res.setHeader('Content-Type', contentType);
      res.status(status);
      res.write(responseBody);
    } catch (error) {
      this.logger.error('Error in lab-orders/create', error instanceof Error ? error.stack : String(error));
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .write('Internal Server Error');
    } finally {
      res.end();
    }
  }

  @Post('get-by-id')
  async getLabOrderById(@Body() xmlPayload: any, @Res() res: Response) {
    try {
      const { contentType, responseBody, status } =
        await this.labOrderService.handleGetLabOrderById(xmlPayload);
      res.setHeader('Content-Type', contentType);
      res.status(status);
      res.write(responseBody);
    } catch (error) {
      this.logger.error('Error in lab-orders/get-by-id', error instanceof Error ? error.stack : String(error));
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .write('Internal Server Error');
    } finally {
      res.end();
    }
  }

  @Get()
  async getAll(): Promise<any> {
    return this.labOrderService.findAll();
  }
}
