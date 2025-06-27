import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DAO } from '../../core/database/database.dao';
import { ErroredRequest, ErroredRequestDocument } from './errored-request.schema';

@Injectable()
export class ErroredRequestDAO extends DAO<ErroredRequestDocument> {
  constructor(@InjectModel(ErroredRequest.name) model: Model<ErroredRequestDocument>) {
    super(model);
  }

  async findByRequestId(requestId: string) {
    return this.model.find({ requestId: requestId }).exec();
  }

  async findByErrorType(errorType: string) {
    return this.model.find({ errorType: errorType }).exec();
  }
} 