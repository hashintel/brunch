import { describe, expect, it } from 'vitest';

import { witnessedReviewSetFixture } from '../../../dev/component-preview/review-set-fixtures.js';
import { projectPresentReviewSet } from '../../../exchanges/projections/present-review-set.js';
import type { PresentReviewSetDetails } from '../../../exchanges/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { ExchangeReviewSetResultComponent } from '../exchange-review-set-result.js';

type ReviewSet = PresentReviewSetDetails['review_set'];
type Endpoint = { draft_id: string } | { existing_code: string };

type Inventory = {
  nodeSettlements: Record<string, string>;
  connectionSettlements: string[];
};

function referenceInventory(reviewSet: ReviewSet): Inventory {
  const codeByDraftId = new Map(reviewSet.nodes.map((node) => [node.draft_id, node.proposed_code]));
  const nodeSettlements = Object.fromEntries(
    reviewSet.nodes.map((node) => [node.proposed_code, node.settlement]),
  );
  const connectionSettlements: string[] = [];
  const code = (endpoint: Endpoint) =>
    'existing_code' in endpoint ? endpoint.existing_code : codeByDraftId.get(endpoint.draft_id);

  // Deliberately naive and flat: enumerate semantic endpoint pairs without using
  // renderer grouping, host selection, or connection helpers.
  for (const edge of reviewSet.edges) {
    let endpoints: readonly [Endpoint, Endpoint];
    switch (edge.category) {
      case 'dependency':
        endpoints = [edge.dependency, edge.dependent];
        break;
      case 'witness':
        endpoints = [edge.claim, edge.oracle];
        break;
      case 'rationale':
        endpoints = [edge.claim, edge.support];
        break;
      case 'realization':
      case 'refinement':
        endpoints = [edge.abstract, edge.concrete];
        break;
      case 'exclusion':
        endpoints = [edge.boundary, edge.subject];
        break;
      case 'composition':
        endpoints = [edge.whole, edge.part];
        break;
      case 'cross_reference':
        endpoints = [edge.a, edge.b];
        break;
      case 'supersession':
        endpoints = [edge.predecessor, edge.successor];
        break;
    }
    const [host, other] = endpoints.map(code);
    if (host && other) connectionSettlements.push(`${host} -> ${other} [${edge.settlement}]`);
  }

  return { nodeSettlements, connectionSettlements: connectionSettlements.sort() };
}

function renderedInventory(details: PresentReviewSetDetails): Inventory {
  const lines = new ExchangeReviewSetResultComponent(details).render(2_000);
  const nodeSettlements: Record<string, string> = {};
  const connectionSettlements: string[] = [];
  let currentCode: string | undefined;

  for (const line of lines) {
    const refs = /\brefs:\s*(.+?)\s*$/.exec(line);
    if (refs) {
      if (!currentCode) throw new Error(`Reference row has no preceding code: ${line}`);
      for (const ref of refs[1].split(', ')) {
        const match = /^(\S+) \[(advisory|settled)\]$/.exec(ref);
        if (match) connectionSettlements.push(`${currentCode} -> ${match[1]} [${match[2]}]`);
      }
      continue;
    }

    const standalone = /\b(\S+) -> (\S+) \[(advisory|settled)\]$/.exec(line.trim());
    if (standalone) {
      connectionSettlements.push(`${standalone[1]} -> ${standalone[2]} [${standalone[3]}]`);
      continue;
    }

    const node = /\b([A-Z][A-Z0-9]*\d+)\s+.+ \[(advisory|settled)\]\s*$/.exec(line);
    if (node) {
      nodeSettlements[node[1]] = node[2];
      currentCode = node[1];
    }
  }

  return { nodeSettlements, connectionSettlements: connectionSettlements.sort() };
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

const goal = (draftId: string, proposedCode: string, settlement: 'advisory' | 'settled' = 'settled') => ({
  draftId,
  proposedCode,
  settlement,
  plane: 'intent' as const,
  kind: 'goal' as const,
  title: `Goal ${proposedCode}`,
});

const check = (draftId: string, proposedCode: string) => ({
  draftId,
  proposedCode,
  settlement: 'settled' as const,
  plane: 'oracle' as const,
  kind: 'check' as const,
  title: `Check ${proposedCode}`,
});

function expectDifferentialMatch(details: PresentReviewSetDetails) {
  expect(renderedInventory(details)).toEqual(referenceInventory(details.review_set));
}

describe('Impact Ledger differential reference inventory', () => {
  it('matches the witnessed review-set fixture', () => {
    expect(witnessedReviewSetFixture.payload.entityDrafts).toHaveLength(17);
    expect(witnessedReviewSetFixture.payload.edgeDrafts).toHaveLength(11);
    expectDifferentialMatch(witnessedReviewSetFixture.projection.details);
  });

  it.each([
    ['empty group', detailsFor([{ ...check('check-only', 'CH1') }])],
    ['single-node group', detailsFor([goal('goal-only', 'G1')])],
    [
      'mixed settlements and existing host',
      detailsFor(
        [goal('goal-advisory', 'G1', 'advisory'), check('check-settled', 'CH1')],
        [
          {
            category: 'dependency' as const,
            settlement: 'settled' as const,
            dependency: { draftId: 'goal-advisory' },
            dependent: { draftId: 'check-settled' },
          },
          {
            category: 'cross_reference' as const,
            settlement: 'advisory' as const,
            a: { existingCode: 'G99' },
            b: { draftId: 'check-settled' },
          },
          {
            category: 'supersession' as const,
            settlement: 'settled' as const,
            predecessor: { existingCode: 'G98' },
            successor: { existingCode: 'G97' },
          },
        ],
      ),
    ],
    [
      'term-only group',
      detailsFor([
        {
          draftId: 'term-only',
          proposedCode: 'T1',
          settlement: 'settled' as const,
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
          settlement: 'settled' as const,
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
