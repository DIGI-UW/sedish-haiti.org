import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DAO } from '../../core/database/database.dao';
import { LabOrder, LabOrderDocument } from './lab-order.schema';

@Injectable()
export class LabOrderDAO extends DAO<LabOrderDocument> {
  constructor(@InjectModel(LabOrder.name) model: Model<LabOrderDocument>) {
    super(model);
  }

  async findByDocumentId(documentId: string) {
    return this.model.find({ documentId: documentId }).exec();
  }

  async findByInternalIdentifiers(labOrderId: string, patientId: string, facilityId: string) {
    return this.model.findOne({ 
      labOrderId, 
      patientId, 
      facilityId 
    }).exec();
  }

  async debugFind(filter: any) {
    console.log(`Debugging with filter: ${JSON.stringify(filter)}`);
    const results = await this.model.find(filter).exec();
    console.log(`Results: ${JSON.stringify(results)}`);
    return results;
  }
}
