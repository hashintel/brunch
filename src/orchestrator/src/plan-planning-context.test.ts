// FE-829 slice 3: deterministic tests for the planning-context projection.
//
// Verifies the slice-id-space lifting of spec relation edges: criterion
// ownership via `verifies`, dropping of unresolved/self edges, and
// stable dedupe+sort. No LLM involvement — this is the testable seam.

import { describe, expect, it } from 'vitest';

import { projectPlanningContext } from './plan-planning-context.js';
import type { CompletedSpecSnapshot } from './plan-projection.js';

function snapshot(partial: Partial<CompletedSpecSnapshot>): CompletedSpecSnapshot {
  return {
    requirements: [],
    criteria: [],
    edges: [],
    ...partial,
  };
}

describe('projectPlanningContext', () => {
  it('lifts a requirement→requirement relation into slice-id space', () => {
    const result = projectPlanningContext(
      snapshot({
        requirements: [
          { id: 1, content: 'A', kindOrdinal: 0 },
          { id: 2, content: 'B', kindOrdinal: 1 },
        ],
        edges: [{ fromItemId: 2, toItemId: 1, relation: 'depends_on' }],
      }),
    );

    expect(result.relations).toEqual([{ fromSliceId: 'req-2', relation: 'depends_on', toSliceId: 'req-1' }]);
  });

  it('lifts a criterion-anchored relation onto its owning requirement', () => {
    const result = projectPlanningContext(
      snapshot({
        requirements: [
          { id: 1, content: 'A', kindOrdinal: 0 },
          { id: 2, content: 'B', kindOrdinal: 1 },
        ],
        criteria: [{ id: 10, content: 'crit for B', kindOrdinal: 0 }],
        edges: [
          // criterion 10 verifies requirement 2 → owner is req-2
          { fromItemId: 10, toItemId: 2, relation: 'verifies' },
          // criterion 10 refines requirement 1 → req-2 refines req-1
          { fromItemId: 10, toItemId: 1, relation: 'refines' },
        ],
      }),
    );

    expect(result.relations).toEqual([{ fromSliceId: 'req-2', relation: 'refines', toSliceId: 'req-1' }]);
  });

  it('never emits `verifies` edges as planning relations', () => {
    const result = projectPlanningContext(
      snapshot({
        requirements: [{ id: 1, content: 'A', kindOrdinal: 0 }],
        criteria: [{ id: 10, content: 'crit', kindOrdinal: 0 }],
        edges: [{ fromItemId: 10, toItemId: 1, relation: 'verifies' }],
      }),
    );

    expect(result.relations).toEqual([]);
  });

  it('drops unresolved endpoints and self-edges, and dedupes', () => {
    const result = projectPlanningContext(
      snapshot({
        requirements: [
          { id: 1, content: 'A', kindOrdinal: 0 },
          { id: 2, content: 'B', kindOrdinal: 1 },
        ],
        edges: [
          // unresolved endpoint (item 99 is neither requirement nor owned criterion)
          { fromItemId: 99, toItemId: 1, relation: 'depends_on' },
          // self-edge after resolution
          { fromItemId: 1, toItemId: 1, relation: 'constrains' },
          // duplicate of the kept relation
          { fromItemId: 2, toItemId: 1, relation: 'depends_on' },
          { fromItemId: 2, toItemId: 1, relation: 'depends_on' },
        ],
      }),
    );

    expect(result.relations).toEqual([{ fromSliceId: 'req-2', relation: 'depends_on', toSliceId: 'req-1' }]);
  });

  it('stable-sorts relations by from, relation, then to', () => {
    const result = projectPlanningContext(
      snapshot({
        requirements: [
          { id: 1, content: 'A', kindOrdinal: 0 },
          { id: 2, content: 'B', kindOrdinal: 1 },
          { id: 3, content: 'C', kindOrdinal: 2 },
        ],
        edges: [
          { fromItemId: 3, toItemId: 1, relation: 'depends_on' },
          { fromItemId: 1, toItemId: 3, relation: 'refines' },
          { fromItemId: 1, toItemId: 2, relation: 'depends_on' },
        ],
      }),
    );

    expect(result.relations).toEqual([
      { fromSliceId: 'req-1', relation: 'depends_on', toSliceId: 'req-2' },
      { fromSliceId: 'req-1', relation: 'refines', toSliceId: 'req-3' },
      { fromSliceId: 'req-3', relation: 'depends_on', toSliceId: 'req-1' },
    ]);
  });
});
