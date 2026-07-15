import { describe, expect, it } from 'vitest';

import { presentReviewSetFixture } from '../../../dev/component-preview/exchange-fixtures.js';
import { projectPresentReviewSet } from '../../../exchanges/projections/present-review-set.js';
import type { PresentReviewSetDetails } from '../../../exchanges/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { ExchangeReviewSetResultComponent } from '../exchange-review-set-result.js';

type ReviewSet = PresentReviewSetDetails['review_set'];
type Endpoint = { draft_id: string } | { existing_code: string };

type Inventory = {
  codes: string[];
  connectionCounts: Record<string, number>;
};

function referenceInventory(reviewSet: ReviewSet): Inventory {
  const codeByDraftId = new Map(reviewSet.nodes.map((node) => [node.draft_id, node.proposed_code]));
  const connectionCounts: Record<string, number> = {};

  // Deliberately flat and explicit: this reference extractor knows nothing about
  // Impact Ledger concern groups, kind ordering, or its connection-map helper.
  for (const edge of reviewSet.edges) {
    let host: Endpoint;
    switch (edge.category) {
      case 'dependency':
        host = edge.dependency;
        break;
      case 'witness':
      case 'rationale':
        host = edge.claim;
        break;
      case 'realization':
      case 'refinement':
        host = edge.abstract;
        break;
      case 'exclusion':
        host = edge.boundary;
        break;
      case 'composition':
        host = edge.whole;
        break;
      case 'cross_reference':
        host = edge.a;
        break;
      case 'supersession':
        host = edge.predecessor;
        break;
    }
    if ('draft_id' in host) {
      const code = codeByDraftId.get(host.draft_id);
      if (code) connectionCounts[code] = (connectionCounts[code] ?? 0) + 1;
    }
  }

  return {
    codes: [...codeByDraftId.values()].sort(),
    connectionCounts,
  };
}

function renderedInventory(details: PresentReviewSetDetails): Inventory {
  const lines = new ExchangeReviewSetResultComponent(details).render(2_000);
  const codes: string[] = [];
  const connectionCounts: Record<string, number> = {};
  let currentCode: string | undefined;

  for (const line of lines) {
    const refs = /\brefs:\s*(.+?)\s*$/.exec(line);
    if (refs) {
      if (!currentCode) throw new Error(`Reference row has no preceding code: ${line}`);
      connectionCounts[currentCode] = refs[1].split(',').length;
      continue;
    }

    const code = line.match(/\b[A-Z][A-Z0-9]*\d+\b/)?.[0];
    if (code) {
      codes.push(code);
      currentCode = code;
    }
  }

  return { codes: codes.sort(), connectionCounts };
}

function detailsFor(
  entityDrafts: ReviewSetProposalPayload['entityDrafts'],
  edgeDrafts: ReviewSetProposalPayload['edgeDrafts'] = [],
) {
  return projectPresentReviewSet({
    exchangeId: 'differential-review-set',
    payload: {
      schemaVersion: 1,
      lens: 'intent',
      epistemicStatus: 'asserted',
      grounding: { summary: 'Differential fixture', support: [] },
      pitch: { title: 'Differential fixture', narrative: 'Compare independent inventories.' },
      entityDrafts,
      edgeDrafts,
    },
  }).details;
}

const goal = (draftId: string, proposedCode: string) => ({
  draftId,
  proposedCode,
  plane: 'intent' as const,
  kind: 'goal' as const,
  title: `Goal ${proposedCode}`,
});

const check = (draftId: string, proposedCode: string) => ({
  draftId,
  proposedCode,
  plane: 'oracle' as const,
  kind: 'check' as const,
  title: `Check ${proposedCode}`,
});

function expectDifferentialMatch(details: PresentReviewSetDetails) {
  expect(renderedInventory(details)).toEqual(referenceInventory(details.review_set));
}

describe('Impact Ledger differential reference inventory', () => {
  it('matches the witnessed review-set fixture', () => {
    expectDifferentialMatch(presentReviewSetFixture.projection.details);
  });

  it.each([
    ['empty group', detailsFor([{ ...check('check-only', 'CH1') }])],
    ['single-node group', detailsFor([goal('goal-only', 'G1')])],
    [
      'term-only group',
      detailsFor([
        {
          draftId: 'term-only',
          proposedCode: 'T1',
          plane: 'intent',
          kind: 'term',
          title: 'Ledger',
          detail: { definition: 'A compact impact inventory.' },
        },
      ]),
    ],
    [
      'max-refs group',
      detailsFor(
        [
          goal('goal-host', 'G1'),
          ...Array.from({ length: 8 }, (_, index) => check(`check-${index}`, `CH${index + 1}`)),
        ],
        Array.from({ length: 8 }, (_, index) => ({
          category: 'witness' as const,
          claim: { draftId: 'goal-host' },
          oracle: { draftId: `check-${index}` },
          stance: 'for' as const,
        })),
      ),
    ],
  ])('matches the %s edge fixture', (_name, details) => {
    expectDifferentialMatch(details);
  });
});
