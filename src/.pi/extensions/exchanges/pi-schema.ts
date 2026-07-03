import type { TSchema } from 'typebox';
import type { z } from 'zod';

import { toStructuredExchangeJsonSchema } from '../../../exchanges/schemas/index.js';

export function piSchema(schema: z.ZodType): TSchema {
  return toStructuredExchangeJsonSchema(schema) as TSchema;
}
