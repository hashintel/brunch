import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  structuredExchangeResponseRequiresComment,
  zCaptureDetailsHeader,
  zCaptureToolMeta,
  zGraphNodeRef,
  zMarkdown,
  zPresentDetailsHeader,
  zPresentToolMeta,
  zRequestDetailsHeader,
  zRequestToolMeta,
} from '../index.js';

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() => z.toJSONSchema(schema, { unrepresentable: 'throw' })).not.toThrow();
}

describe('structured exchange shared schemas', () => {
  it.each([
    [{ choiceKinds: ['listed'] as const }, false],
    [{ choiceKinds: ['other'] as const }, true],
    [{ choiceKinds: ['none'] as const }, true],
    [{ choiceKinds: ['listed', 'other'] as const }, true],
    [{ reviewDecision: 'approve' as const }, false],
    [{ reviewDecision: 'request_changes' as const }, true],
    [{ reviewDecision: 'reject' as const }, false],
  ])('identifies response cases that require comments %#', (params, expected) => {
    expect(structuredExchangeResponseRequiresComment(params)).toBe(expected);
  });

  it('parses checked details headers and rejects unsupported versions', () => {
    expect(
      zPresentDetailsHeader.parse({
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'problem-frame',
      }),
    ).toMatchObject({ exchange_id: 'problem-frame' });

    expect(() =>
      zPresentDetailsHeader.parse({
        schema: 'brunch.structured_exchange.present',
        v: 2,
        exchange_id: 'problem-frame',
      }),
    ).toThrow();
    expect(() =>
      zRequestDetailsHeader.parse({
        schema: 'brunch.structured_exchange.request',
        v: 2,
        exchange_id: 'problem-frame',
      }),
    ).toThrow();
    expect(() =>
      zCaptureDetailsHeader.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 2,
        exchange_id: 'problem-frame',
      }),
    ).toThrow();
  });

  it('parses shared markdown, graph refs, and tool sequencing metadata', () => {
    expect(zMarkdown.parse('**markdown**')).toBe('**markdown**');
    expect(zGraphNodeRef.parse({ node_id: 'node-1' })).toEqual({
      node_id: 'node-1',
    });

    expect(
      zPresentToolMeta.parse({
        curr: 'present_question',
        next: 'request_response',
      }),
    ).toEqual({ curr: 'present_question', next: 'request_response' });
    expect(
      zRequestToolMeta.parse({
        prev: 'present_candidates',
        curr: 'request_choice',
        next: 'capture_candidate',
      }),
    ).toEqual({
      prev: 'present_candidates',
      curr: 'request_choice',
      next: 'capture_candidate',
    });
    expect(
      zCaptureToolMeta.parse({
        prev: 'request_choice',
        curr: 'capture_candidate',
      }),
    ).toEqual({ prev: 'request_choice', curr: 'capture_candidate' });
  });

  it('exports representative shared schemas to JSON Schema', () => {
    expectJsonSchemaExport(zPresentDetailsHeader);
    expectJsonSchemaExport(zRequestDetailsHeader);
    expectJsonSchemaExport(zCaptureDetailsHeader);
    expectJsonSchemaExport(zGraphNodeRef);
    expectJsonSchemaExport(zPresentToolMeta);
    expectJsonSchemaExport(zRequestToolMeta);
    expectJsonSchemaExport(zCaptureToolMeta);
  });
});
