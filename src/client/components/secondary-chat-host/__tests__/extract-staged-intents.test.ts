import { describe, expect, it } from 'vitest';

import type { BrunchUIMessage, BrunchUIMessagePart, EditImpactTier } from '@/shared/chat.js';

import type { PatchAnchor } from '../../patch-list-reducer.js';
import { extractStagedIntents, type ExtractStagedIntentsContext } from '../extract-staged-intents.js';

const PINNED: PatchAnchor = { kind: 'context', itemId: 5 };
const OTHER: PatchAnchor = { kind: 'goal', itemId: 10 };

function buildContext(overrides: Partial<ExtractStagedIntentsContext> = {}): ExtractStagedIntentsContext {
  return {
    producerChatId: 42,
    pinnedAnchor: PINNED,
    editImpactByToolCallId: new Map<string, EditImpactTier>(),
    resolveTargetAnchor: () => undefined,
    ...overrides,
  };
}

function assistantMessage(parts: BrunchUIMessagePart[]): BrunchUIMessage {
  return {
    id: `msg-${Math.random()}`,
    role: 'assistant',
    parts,
  };
}

function proposeEditPart(
  toolCallId: string,
  input: { newContent: string; newRationale?: string },
  state: 'input-streaming' | 'input-available' | 'output-available' = 'input-available',
): BrunchUIMessagePart {
  // Cast via unknown because the discriminated union's per-state shape varies
  // and the test only needs to drive the extractor's behaviour, not the SDK
  // contract.
  return { type: 'tool-propose_edit', toolCallId, state, input } as unknown as BrunchUIMessagePart;
}

function proposeEdgePart(
  toolCallId: string,
  input: { targetReferenceCode: string; relation: string },
  state: 'input-available' | 'output-available' = 'input-available',
): BrunchUIMessagePart {
  return { type: 'tool-propose_edge', toolCallId, state, input } as unknown as BrunchUIMessagePart;
}

function proposeDrillDownPart(toolCallId: string, input: { focusArea: string }): BrunchUIMessagePart {
  return {
    type: 'tool-propose_drill_down',
    toolCallId,
    state: 'input-available',
    input,
  } as unknown as BrunchUIMessagePart;
}

