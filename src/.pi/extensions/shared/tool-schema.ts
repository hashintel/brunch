import type { TSchema } from 'typebox';
import * as z from 'zod';

const ILLEGAL_TOP_LEVEL_UNION_KEYS = ['oneOf', 'anyOf', 'allOf'] as const;

export type ToolSchemaSource = z.ZodType | TSchema;

/**
 * Shared adapter for Brunch-authored provider-facing tool parameter schemas.
 *
 * Zod-owned tool boundaries emit JSON Schema via Zod v4; graph/DB-owned tool
 * boundaries pass through their TypeBox source of truth. In both cases the
 * provider-facing shape must be legal before a live model turn can see it.
 */
export function toolParameters(schema: ToolSchemaSource): TSchema {
  const jsonSchema = isZodSchema(schema) ? z.toJSONSchema(schema, { unrepresentable: 'throw' }) : schema;
  assertProviderLegalToolSchema(jsonSchema);
  return jsonSchema as TSchema;
}

export function assertProviderLegalToolSchema(schema: unknown): void {
  if (!isJsonObject(schema)) {
    throw new Error('Tool parameters must be a JSON Schema object.');
  }

  const illegalKey = ILLEGAL_TOP_LEVEL_UNION_KEYS.find((key) => key in schema);
  if (illegalKey) {
    throw new Error(
      `Tool parameters must not use top-level ${illegalKey}; wrap the union inside an object property.`,
    );
  }
}

function isZodSchema(schema: ToolSchemaSource): schema is z.ZodType {
  return schema instanceof z.ZodType;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
