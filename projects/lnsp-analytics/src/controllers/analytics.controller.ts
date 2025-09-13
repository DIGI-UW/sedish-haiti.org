import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { MongoService } from '../services/mongo.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly mongo: MongoService) {}

  private normalizeFacilityId(f?: string): string | undefined {
    const v = (f ?? '').trim();
    if (!v || v === '$__all' || v === '*') return undefined;
    return v;
  }

  @Get('orders/submitted')
  async ordersSubmitted(@Query('facilityId') facilityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.countByCreatedAt('laborders', this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('orders/retrieved')
  async ordersRetrieved(@Query('facilityId') facilityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.countByDateField('laborders', 'retrievedAt', this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('orders/read')
  async ordersRead(@Query('facilityId') facilityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.countByDateField('laborders', 'lastReadAt', this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('results/created')
  async resultsCreated(@Query('facilityId') facilityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.countByCreatedAt('labresults', this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('notifications/delivered')
  async notificationsDelivered(@Query('facilityId') facilityId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.notificationsDeliveredCount(this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('notifications/dmq')
  async notificationsDmq(@Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.countBooleanFlag('notifications', 'dmq', true, from, to);
  }

  @Get('notifications/created')
  async notificationsCreated(@Query('facilityId') facilityId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.notificationsCreatedCount(this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('facilities')
  async facilities() {
    const list = await this.mongo.uniqueFacilityIds();
    return list.map(v => ({ text: v, value: v }));
  }

  @Get('orders/recent-read')
  async recentOrdersRead(@Query('facilityId') facilityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mongo.recentOrdersRead(this.normalizeFacilityId(facilityId), from, to);
  }

  @Get('summary')
  async summary(
    @Query('entity') entity: 'orders' | 'results' | 'notifications',
    @Query('facilityId') facilityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.mongo.summary(entity, this.normalizeFacilityId(facilityId), from, to);
  }

  // Read-only passthrough query endpoint for Grafana JSON API
  // Accepts either an aggregation pipeline or a simple find query
  @Post('query')
  async query(@Body() body: any) {
    return this.mongo.query(body);
  }
}