describe('extractStagedIntents', () => {
  it('stages tool-propose_edit when edit-impact has arrived', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEditPart('tc-1', { newContent: 'Hello world' })])],
      buildContext({
        editImpactByToolCallId: new Map<string, EditImpactTier>([['tc-1', 'soft']]),
      }),
    );
    expect(decisions).toHaveLength(1);
    const d = decisions[0]!;
    expect(d.status).toBe('stage');
    if (d.status !== 'stage') return;
    expect(d.intent.kind).toBe('edit');
    expect(d.intent.producerChatId).toBe(42);
    expect(d.intent.anchor).toEqual(PINNED);
    if (d.intent.kind !== 'edit') return;
    expect(d.intent.newContent).toBe('Hello world');
    expect(d.intent.impact).toBe('soft');
    expect(d.intent.summary).toBe('Hello world');
    expect(d.intent.newRationale).toBeUndefined();
  });

  it('preserves newRationale on edit when present', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEditPart('tc-1', { newContent: 'x', newRationale: 'because' })])],
      buildContext({
        editImpactByToolCallId: new Map<string, EditImpactTier>([['tc-1', 'hard']]),
      }),
    );
    const d = decisions[0]!;
    if (d.status !== 'stage' || d.intent.kind !== 'edit') throw new Error('unreachable');
    expect(d.intent.newRationale).toBe('because');
  });

  it('truncates long edit summary at 60 chars with ellipsis', () => {
    const long = 'a'.repeat(80);
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEditPart('tc-1', { newContent: long })])],
      buildContext({
        editImpactByToolCallId: new Map<string, EditImpactTier>([['tc-1', 'none']]),
      }),
    );
    const d = decisions[0]!;
    if (d.status !== 'stage' || d.intent.kind !== 'edit') throw new Error('unreachable');
    expect(d.intent.summary).toBe(`${'a'.repeat(57)}…`);
  });

  it('defers tool-propose_edit when edit-impact has not arrived yet', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEditPart('tc-1', { newContent: 'Hello' })])],
      buildContext(),
    );
    expect(decisions).toEqual([{ toolCallId: 'tc-1', status: 'defer', reason: 'awaiting-edit-impact' }]);
  });

  it('stages tool-propose_edge when target resolves to a different anchor', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEdgePart('tc-2', { targetReferenceCode: 'G10', relation: 'depends_on' })])],
      buildContext({
        resolveTargetAnchor: (refCode) => (refCode === 'G10' ? OTHER : undefined),
      }),
    );
    expect(decisions).toHaveLength(1);
    const d = decisions[0]!;
    expect(d.status).toBe('stage');
    if (d.status !== 'stage' || d.intent.kind !== 'edge') throw new Error('unreachable');
    expect(d.intent.targetAnchor).toEqual(OTHER);
    expect(d.intent.relation).toBe('depends_on');
    expect(d.intent.summary).toBe('Edge: G10 (depends_on)');
  });

  it('skips tool-propose_edge with unresolved targetReferenceCode', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEdgePart('tc-2', { targetReferenceCode: 'ZZZ', relation: 'derived_from' })])],
      buildContext({ resolveTargetAnchor: () => undefined }),
    );
    expect(decisions).toEqual([{ toolCallId: 'tc-2', status: 'skip', reason: 'unresolved-target-refcode' }]);
  });

  it('skips tool-propose_edge whose target is the pinned anchor itself', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEdgePart('tc-2', { targetReferenceCode: 'C5', relation: 'constrains' })])],
      buildContext({
        resolveTargetAnchor: (refCode) => (refCode === 'C5' ? PINNED : undefined),
      }),
    );
    expect(decisions).toEqual([{ toolCallId: 'tc-2', status: 'skip', reason: 'self-referential-edge' }]);
  });

  it('stages tool-propose_drill_down with focusArea', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeDrillDownPart('tc-3', { focusArea: 'edge cases' })])],
      buildContext(),
    );
    expect(decisions).toHaveLength(1);
    const d = decisions[0]!;
    expect(d.status).toBe('stage');
    if (d.status !== 'stage' || d.intent.kind !== 'drill-down') throw new Error('unreachable');
    expect(d.intent.focusArea).toBe('edge cases');
    expect(d.intent.summary).toBe('Drill-down: edge cases');
    expect(d.intent.anchor).toEqual(PINNED);
  });

  it('emits no decisions for tool parts in earlier states (input-streaming)', () => {
    const decisions = extractStagedIntents(
      [assistantMessage([proposeEditPart('tc-1', { newContent: 'x' }, 'input-streaming')])],
      buildContext({
        editImpactByToolCallId: new Map<string, EditImpactTier>([['tc-1', 'soft']]),
      }),
    );
    expect(decisions).toEqual([]);
  });

  it('skips user messages and non-tool parts entirely', () => {
    const userMessage: BrunchUIMessage = {
      id: 'u1',
      role: 'user',
      parts: [proposeEditPart('tc-1', { newContent: 'x' })],
    };
    const assistantText = assistantMessage([{ type: 'text', text: 'hello' } as BrunchUIMessagePart]);
    const decisions = extractStagedIntents([userMessage, assistantText], buildContext());
    expect(decisions).toEqual([]);
  });

  it('is pure: invoking twice with identical inputs returns deep-equal decisions', () => {
    const ctx = buildContext({
      editImpactByToolCallId: new Map<string, EditImpactTier>([['tc-1', 'soft']]),
      resolveTargetAnchor: (refCode) => (refCode === 'G10' ? OTHER : undefined),
    });
    const messages: BrunchUIMessage[] = [
      assistantMessage([
        proposeEditPart('tc-1', { newContent: 'a' }),
        proposeEdgePart('tc-2', { targetReferenceCode: 'G10', relation: 'verifies' }),
        proposeDrillDownPart('tc-3', { focusArea: 'b' }),
      ]),
    ];
    const first = extractStagedIntents(messages, ctx);
    const second = extractStagedIntents(messages, ctx);
    expect(second).toEqual(first);
  });
});
