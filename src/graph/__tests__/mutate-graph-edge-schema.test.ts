import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import {
  MutateCreateEdgeSchema,
  MutateGraphParams,
} from '../../.pi/extensions/brunch-data/graph/tool-schemas.js';
import { devGraphRpcMethods } from '../../rpc/methods/dev-graph.js';
import { EDGE_CATEGORIES, EDGE_CATEGORY_METADATA, type EdgeCategory } from '../index.js';

const devMutateGraphParamsSchema = devGraphRpcMethods.find(
  (definition) => definition.method === 'dev.graph.mutateGraph',
)!.paramsSchema as TSchema;

function roleNamedEdgeOp(category: EdgeCategory): Record<string, unknown> {
  if (category === 'cross_reference') {
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
    ...(category === 'witness' || category === 'rationale' ? { stance: 'for' } : {}),
  };
}

function createNodeOp(kind: string, detail?: unknown): Record<string, unknown> {
  return {
    op: 'create_node',
    ref: 'n1',
    plane: 'intent',
    kind,
    title: `${kind} title`,
    ...(detail === undefined ? {} : { detail }),
  };
}

describe('authored graph-mutation schemas', () => {
  it('accept canonical role-named endpoint fields for every edge category', () => {
    for (const category of EDGE_CATEGORIES) {
      const op = roleNamedEdgeOp(category);
      expect(Value.Check(MutateCreateEdgeSchema, op)).toBe(true);
      expect(Value.Check(MutateGraphParams, { ops: [op] })).toBe(true);
      expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [op] })).toBe(true);
    }
  });

  it('reject generic source/target authored edges and peer-shaped cross_reference ops', () => {
    const genericDependency = {
      op: 'create_edge',
      category: 'dependency',
      source: 'n1',
      target: 'n2',
    };
    const peerAssociation = {
      op: 'create_edge',
      category: 'cross_reference',
      peer: 'n1',
      b: 'n2',
    };

    expect(Value.Check(MutateCreateEdgeSchema, genericDependency)).toBe(false);
    expect(Value.Check(MutateCreateEdgeSchema, peerAssociation)).toBe(false);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [genericDependency] })).toBe(false);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [peerAssociation] })).toBe(false);
  });

  it('teaches and enforces per-kind create_node detail companions', () => {
    const decision = createNodeOp('decision', {
      chosen_option: 'SQLite',
      rejected: ['PostgreSQL'],
      rationale: 'Local POC storage.',
    });
    const term = createNodeOp('term', {
      definition: 'A graph-native specification item.',
      aliases: ['node'],
    });
    const malformedDecision = createNodeOp('decision', {
      chosen_option: 'SQLite',
      rejected: [],
      rationale: 'Local POC storage.',
    });
    const contextWithDetail = createNodeOp('context', { definition: 'not legal here' });

    expect(Value.Check(MutateGraphParams, { ops: [decision] })).toBe(true);
    expect(Value.Check(MutateGraphParams, { ops: [term] })).toBe(true);
    expect(Value.Check(MutateGraphParams, { ops: [malformedDecision] })).toBe(false);
    expect(Value.Check(MutateGraphParams, { ops: [contextWithDetail] })).toBe(false);

    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [decision] })).toBe(true);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [term] })).toBe(true);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [malformedDecision] })).toBe(false);
    expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [contextWithDetail] })).toBe(false);
  });

  it('teaches and enforces claim-kind detail.form companions', () => {
    const thenField = `${'the'}n`;
    const requirementGherkin = createNodeOp('requirement', {
      form: 'gherkin',
      given: ['offline'],
      when: ['save'],
      [thenField]: ['persisted'],
    });
    const criterionFormal = createNodeOp('criterion', {
      form: 'formal',
      language: 'lean',
      statement: 'p',
    });
    const requirementPlain = createNodeOp('requirement', { form: 'plain' });
    const requirementNoDetail = createNodeOp('requirement');
    const contextGiven = createNodeOp('context', { form: 'given', statement: 'stipulated' });
    const requirementBogusForm = createNodeOp('requirement', { form: 'bogus' });
    const contextPlain = createNodeOp('context', { form: 'plain' });
    const gherkinNoThen = createNodeOp('criterion', { form: 'gherkin', given: ['x'] });

    for (const op of [
      requirementGherkin,
      criterionFormal,
      requirementPlain,
      requirementNoDetail,
      contextGiven,
    ]) {
      expect(Value.Check(MutateGraphParams, { ops: [op] })).toBe(true);
      expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [op] })).toBe(true);
    }

    for (const op of [requirementBogusForm, contextPlain, gherkinNoThen]) {
      expect(Value.Check(MutateGraphParams, { ops: [op] })).toBe(false);
      expect(Value.Check(devMutateGraphParamsSchema, { specId: 1, ops: [op] })).toBe(false);
    }
  });

  it('exposes detail payload properties instead of an opaque unknown schema', () => {
    const opSchema = MutateGraphParams.properties.ops.items as unknown as {
      readonly anyOf: readonly [
        {
          readonly anyOf: readonly {
            readonly properties: {
              readonly detail: { readonly properties: Readonly<Record<string, unknown>> };
            };
          }[];
        },
      ];
    };
    const decisionCreate = opSchema.anyOf[0].anyOf[0]!;
    const termCreate = opSchema.anyOf[0].anyOf[1]!;

    expect(decisionCreate.properties.detail.properties).toHaveProperty('chosen_option');
    expect(decisionCreate.properties.detail.properties).toHaveProperty('rejected');
    expect(termCreate.properties.detail.properties).toHaveProperty('definition');
    expect(termCreate.properties.detail.properties).toHaveProperty('aliases');
  });
});
