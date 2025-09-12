import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Log incoming requests at info level (stdout)
  app.use(morgan('combined'));
  app.use((req: any, res: any, next: any) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - start) / BigInt(1_000_000));
      const msg = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`;
      new Logger('HTTP').log(msg);
    });
    next();
  });
  const port = process.env.PORT || 3101;
  await app.listen(port as number, '0.0.0.0');
  new Logger('Bootstrap').log(`lnsp-analytics listening on ${port}`);
}

bootstrap();


