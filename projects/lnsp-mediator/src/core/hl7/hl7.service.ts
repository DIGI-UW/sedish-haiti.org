import { Injectable, Inject } from '@nestjs/common';
import { inspect } from 'util';
import Hl7lib from 'nodehl7';

// nodehl7 reports failures as numeric codes on a plain object; the values come
// from its hl7Parser.prototype.EMPTY / INVALID / IOERROR.
const HL7_ERROR_TYPES: Record<number, string> = {
  1000: 'EMPTY',
  2000: 'INVALID',
  3000: 'IOERROR',
};

@Injectable()
export class Hl7Service {
  constructor(@Inject('HL7_PARSER') private hl7parser: Hl7lib) {}

  async parseMessageContent(messageContent: string, ID: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.hl7parser.parse(messageContent, ID, (err, message) => {
        if (err) {
          return reject(this.asError(err, ID));
        }
        resolve(message);
      });
    });
  }

  /**
   * nodehl7 rejects with plain objects such as `{errortype: 2000}` rather than
   * Errors, so callers reading `error.message` get undefined — which silently
   * breaks error handling that assumes a message is present. Translate the
   * errortype into a real Error so failures survive logging and persistence.
   */
  private asError(err: unknown, ID: string): Error {
    if (err instanceof Error) {
      return err;
    }

    const errortype = (err as { errortype?: number })?.errortype;
    const label =
      errortype === undefined
        ? inspect(err)
        : (HL7_ERROR_TYPES[errortype] ?? `errortype ${errortype}`);
    const details = (err as { details?: unknown })?.details;

    return new Error(
      `HL7 parsing failed for ${ID}: ${label}` +
        (details === undefined ? '' : ` (${inspect(details)})`),
    );
  }
}
