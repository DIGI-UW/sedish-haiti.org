import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { Subscription } from './subscription.schema';
import { SubscriptionDAO } from './subscription.dao';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const contentType = 'application/json';

@Injectable()
export class SubscriptionService {
  constructor(private readonly subscriptionDAO: SubscriptionDAO) {}

  async handleSubscription(xmlPayload: any) {
    const targetAddress =
      xmlPayload['soap:envelope']['soap:body'][0]['wsnt:subscribe'][0][
        'wsnt:consumerreference'
      ][0]['wsa:address'][0];

    try {
      await this.create({ targetAddress });
      return {
        contentType,
        responseBody: 'Subscription created successfully',
        status: 200,
      };
    } catch {
      return { contentType, responseBody: 'Subscription failed', status: 500 };
    }
  }

  create(subscription: Subscription) {
    return this.subscriptionDAO.createUnique(subscription);
  }

  async createFromDto(dto: CreateSubscriptionDto) {
    if (
      !dto ||
      typeof dto.targetAddress !== 'string' ||
      dto.targetAddress.length === 0
    ) {
      throw new BadRequestException(
        'targetAddress (non-empty string) is required',
      );
    }
    return this.subscriptionDAO.createUnique({
      targetAddress: dto.targetAddress,
    });
  }

  getAll() {
    return this.subscriptionDAO.find();
  }

  async getById(id: string) {
    this.assertValidId(id);
    const doc = await this.subscriptionDAO.findOne({ _id: id });
    if (!doc) throw new NotFoundException(`Subscription ${id} not found`);
    return doc;
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    this.assertValidId(id);
    const updated = await this.subscriptionDAO.updateOne(
      { _id: id },
      { $set: dto },
    );
    if (!updated) throw new NotFoundException(`Subscription ${id} not found`);
    return updated;
  }

  async delete(id: string) {
    this.assertValidId(id);
    const deleted = await this.subscriptionDAO.deleteOne({ _id: id });
    if (!deleted) throw new NotFoundException(`Subscription ${id} not found`);
    return deleted;
  }

  private assertValidId(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Invalid id: ${id}`);
    }
  }
}
