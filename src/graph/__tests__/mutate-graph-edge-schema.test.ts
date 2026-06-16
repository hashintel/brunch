import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import { MutateCreateEdgeSchema, MutateGraphParams } from '../../.pi/extensions/graph/tool-schemas.js';
import { devGraphRpcMethods } from '../../rpc/methods/dev-graph.js';
import { EDGE_CATEGORIES, EDGE_CATEGORY_METADATA, type EdgeCategory } from '../index.js';

const devMutateGraphParamsSchema = devGraphRpcMethods.find(
  (definition) => definition.method === 'dev.graph.mutateGraph',
)!.paramsSchema as TSchema;

function roleNamedEdgeOp(category: EdgeCategory): Record<string, unknown> {
  if (category === 'association') {
    return {
      op: 'create_edge',
      category,
      a: 'n1',
      b: 'n2',
    };
  }

  const metadata = EDGE_CATEGORY_METADATA[category];
  return {
    op: 'create_edge',
    category,
    [metadata.sourceRole]: 'n1',
    [metadata.targetRole]: 'n2',
    ...(category === 'proof' || category === 'support' ? { stance: 'for' } : {}),
  };
}

describe('authored graph-mutation edge schemas', () => {
  it('accept canonical role-named endpoint fields for every edge category', () => {
    for (const category of EDGE_CATEGORIES) {
      const op = roleNamedEdgeOp(category);
      expect(Value.Check(MutateCreateEdgeSchema, op)).toBe(true);
      expect(Value.Check(MutateGraphParams, { ops: [op] })).toBe(true);
      expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [op] })).toBe(true);
    }
  });

  it('reject generic source/target authored edges and peer-shaped association ops', () => {
    const genericDependency = {
      op: 'create_edge',
      category: 'dependency',
      source: 'n1',
      target: 'n2',
    };
    const peerAssociation = {
      op: 'create_edge',
      category: 'association',
      peer: 'n1',
      b: 'n2',
    };

    expect(Value.Check(MutateCreateEdgeSchema, genericDependency)).toBe(false);
    expect(Value.Check(MutateCreateEdgeSchema, peerAssociation)).toBe(false);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [genericDependency] })).toBe(false);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [peerAssociation] })).toBe(false);
  });
});
