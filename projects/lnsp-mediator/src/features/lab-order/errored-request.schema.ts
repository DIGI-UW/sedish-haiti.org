import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ErroredRequestDocument = HydratedDocument<ErroredRequest>;

@Schema({ timestamps: true })
export class ErroredRequest {
  @Prop({ required: true, unique: true, index: true })
  requestId: string;

  // requestBody and errorMessage are deliberately not required: this collection
  // is the audit trail for malformed submissions, so validation must never be
  // able to reject a record and destroy the only evidence of a failed request.
  @Prop()
  requestBody: string;

  @Prop()
  errorMessage: string;

  @Prop()
  errorType: string;

  @Prop()
  attemptedParsing: boolean;

  @Prop()
  partialData: string;
}

export const ErroredRequestSchema = SchemaFactory.createForClass(ErroredRequest); 