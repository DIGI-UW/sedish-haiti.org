import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('subscription')
@ApiTags('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a subscription (JSON body) or accept a legacy SOAP XML subscribe envelope',
  })
  async create(@Body() body: any) {
    if (body && typeof body === 'object' && 'soap:envelope' in body) {
      return this.subscriptionService.handleSubscription(body);
    }
    return this.subscriptionService.createFromDto(body);
  }

  @Get()
  @ApiOperation({ summary: 'List all subscriptions' })
  async getAll() {
    return this.subscriptionService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by id' })
  async getById(@Param('id') id: string) {
    return this.subscriptionService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription by id' })
  async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription by id' })
  async delete(@Param('id') id: string) {
    return this.subscriptionService.delete(id);
  }
}
