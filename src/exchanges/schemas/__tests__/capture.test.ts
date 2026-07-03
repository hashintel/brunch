import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  zCaptureAnswerDetails,
  zCaptureCandidateDetails,
  zCaptureChoiceDetails,
  zCaptureChoicesDetails,
  zCaptureDetails,
  zCaptureReviewDetails,
} from '../index.js';

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() => z.toJSONSchema(schema, { unrepresentable: 'throw' })).not.toThrow();
}

describe('structured exchange capture schemas', () => {
  it('parses the agreed minimal capture variants', () => {
    expect(
      zCaptureAnswerDetails.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 1,
        exchange_id: 'problem-frame',
        tool_meta: { prev: 'request_answer', curr: 'capture_answer' },
      }),
    ).toMatchObject({ tool_meta: { curr: 'capture_answer' } });

    expect(
      zCaptureChoiceDetails.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: { prev: 'request_choice', curr: 'capture_choice' },
      }),
    ).toMatchObject({ tool_meta: { curr: 'capture_choice' } });

    expect(
      zCaptureChoicesDetails.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 1,
        exchange_id: 'open-risks',
        tool_meta: { prev: 'request_choices', curr: 'capture_choices' },
      }),
    ).toMatchObject({ tool_meta: { curr: 'capture_choices' } });

    expect(
      zCaptureReviewDetails.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 1,
        exchange_id: 'review-set-17',
        tool_meta: { prev: 'request_review', curr: 'capture_review' },
      }),
    ).toMatchObject({ tool_meta: { curr: 'capture_review' } });

    expect(
      zCaptureCandidateDetails.parse({
        schema: 'brunch.structured_exchange.capture',
        v: 1,
        exchange_id: 'candidate-direction',
        tool_meta: { prev: 'request_choice', curr: 'capture_candidate' },
      }),
    ).toMatchObject({ tool_meta: { curr: 'capture_candidate' } });
  });

  it('rejects graph payloads and analysis/provenance fields', () => {
    for (const field of [
      'committed_graph_nodes',
      'graph_edges',
      'lsn',
      'command_result',
      'assumptions',
      'caveats',
      'observations',
      'selected_candidate_id',
    ] as const) {
      expect(() =>
        zCaptureCandidateDetails.parse({
          schema: 'brunch.structured_exchange.capture',
          v: 1,
          exchange_id: 'candidate-direction',
          tool_meta: { prev: 'request_choice', curr: 'capture_candidate' },
          [field]: field,
        }),
      ).toThrow();
    }
  });

  it('exports capture schemas to JSON Schema', () => {
    expectJsonSchemaExport(zCaptureAnswerDetails);
    expectJsonSchemaExport(zCaptureChoiceDetails);
    expectJsonSchemaExport(zCaptureChoicesDetails);
    expectJsonSchemaExport(zCaptureReviewDetails);
    expectJsonSchemaExport(zCaptureCandidateDetails);
    expectJsonSchemaExport(zCaptureDetails);
  });
});
