import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MultipartContentTypeMiddleware } from './multipart-content-type/multipart-content-type.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import xmlParser from 'express-xml-bodyparser';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting application bootstrap...');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false, // Disable default body parser to configure custom limits
  });
  logger.log('Nest application created.');
  // Global exception filter for hardened logging
  app.useGlobalFilters(new AllExceptionsFilter());

  // Get ConfigService to read environment variables
  const configService = app.get(ConfigService);
  const bodySizeLimit = configService.get<string>('BODY_SIZE_LIMIT', '50mb');
  logger.log(`Configuring body parsers with size limit: ${bodySizeLimit}`);

  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('lnsp-mediator')
    .setDescription(
      'API for mediating XDS document storage for the iSantePlus - LNSP lab order and result workflows.',
    )
    .setVersion('0.0.0')
    .build();
  logger.log('Swagger documentation set up.');

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Configure body parsers with configurable limits
  // First, set up body parsers with size limits
  app.useBodyParser('json', { limit: bodySizeLimit });
  app.useBodyParser('text', { limit: bodySizeLimit, type: ['text/*', 'application/xml'] });
  app.useBodyParser('raw', { limit: bodySizeLimit });
  
  // Then apply specialized parsers
  app.use(xmlParser());  // XML parser works on already-parsed text body
  app.use(new MultipartContentTypeMiddleware(bodySizeLimit).use);
  
  logger.log(`Middleware configured with ${bodySizeLimit} body size limits.`);


  await app.listen(3000, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
