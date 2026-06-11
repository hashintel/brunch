import { describe, expect, it } from 'vitest';

import { ReadGraphParams } from '../.pi/extensions/graph/tool-schemas.js';
import { graphRpcMethods } from '../rpc/methods/graph.js';
import { queryKeys } from '../web/query-keys.js';

const observedShapeLedger = [
  {
    shape: 'overview',
    owner: 'getGraphOverview',
    tool: 'required',
    rpc: 'required',
    web: 'required',
  },
  {
    shape: 'neighborhood',
    owner: 'getNodeNeighborhood',
    tool: 'required',
    rpc: 'required',
    web: 'required',
  },
  {
    shape: 'list_by_kind',
    owner: 'getGraphSliceByKinds',
    tool: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    shape: 'list_by_band',
    owner: 'getGraphSliceByReadinessBands',
    tool: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    shape: 'gaps',
    owner: 'getGraphGaps',
    tool: 'required',
    rpc: 'not_applicable',
    web: 'not_applicable',
  },
  {
    shape: 'related',
    owner: 'getRelatedNodes',
    tool: 'required',
    rpc: 'not_applicable',
    web: 'not_applicable',
  },
  {
    shape: 'reconciliation_needs',
    owner: 'getOpenReconciliationNeeds',
    tool: 'deferred',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    shape: 'elicitation_gaps',
    owner: 'getElicitationGaps',
    tool: 'deferred',
    rpc: 'deferred',
    web: 'deferred',
  },
] as const;

type Consumer = 'tool' | 'rpc' | 'web';

function requiredShapesFor(consumer: Consumer): string[] {
  return observedShapeLedger
    .filter((row) => row[consumer] === 'required')
    .map((row) => row.shape)
    .sort();
}

function graphRpcShape(method: string): string {
  return method.replace(/^graph\./, '').replace(/^nodeNeighborhood$/, 'neighborhood');
}

function webGraphShape(keyFactoryName: string): string {
  return keyFactoryName.replace(/^nodeNeighborhood$/, 'neighborhood');
}

describe('graph observed-shape coverage ledger', () => {
  it('names exactly one canonical graph query owner for every observed read shape', () => {
    expect(observedShapeLedger).toHaveLength(8);
    expect(observedShapeLedger.map((row) => row.owner)).toEqual([
      'getGraphOverview',
      'getNodeNeighborhood',
      'getGraphSliceByKinds',
      'getGraphSliceByReadinessBands',
      'getGraphGaps',
      'getRelatedNodes',
      'getOpenReconciliationNeeds',
      'getElicitationGaps',
    ]);
  });

  it('keeps the read_graph tool surface aligned to the ledger-required shapes', () => {
    expect([...ReadGraphParams.properties.mode.enum].sort()).toEqual(requiredShapesFor('tool'));
  });

  it('keeps the public RPC graph surface aligned to the ledger-required shapes', () => {
    const actual = graphRpcMethods.map((definition) => graphRpcShape(definition.method)).sort();

    expect(actual).toEqual(requiredShapesFor('rpc'));
  });

  it('keeps the web graph query-key surface aligned to the ledger-required shapes', () => {
    const actual = Object.keys(queryKeys.graph).map(webGraphShape).sort();

    expect(actual).toEqual(requiredShapesFor('web'));
  });
});
