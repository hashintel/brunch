import { describe, expect, it } from 'vitest';

import type { CommandExecutor } from '../command-executor.js';
import type { CommitGraphInput, CommitGraphResult } from '../command-executor/commit-graph-types.js';
import { captureStructuredResponseFacts } from './structured-response.js';

class RecordingExecutor {
  readonly calls: CommitGraphInput[] = [];

  constructor(private readonly result: CommitGraphResult) {}

  commitGraph(input: CommitGraphInput): CommitGraphResult {
    this.calls.push(input);
    return this.result;
  }
}

describe('captureStructuredResponseFacts', () => {
  it('commits labeled text facts as explicit intent nodes tied to the exchange response', () => {
    const executor = new RecordingExecutor({
      status: 'success',
      lsn: 7,
      createdNodes: {
        goal: { id: 11, code: 'G1' },
        context: { id: 12, code: 'CTX1' },
        constraint: { id: 13, code: 'CON1' },
        criterion: { id: 14, code: 'CR1' },
      },
      edges: [],
    });

    const outcome = captureStructuredResponseFacts({
      specId: 42,
      exchangeId: 'grounding-text-2',
      answer: {
        text: [
          'Goal: Help local teams coordinate product specifications.',
          'Context: Designers will review the graph in a web UI.',
          'Constraint: Keep graph writes synchronous for the POC.',
          'Criterion: Observers can see the selected spec update.',
        ].join('\n'),
      },
      commandExecutor: executor as unknown as CommandExecutor,
    });

    expect(outcome).toEqual({
      status: 'captured',
      lsn: 7,
      nodeCount: 4,
      createdNodes: {
        goal: { id: 11, code: 'G1' },
        context: { id: 12, code: 'CTX1' },
        constraint: { id: 13, code: 'CON1' },
        criterion: { id: 14, code: 'CR1' },
      },
    });
    expect(executor.calls).toEqual([
      {
        specId: 42,
        basis: 'explicit',
        nodes: [
          {
            ref: 'goal',
            plane: 'intent',
            kind: 'goal',
            title: 'Help local teams coordinate product specifications.',
            source: 'structured_exchange_response:grounding-text-2',
          },
          {
            ref: 'context',
            plane: 'intent',
            kind: 'context',
            title: 'Designers will review the graph in a web UI.',
            source: 'structured_exchange_response:grounding-text-2',
          },
          {
            ref: 'constraint',
            plane: 'intent',
            kind: 'constraint',
            title: 'Keep graph writes synchronous for the POC.',
            source: 'structured_exchange_response:grounding-text-2',
          },
          {
            ref: 'criterion',
            plane: 'intent',
            kind: 'criterion',
            title: 'Observers can see the selected spec update.',
            source: 'structured_exchange_response:grounding-text-2',
          },
        ],
        edges: [],
      },
    ]);
  });

  it('keeps every labeled line of the same kind with distinct refs', () => {
    const executor = new RecordingExecutor({
      status: 'success',
      lsn: 3,
      createdNodes: {
        goal: { id: 21, code: 'G1' },
        'goal-2': { id: 22, code: 'G2' },
      },
      edges: [],
    });

    const outcome = captureStructuredResponseFacts({
      specId: 42,
      exchangeId: 'grounding-text-3',
      answer: {
        text: ['Goal: Coordinate specs across teams.', 'Goal: Keep the graph legible to designers.'].join(
          '\n',
        ),
      },
      commandExecutor: executor as unknown as CommandExecutor,
    });

    expect(outcome).toEqual({
      status: 'captured',
      lsn: 3,
      nodeCount: 2,
      createdNodes: {
        goal: { id: 21, code: 'G1' },
        'goal-2': { id: 22, code: 'G2' },
      },
    });
    expect(executor.calls[0]!.nodes).toEqual([
      {
        ref: 'goal',
        plane: 'intent',
        kind: 'goal',
        title: 'Coordinate specs across teams.',
        source: 'structured_exchange_response:grounding-text-3',
      },
      {
        ref: 'goal-2',
        plane: 'intent',
        kind: 'goal',
        title: 'Keep the graph legible to designers.',
        source: 'structured_exchange_response:grounding-text-3',
      },
    ]);
  });

  it('returns no_capture for ambiguous or implication-only prose without invoking CommandExecutor', () => {
    const executor = new RecordingExecutor({ status: 'success', lsn: 1, createdNodes: {}, edges: [] });

    const outcome = captureStructuredResponseFacts({
      specId: 42,
      exchangeId: 'grounding-text-2',
      answer: { text: 'We probably need something that helps people decide what matters later.' },
      commandExecutor: executor as unknown as CommandExecutor,
    });

    expect(outcome).toEqual({
      status: 'no_capture',
      reason: 'No directly labeled high-confidence graph facts found.',
    });
    expect(executor.calls).toEqual([]);
  });

  it('passes structural_illegal diagnostics from CommandExecutor through unchanged', () => {
    const diagnostic = { field: 'nodes[0].kind', message: 'kind is not valid for plane' };
    const executor = new RecordingExecutor({ status: 'structural_illegal', diagnostics: [diagnostic] });

    const outcome = captureStructuredResponseFacts({
      specId: 42,
      exchangeId: 'grounding-text-2',
      answer: { text: 'Goal: Name the invalid fact.' },
      commandExecutor: executor as unknown as CommandExecutor,
    });

    expect(outcome).toEqual({ status: 'structural_illegal', diagnostics: [diagnostic] });
  });

  it('does not capture non-text structured exchange answers', () => {
    const executor = new RecordingExecutor({ status: 'success', lsn: 1, createdNodes: {}, edges: [] });

    const outcome = captureStructuredResponseFacts({
      specId: 42,
      exchangeId: 'grounding-choice-1',
      answer: { optionId: 'new-from-scratch' },
      commandExecutor: executor as unknown as CommandExecutor,
    });

    expect(outcome.status).toBe('no_capture');
    expect(executor.calls).toEqual([]);
  });
});
