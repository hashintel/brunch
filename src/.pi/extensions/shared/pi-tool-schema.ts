import type { TSchema } from 'typebox';
import * as z from 'zod';

/**
 * Zod → Pi tool-parameter adapter for the dev-gated query tools.
 *
 * Pi's `defineTool` types `parameters` as a TypeBox `TSchema`, but Brunch authors
 * boundary schemas in Zod (D41-L) and exports JSON Schema with
 * `z.toJSONSchema(..., { unrepresentable: 'throw' })`. Zod v4 emits JSON Schema
 * draft 2020-12 (tuples become `prefixItems`, not the draft-07 array-form `items`
 * that Anthropic's strict validator rejects). This is the dev-plane sibling of the
 * structured-exchange `pi-schema.ts` adapter, kept here so the session-query /
 * introspect-query tools do not depend on the exchanges seam.
 */
export function devToolParameters(schema: z.ZodType): TSchema {
  return z.toJSONSchema(schema, { unrepresentable: 'throw' }) as unknown as TSchema;
}
