import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { createProductUpdatePublisher, type ProductUpdate } from '../../../../rpc/product-updates.js';
import { registerBrunchExecuteRunUpdates } from '../execute-run-updates/index.js';

type ToolResultHandler = (event: unknown) => void | Promise<void>;

function captureToolResultHandler(): { pi: ExtensionAPI; fire: ToolResultHandler } {
  let handler: ToolResultHandler | undefined;
  const pi = {
    on(event: string, callback: ToolResultHandler) {
      if (event === 'tool_result') {
        handler = callback;
      }
    },
  } as unknown as ExtensionAPI;
  return {
    pi,
    fire: (event) => {
      if (!handler) throw new Error('tool_result handler not registered');
      return handler(event);
    },
  };
}

function collectingPublisher(): {
  publisher: ReturnType<typeof createProductUpdatePublisher>;
  published: ProductUpdate[];
} {
  const publisher = createProductUpdatePublisher();
  const published: ProductUpdate[] = [];
  publisher.subscribe((updates) => published.push(...updates));
  return { publisher, published };
}

describe('registerBrunchExecuteRunUpdates', () => {
  it('publishes run-scoped updates after a state-advancing execute tool succeeds', async () => {
    const { pi, fire } = captureToolResultHandler();
    const { publisher, published } = collectingPublisher();
    registerBrunchExecuteRunUpdates(pi, { productUpdates: publisher });

    await fire({
      type: 'tool_result',
      toolCallId: 't1',
      toolName: 'execute_worktree_create',
      input: { runId: 'run-1' },
      content: [],
      isError: false,
      details: {
        result: { runId: 'run-1' },
        sideEffects: [{ kind: 'git_worktree_add', path: '/w' }],
      },
    });

    expect(published).toEqual([{ topic: 'execute.runs' }, { topic: 'execute.run', runId: 'run-1' }]);
  });

  it('publishes nothing for errored, side-effect-free, or non-execute tool results', async () => {
    const { pi, fire } = captureToolResultHandler();
    const { publisher, published } = collectingPublisher();
    registerBrunchExecuteRunUpdates(pi, { productUpdates: publisher });

    await fire({
      type: 'tool_result',
      toolCallId: 't1',
      toolName: 'execute_worktree_create',
      input: { runId: 'run-1' },
      content: [],
      isError: true,
      details: { result: { runId: 'run-1' }, sideEffects: [{ kind: 'git_worktree_add' }] },
    });
    await fire({
      type: 'tool_result',
      toolCallId: 't2',
      toolName: 'execute_status',
      input: {},
      content: [],
      isError: false,
      details: { activeTools: [] },
    });
    await fire({
      type: 'tool_result',
      toolCallId: 't3',
      toolName: 'read',
      input: { path: '/x' },
      content: [],
      isError: false,
      details: undefined,
    });

    expect(published).toEqual([]);
  });

  it('publishes for an orchestrate drive over an existing run, including halted drives', async () => {
    const { pi, fire } = captureToolResultHandler();
    const { publisher, published } = collectingPublisher();
    registerBrunchExecuteRunUpdates(pi, { productUpdates: publisher });

    await fire({
      type: 'tool_result',
      toolCallId: 't1',
      toolName: 'execute_orchestrate',
      input: { runId: 'run-2' },
      content: [],
      isError: false,
      details: { outcome: { status: 'halted', step: 'test_result', runStatus: 'slice_started' } },
    });
    await fire({
      type: 'tool_result',
      toolCallId: 't2',
      toolName: 'execute_orchestrate',
      input: { runId: 'run-x' },
      content: [],
      isError: false,
      details: { outcome: { status: 'missing_run', runId: 'run-x' } },
    });

    expect(published).toEqual([{ topic: 'execute.runs' }, { topic: 'execute.run', runId: 'run-2' }]);
  });

  it('publishes a list-only update when no runId is recoverable from the result', async () => {
    const { pi, fire } = captureToolResultHandler();
    const { publisher, published } = collectingPublisher();
    registerBrunchExecuteRunUpdates(pi, { productUpdates: publisher });

    await fire({
      type: 'tool_result',
      toolCallId: 't1',
      toolName: 'execute_plan_file',
      input: {},
      content: [],
      isError: false,
      details: { result: { status: 'written' }, sideEffects: [{ kind: 'write_file', path: '/p' }] },
    });

    expect(published).toEqual([{ topic: 'execute.runs' }]);
  });
});
