import { describe, expect, it } from 'vitest';

import {
  axisOptionsForRuntimeState,
  defaultLensForRuntimeState,
  defaultStrategyForRuntimeState,
} from '../../agents/runtime/policy.js';
import { groundingFloorGaps } from '../../graph/schema/elicitation-gap-fixtures.js';
import { resolveBrunchAgentState } from '../../projections/session/runtime-state.js';
import { sessionRpcMethods } from '../../rpc/methods/session.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../runtime-state.js';

const runtimeAffordanceLedger = [
  {
    row: 'strategy.options',
    owner: 'agents/runtime/policy.axisOptionsForRuntimeState(strategy)',
    agent: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    row: 'strategy.default_on_switch',
    owner: 'agents/runtime/policy.defaultStrategyForRuntimeState',
    agent: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    row: 'strategy.selection',
    owner: 'session.runtimeState.agent.strategy',
    agent: 'required',
    rpc: 'required',
    web: 'deferred',
  },
  {
    row: 'lens.options',
    owner: 'agents/runtime/policy.axisOptionsForRuntimeState(lens)',
    agent: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    row: 'lens.default_on_switch',
    owner: 'agents/runtime/policy.defaultLensForRuntimeState',
    agent: 'required',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    row: 'lens.selection',
    owner: 'session.runtimeState.agent.lens',
    agent: 'required',
    rpc: 'required',
    web: 'deferred',
  },
  {
    row: 'active-review-set',
    owner: 'product-state-gated: review-cycle surface',
    agent: 'deferred',
    rpc: 'deferred',
    web: 'deferred',
  },
  {
    row: 'turn-mode',
    owner: 'product-state-gated: freestyle-vs-structured turn surface',
    agent: 'deferred',
    rpc: 'deferred',
    web: 'deferred',
  },
] as const;

type Consumer = 'agent' | 'rpc' | 'web';

function requiredRowsFor(consumer: Consumer): string[] {
  return runtimeAffordanceLedger
    .filter((row) => row[consumer] === 'required')
    .map((row) => row.row)
    .sort();
}

function runtimeStateSchemaAgentFields(): string[] {
  const runtimeState = sessionRpcMethods.find((method) => method.method === 'session.runtimeState');
  if (!runtimeState) throw new Error('session.runtimeState RPC method is not registered.');
  const agentProperties = (runtimeState.resultSchema as any).properties.agent.properties;
  return Object.keys(agentProperties)
    .filter((field) => field === 'strategy' || field === 'lens')
    .map((field) => `${field}.selection`)
    .sort();
}

describe('runtime affordances coverage ledger', () => {
  it('keeps the closed ledger focused on derived posture axes plus tripwired deferred rows', () => {
    expect(runtimeAffordanceLedger.map((row) => row.row)).toEqual([
      'strategy.options',
      'strategy.default_on_switch',
      'strategy.selection',
      'lens.options',
      'lens.default_on_switch',
      'lens.selection',
      'active-review-set',
      'turn-mode',
    ]);
  });

  it('covers all agent-required rows through the shared runtime policy derivation', () => {
    const state = resolveBrunchAgentState(DEFAULT_BRUNCH_AGENT_STATE);
    const gaps = groundingFloorGaps();
    const derivedRows = [
      axisOptionsForRuntimeState('strategy', state, gaps).length > 0 && 'strategy.options',
      defaultStrategyForRuntimeState(state) && 'strategy.default_on_switch',
      axisOptionsForRuntimeState('lens', state, gaps).length > 0 && 'lens.options',
      defaultLensForRuntimeState(state) && 'lens.default_on_switch',
    ].filter((row): row is string => typeof row === 'string');

    expect(new Set(derivedRows)).toEqual(
      new Set(requiredRowsFor('agent').filter((row) => !row.endsWith('.selection'))),
    );
  });

  it('keeps the required RPC affordance subset to current posture selections', () => {
    expect(runtimeStateSchemaAgentFields()).toEqual(requiredRowsFor('rpc'));
  });

  it('keeps product-state-gated affordances deferred instead of certifying unbuilt state', () => {
    expect(
      runtimeAffordanceLedger.filter((row) => row.row === 'active-review-set' || row.row === 'turn-mode'),
    ).toEqual([
      {
        row: 'active-review-set',
        owner: 'product-state-gated: review-cycle surface',
        agent: 'deferred',
        rpc: 'deferred',
        web: 'deferred',
      },
      {
        row: 'turn-mode',
        owner: 'product-state-gated: freestyle-vs-structured turn surface',
        agent: 'deferred',
        rpc: 'deferred',
        web: 'deferred',
      },
    ]);
  });
});
