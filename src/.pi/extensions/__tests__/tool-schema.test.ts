import { Type } from 'typebox';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { toolParameters } from '../shared/tool-schema.js';

describe('toolParameters', () => {
  it('accepts legal Zod object schemas', () => {
    expect(toolParameters(z.object({ query: z.string() }))).toMatchObject({
      type: 'object',
      properties: { query: { type: 'string' } },
    });
  });

  it('passes legal TypeBox objects through without changing their emitted shape', () => {
    const schema = Type.Object({ query: Type.String() });
    const serializedBefore = JSON.stringify(schema);

    expect(toolParameters(schema)).toBe(schema);
    expect(JSON.stringify(schema)).toBe(serializedBefore);
  });

  it('rejects non-object roots', () => {
    expect(() => toolParameters(z.string())).toThrow(/object root/);
    expect(() => toolParameters(Type.String())).toThrow(/object root/);
  });

  it('rejects top-level provider-illegal unions', () => {
    expect(() => toolParameters(z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]))).toThrow(
      /top-level anyOf/,
    );
    expect(() => toolParameters({ oneOf: [Type.Object({ a: Type.String() })] } as never)).toThrow(
      /top-level oneOf/,
    );
    expect(() => toolParameters({ allOf: [Type.Object({ a: Type.String() })] } as never)).toThrow(
      /top-level allOf/,
    );
  });

  it('allows nested unions inside object properties', () => {
    expect(() =>
      toolParameters(Type.Object({ target: Type.Union([Type.Literal('node'), Type.Literal('edge')]) })),
    ).not.toThrow();
  });
});
