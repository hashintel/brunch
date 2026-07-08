import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  zPresentCandidatesParams,
  zPresentDigestParams,
  zAskParams,
  zPresentQuestionParams,
  zPresentReviewSetParams,
  zRequestResponseParams,
} from '../index.js';

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() => z.toJSONSchema(schema, { unrepresentable: 'throw' })).not.toThrow();
}

describe('structured exchange present params', () => {
  it('trims and rejects blank present headings at the params boundary', () => {
    expect(
      zPresentQuestionParams.parse({
        exchangeId: 'problem-frame',
        heading: '  Choose direction  ',
      }),
    ).toMatchObject({ heading: 'Choose direction' });
    expect(() => zPresentQuestionParams.parse({ exchangeId: 'problem-frame', heading: '   ' })).toThrow();

    expect(
      zPresentCandidatesParams.parse({
        exchangeId: 'candidate-direction',
        heading: '  Compare candidates  ',
        candidates: [
          {
            id: 'local',
            title: 'Local workbench',
            user_rubric: {
              core_bet: 'Local-first graph work.',
              best_fit: 'Current POC.',
              cost_complexity: 'Own local state.',
              covers_well: 'Graph and transcript.',
              main_risks: 'No cloud proof.',
              lock_in_constraints: 'Local semantics.',
            },
            meta_rubric: {},
            graph_refs: [],
          },
        ],
      }),
    ).toMatchObject({ heading: 'Compare candidates' });
    expect(() =>
      zPresentCandidatesParams.parse({
        exchangeId: 'candidate-direction',
        heading: '   ',
        candidates: [
          {
            id: 'local',
            title: 'Local workbench',
            user_rubric: {
              core_bet: 'Local-first graph work.',
              best_fit: 'Current POC.',
              cost_complexity: 'Own local state.',
              covers_well: 'Graph and transcript.',
              main_risks: 'No cloud proof.',
              lock_in_constraints: 'Local semantics.',
            },
            meta_rubric: {},
            graph_refs: [],
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts prose digest params and rejects graph-proposal-shaped fields', () => {
    expect(
      zPresentDigestParams.parse({
        exchangeId: 'digest-large-source',
        heading: '  Review source digest  ',
        digest: {
          abstract: 'Summarize large source material before mapping.',
          analysis: 'This is source-derived review input, not graph truth.',
          recommendation: 'Approve after checking fidelity.',
        },
      }),
    ).toMatchObject({ heading: 'Review source digest' });

    for (const field of ['nodes', 'edges', 'entityDrafts', 'edgeDrafts', 'command_payload'] as const) {
      expect(() =>
        zPresentDigestParams.parse({
          exchangeId: 'digest-large-source',
          heading: 'Review source digest',
          digest: {
            abstract: 'Summarize large source material before mapping.',
            [field]: [],
          },
        }),
      ).toThrow();
    }
  });

  it('rejects reserved escape ids on listed options and candidates', () => {
    expect(() =>
      zPresentQuestionParams.parse({
        exchangeId: 'reserved-id',
        heading: 'Pick one',
        options: [
          { id: 'listed', content: 'A listed option' },
          { id: 'none', content: 'Sneaky reserved id' },
        ],
      }),
    ).toThrow(/reserved/);
    expect(() =>
      zPresentQuestionParams.parse({
        exchangeId: 'reserved-id',
        heading: 'Pick one',
        options: [{ id: 'other', content: 'Sneaky reserved id' }],
      }),
    ).toThrow(/reserved/);

    expect(() =>
      zPresentCandidatesParams.parse({
        exchangeId: 'reserved-candidate',
        heading: 'Compare candidates',
        candidates: [
          {
            id: 'none',
            title: 'Reserved id candidate',
            user_rubric: {
              core_bet: 'Local-first graph work.',
              best_fit: 'Current POC.',
              cost_complexity: 'Own local state.',
              covers_well: 'Graph and transcript.',
              main_risks: 'No cloud proof.',
              lock_in_constraints: 'Local semantics.',
            },
            meta_rubric: {},
            graph_refs: [],
          },
        ],
      }),
    ).toThrow(/reserved/);
  });

  it('exports the nested present_review_set payload companion shape', () => {
    const schema = z.toJSONSchema(zPresentReviewSetParams, { unrepresentable: 'throw' }) as unknown as {
      readonly properties: {
        readonly payload: {
          readonly properties: {
            readonly grounding: { readonly properties: Readonly<Record<string, unknown>> };
            readonly pitch: { readonly properties: Readonly<Record<string, unknown>> };
            readonly entityDrafts: unknown;
            readonly edgeDrafts: unknown;
            readonly epistemicStatus: unknown;
          };
        };
      };
    };

    expect(schema.properties.payload.properties.epistemicStatus).toBeDefined();
    expect(schema.properties.payload.properties.grounding.properties).toHaveProperty('summary');
    expect(schema.properties.payload.properties.grounding.properties).toHaveProperty('support');
    expect(schema.properties.payload.properties.pitch.properties).toHaveProperty('title');
    expect(schema.properties.payload.properties.pitch.properties).toHaveProperty('narrative');
    expect(schema.properties.payload.properties.entityDrafts).toBeDefined();
    expect(schema.properties.payload.properties.edgeDrafts).toBeDefined();
  });
});

describe('structured exchange ask params', () => {
  it('parses one-shot ask body/options and rejects blank body plus reserved option ids', () => {
    expect(
      zAskParams.parse({
        exchangeId: 'problem-frame',
        body: '  ## What problem are we solving?  ',
      }),
    ).toMatchObject({ body: '## What problem are we solving?' });

    expect(
      zAskParams.parse({
        exchangeId: 'domain-shape',
        body: 'Pick one.',
        options: [{ id: 'local', label: 'Local workbench', description: 'Best POC fit.' }],
      }),
    ).toMatchObject({ options: [{ id: 'local', label: 'Local workbench' }] });

    expect(() => zAskParams.parse({ exchangeId: 'blank', body: '   ' })).toThrow(/cannot be empty/);
    expect(() =>
      zAskParams.parse({
        exchangeId: 'reserved',
        body: 'Pick one.',
        options: [{ id: 'other', label: 'Other as listed' }],
      }),
    ).toThrow(/reserved/);
    expectJsonSchemaExport(zAskParams);
  });
});

describe('structured exchange request_response params', () => {
  it('parses and exports the single exchangeId param', () => {
    expect(zRequestResponseParams.parse({ exchangeId: 'problem-frame' })).toEqual({
      exchangeId: 'problem-frame',
    });
    expectJsonSchemaExport(zRequestResponseParams);
  });
});
