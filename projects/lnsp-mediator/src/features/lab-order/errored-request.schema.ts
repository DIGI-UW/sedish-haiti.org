import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ErroredRequestDocument = HydratedDocument<ErroredRequest>;

@Schema({ timestamps: true })
export class ErroredRequest {
  @Prop({ required: true, unique: true, index: true })
  requestId: string;

  @Prop({ required: true })
  requestBody: string;

  @Prop({ required: true })
  errorMessage: string;

  @Prop()
  errorType: string;

  @Prop()
  attemptedParsing: boolean;

  @Prop()
  partialData: string;
}

export const ErroredRequestSchema = SchemaFactory.createForClass(ErroredRequest); 