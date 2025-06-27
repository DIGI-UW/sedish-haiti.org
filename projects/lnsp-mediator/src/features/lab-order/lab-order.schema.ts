import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { LabResult } from '../lab-result/lab-result.schema';

export type LabOrderDocument = HydratedDocument<LabOrder>;

@Schema({ timestamps: true })
export class LabOrder {
  @Prop({ required: true, unique: true, index: true })
  documentId: string;

  @Prop({ required: true })
  alternateVisitId: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop({ required: true, index: true })
  labOrderId: string;

  @Prop({ required: true, index: true })
  facilityId: string;

  @Prop({ required: true })
  documentContents: string;

  @Prop({ required: true })
  hl7Contents: string;

  @Prop()
  submittedAt: Date;

  @Prop()
  retrievedAt: Date;

  @Prop()
  resultedAt: Date;

  @Prop({ ref: 'LabResult', type: MongooseSchema.Types.ObjectId })
  result: LabResult | Types.ObjectId;

  @Prop({ default: 0 })
  duplicateOrders: number;

  @Prop({ type: [String], default: [] })
  duplicateDocumentContents: string[];

  @Prop({ type: [String], default: [] })
  duplicateHl7Contents: string[];
}

export const LabOrderSchema = SchemaFactory.createForClass(LabOrder);
