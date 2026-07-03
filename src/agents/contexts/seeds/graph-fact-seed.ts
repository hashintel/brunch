/**
 * Thin graph-fact neutral seed (A36-L, D102-L) — raw facts about graph state,
 * never a score, rank, or readiness judgment. Deterministic code must not
 * recreate the old count/rank agenda engine; the `elicitor.md` orientation
 * directive and the agent's own reasoning turn these facts into a session
 * vein, not this renderer.
 *
 * Input:  a GraphSlice (nodes + lsn)
 * Output: node counts by kind, zero-count kinds with their latest-expected
 *         band, and the graph LSN
 * Used by: agents/contexts/seeds/turn-context.ts, agents/contexts/seeds/origination.ts,
 *          agents/contexts/data-model/spec/spec-context.ts
 */

import { NODE_KINDS, type ReadinessBand } from '../../../graph/schema/kinds.js';
import { latestExpectedBand, type NodeKind } from '../../../graph/schema/nodes.js';
import { markdownUl } from '../../shared/markdown.js';

export interface GraphFactSeedInput {
  readonly lsn: number;
  readonly nodes: readonly { readonly kind: NodeKind }[];
}

export interface ZeroCountKindFact {
  readonly kind: NodeKind;
  readonly band: ReadinessBand | null;
}

export interface GraphFactSeed {
  readonly lsn: number;
  readonly nodeCountsByKind: Readonly<Partial<Record<NodeKind, number>>>;
  readonly zeroCountKinds: readonly ZeroCountKindFact[];
}

export function deriveGraphFactSeed(input: GraphFactSeedInput): GraphFactSeed {
  const nodeCountsByKind: Partial<Record<NodeKind, number>> = {};
  for (const node of input.nodes) {
    nodeCountsByKind[node.kind] = (nodeCountsByKind[node.kind] ?? 0) + 1;
  }

  const zeroCountKinds = NODE_KINDS.filter((kind) => !nodeCountsByKind[kind]).map((kind) => ({
    kind,
    band: latestExpectedBand(kind),
  }));

  return { lsn: input.lsn, nodeCountsByKind, zeroCountKinds };
}

export function renderGraphFactSeed(seed: GraphFactSeed): string {
  const counts = NODE_KINDS.flatMap((kind) => {
    const count = seed.nodeCountsByKind[kind];
    return count === undefined ? [] : [`${kind}=${count}`];
  }).join(', ');
  const zeroKinds = seed.zeroCountKinds
    .map((entry) => `${entry.kind} (band=${entry.band ?? 'none'})`)
    .join(', ');

  return `Graph facts:\n${markdownUl([
    `lsn: ${seed.lsn}`,
    `node counts by kind: ${counts || 'none'}`,
    `zero-count kinds: ${zeroKinds || 'none'}`,
  ])}`;
}
