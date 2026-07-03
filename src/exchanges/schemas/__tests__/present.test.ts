import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  zPresentCandidatesDetails,
  zPresentDetails,
  zPresentQuestionDetails,
  zPresentReviewSetDetails,
} from '../index.js';

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() => z.toJSONSchema(schema, { unrepresentable: 'throw' })).not.toThrow();
}

describe('structured exchange present schemas', () => {
  const candidateDetails = {
    schema: 'brunch.structured_exchange.present',
    v: 1,
    exchange_id: 'candidate-direction',
    tool_meta: { curr: 'present_candidates', next: 'request_response' },
    display: {
      heading: 'Which direction should we take?',
      body: 'Pick one candidate.',
    },
    candidates: [
      {
        id: 'candidate-local-workbench',
        title: 'Local workbench for graph-native specs',
        user_rubric: {
          core_bet: 'Make local graph work the thesis.',
          best_fit: 'Keeps the POC focused.',
          cost_complexity: 'Requires owning local state clearly.',
          covers_well: 'Covers chrome, transcript, and graph coherence.',
          main_risks: 'Does not solve cloud collaboration.',
          lock_in_constraints: 'Commits to local-first semantics.',
          recommendation: 'Choose this for the POC.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect locally.',
          failure_modes: 'May under-test multi-user cases.',
          coverage_range: 'Strong for current assumptions.',
          commitment: 'Defers cloud concerns.',
        },
        graph_refs: [{ node_id: 'node-1' }],
      },
    ],
  };

  it('parses conservative present variants and exact candidate details', () => {
    expect(
      zPresentQuestionDetails.parse({
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'problem-frame',
        tool_meta: { curr: 'present_question', next: 'request_response' },
        response_kind: 'answer',
        display: {
          heading: 'What problem are we solving first?',
          body: 'Name the pain.',
          preface: 'We need the user-facing pull.',
        },
      }),
    ).toMatchObject({ tool_meta: { curr: 'present_question' } });

    expect(
      zPresentQuestionDetails.parse({
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: { curr: 'present_question', next: 'request_response' },
        response_kind: 'choices',
        display: { heading: 'Which risks should stay visible?' },
        options: [
          {
            id: 'transport',
            content: 'Transport contract',
            rationale: 'Public RPC is a product seam.',
          },
        ],
      }),
    ).toMatchObject({ tool_meta: { next: 'request_response' }, response_kind: 'choices' });

    expect(
      zPresentReviewSetDetails.parse({
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'review-set-17',
        tool_meta: { curr: 'present_review_set', next: 'request_response' },
        display: { heading: 'Review proposed requirements' },
        review_set: {
          nodes: [
            {
              draft_id: 'req-approval',
              proposed_code: 'REQ1',
              plane: 'intent',
              kind: 'requirement',
              title: 'Approval is atomic',
            },
          ],
          edges: [
            {
              category: 'dependency',
              dependency: { draft_id: 'req-approval' },
              dependent: { existing_code: 'G1' },
            },
          ],
        },
      }),
    ).toMatchObject({
      review_set: { nodes: [{ draft_id: 'req-approval', proposed_code: 'REQ1' }] },
    });

    expect(zPresentCandidatesDetails.parse(candidateDetails)).toMatchObject({
      candidates: [{ graph_refs: [{ node_id: 'node-1' }] }],
    });
    expect(zPresentDetails.parse(candidateDetails)).toMatchObject({
      tool_meta: { curr: 'present_candidates' },
    });
  });

  it('keeps review-set details to nodes and edges only', () => {
    const reviewSetDetails = {
      schema: 'brunch.structured_exchange.present',
      v: 1,
      exchange_id: 'review-set-17',
      tool_meta: { curr: 'present_review_set', next: 'request_response' },
      display: { heading: 'Review proposed requirements' },
      review_set: {
        nodes: [
          {
            draft_id: 'req-approval',
            proposed_code: 'REQ1',
            plane: 'intent',
            kind: 'requirement',
            title: 'Approval is atomic',
          },
        ],
        edges: [
          {
            category: 'dependency',
            dependency: { draft_id: 'req-approval' },
            dependent: { existing_code: 'G1' },
          },
        ],
      },
    };

    for (const field of [
      'proposal_entry_id',
      'pitch',
      'user_rubric',
      'meta_rubric',
      'graph_drafts',
      'entity_drafts',
      'edge_drafts',
      'command_payload',
      'basis',
    ] as const) {
      expect(() =>
        zPresentReviewSetDetails.parse({
          ...reviewSetDetails,
          review_set: { ...reviewSetDetails.review_set, [field]: field },
        }),
      ).toThrow();
    }

    expect(() =>
      zPresentReviewSetDetails.parse({
        ...reviewSetDetails,
        review_set: {
          ...reviewSetDetails.review_set,
          nodes: [{ ...reviewSetDetails.review_set.nodes[0], basis: 'explicit' }],
        },
      }),
    ).toThrow();
    expect(() =>
      zPresentReviewSetDetails.parse({
        ...reviewSetDetails,
        review_set: {
          ...reviewSetDetails.review_set,
          edges: [{ ...reviewSetDetails.review_set.edges[0], dependency: { existing: 1 } }],
        },
      }),
    ).toThrow();
  });

  it('rejects candidate graph refs and rubric drift fields', () => {
    const firstCandidate = candidateDetails.candidates[0]!;

    expect(() =>
      zPresentCandidatesDetails.parse({
        ...candidateDetails,
        candidates: [
          {
            ...firstCandidate,
            graph_refs: [{ node_id: 'node-1', role: 'supporting' }],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      zPresentCandidatesDetails.parse({
        ...candidateDetails,
        candidates: [
          {
            ...firstCandidate,
            user_rubric: {
              ...firstCandidate.user_rubric,
              confidence: 'high',
            },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects retired present-side control fields', () => {
    for (const field of ['phase', 'status', 'next_required', 'schema_version'] as const) {
      expect(() =>
        zPresentCandidatesDetails.parse({
          ...candidateDetails,
          [field]: field === 'status' ? 'presented' : true,
        }),
      ).toThrow();
    }
  });

  it('exports present schemas to JSON Schema', () => {
    expectJsonSchemaExport(zPresentQuestionDetails);
    expectJsonSchemaExport(zPresentReviewSetDetails);
    expectJsonSchemaExport(zPresentCandidatesDetails);
    expectJsonSchemaExport(zPresentDetails);
  });
});
