import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as rawBodyParser from 'body-parser';

@Injectable()
export class MultipartContentTypeMiddleware implements NestMiddleware {
  private readonly bodySizeLimit: string;

  constructor(bodySizeLimit: string = '50mb') {
    this.bodySizeLimit = bodySizeLimit;

    this.use = this.use.bind(this);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const multipartContentTypePrefix = 'multipart/related';

    if (req.headers['content-type']?.startsWith(multipartContentTypePrefix)) {
      // Apply the text parser with configurable limit for multipart content
      rawBodyParser.text({ type: () => true, limit: this.bodySizeLimit })(req, res, next);
    } else {
      // Continue to the next middleware if Content-Type doesn't match
      next();
    }
  }
}
