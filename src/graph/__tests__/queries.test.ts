import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { graphClock, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { getOpenReconciliationNeeds } from '../queries.js';
import { READINESS_BANDS } from '../schema/kinds.js';
import {
  NODE_KIND_METADATA,
  latestExpectedBand,
  parseGraphNodeCode,
  type NodeKind,
} from '../schema/nodes.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('graph node code metadata', () => {
  it('uses globally unique 1-3 letter labels and parses by longest prefix', () => {
    const labels = Object.values(NODE_KIND_METADATA).map((metadata) => metadata.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((label) => /^[A-Z]{1,3}$/.test(label))).toBe(true);
    expect(parseGraphNodeCode('A1')).toEqual({ kind: 'assumption', kindOrdinal: 1 });
    expect(parseGraphNodeCode('CON2')).toEqual({ kind: 'constraint', kindOrdinal: 2 });
    expect(parseGraphNodeCode('REQ3')).toEqual({ kind: 'requirement', kindOrdinal: 3 });
    expect(parseGraphNodeCode('AC4')).toEqual({ kind: 'criterion', kindOrdinal: 4 });
  });

  it('pins code-label metadata without storing readiness bands per kind', () => {
    expect(NODE_KIND_METADATA).toEqual({
      goal: { label: 'G' },
      thesis: { label: 'TH' },
      term: { label: 'T' },
      context: { label: 'CTX' },
      story: { label: 'ST' },
      unknown: { label: 'UNK' },
      requirement: { label: 'REQ' },
      assumption: { label: 'A' },
      constraint: { label: 'CON' },
      invariant: { label: 'INV' },
      decision: { label: 'D' },
      criterion: { label: 'AC' },
      example: { label: 'EX' },
      check: { label: 'CH' },
      vv_method: { label: 'VV' },
      evidence: { label: 'E' },
      vv_obligation: { label: 'O' },
      module: { label: 'MOD' },
      interface: { label: 'API' },
      entity: { label: 'ENT' },
      sketch: { label: 'SKT' },
      milestone: { label: 'M' },
      frontier: { label: 'F' },
      slice: { label: 'S' },
    });
  });

  it('derives the latest-expected-band scalar from plane plus intent-kind bisection', () => {
    expect(READINESS_BANDS).toEqual(['grounding', 'elicitation', 'projection', 'commitment']);

    const projectionKinds = [
      'module',
      'interface',
      'entity',
      'check',
      'vv_method',
      'vv_obligation',
      'evidence',
      'requirement',
    ] as const satisfies readonly NodeKind[];
    for (const kind of projectionKinds) {
      expect(latestExpectedBand(kind)).toBe('projection');
    }
    const commitmentKinds = [
      'milestone',
      'frontier',
      'slice',
      'criterion',
    ] as const satisfies readonly NodeKind[];
    for (const kind of commitmentKinds) {
      expect(latestExpectedBand(kind)).toBe('commitment');
    }
    const bandLessKinds = ['example', 'sketch', 'term', 'story'] as const satisfies readonly NodeKind[];
    for (const kind of bandLessKinds) {
      expect(latestExpectedBand(kind)).toBeNull();
    }
    const groundingKinds = ['goal', 'thesis'] as const satisfies readonly NodeKind[];
    for (const kind of groundingKinds) {
      expect(latestExpectedBand(kind)).toBe('grounding');
    }
    const elicitationKinds = [
      'context',
      'constraint',
      'unknown',
      'assumption',
      'invariant',
      'decision',
    ] as const satisfies readonly NodeKind[];
    for (const kind of elicitationKinds) {
      expect(latestExpectedBand(kind)).toBe('elicitation');
    }
  });
});

describe('getOpenReconciliationNeeds', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs).values({ name: 'Test Spec', slug: 'test' }).run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  it('returns open needs as typed domain objects and excludes resolved needs', () => {
    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const create = executor.createReconciliationNeed({
      specId,
      target: { kind: 'edge', edgeId: batch.createdEdges[0]! },
      needKind: 'edge_revalidation',
      reason: 'upstream changed',
    });
    expect(create.status).toBe('success');
    if (create.status !== 'success') throw new Error('unreachable');

    expect(getOpenReconciliationNeeds(db, specId)).toMatchObject([
      {
        kind: 'edge_revalidation',
        target: { kind: 'edge', edgeId: batch.createdEdges[0]! },
        rationale: 'upstream changed',
      },
    ]);

    executor.resolveReconciliationNeed({ specId, id: create.id });
    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
  });
});
