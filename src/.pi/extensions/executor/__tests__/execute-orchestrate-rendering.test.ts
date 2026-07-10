import { describe, expect, it } from 'vitest';

import { createExecuteOrchestrateTool } from '../execute-orchestrate/index.js';

const theme = {
  fg: (_kind: string, value: string) => value,
  bg: (_kind: string, value: string) => value,
  bold: (value: string) => value,
};

function fakePorts() {
  return {
    gitWorktree: {} as never,
    agentRunner: {} as never,
    testRunner: {} as never,
    gitLand: {} as never,
    gitHostPromotion: {} as never,
  };
}

interface Renderable {
  render(width: number): string[];
}

interface RenderTool {
  renderResult?: (...args: unknown[]) => Renderable;
}

function render(component: Renderable): string {
  return component
    .render(120)
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n');
}

function renderResult(
  tool: RenderTool,
  result: { content: { type: string; text?: string }[]; details?: unknown },
  options: { expanded: boolean; isPartial: boolean },
): string {
  if (!tool.renderResult) throw new Error('execute_orchestrate tool is missing renderResult');
  return render(tool.renderResult(result as never, options, theme as never, {} as never));
}

describe('execute_orchestrate rendering', () => {
  const tool = createExecuteOrchestrateTool(fakePorts() as never) as unknown as RenderTool;

  it('renders a short status-first collapsed summary for progress updates', () => {
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'raw multiline fallback' }],
        details: {
          progress: {
            runId: 'run-1',
            step: 'test_result',
            phase: 'started',
            fromStatus: 'agent_result_ingested',
            runStatus: 'agent_result_ingested',
            activeEpicId: 'e1',
            activeSliceId: 't1',
            completedSliceIds: [],
          },
        },
      },
      { expanded: false, isPartial: true },
    );

    expect(rendered).toBe(
      [
        'running · slice t1 · verify pending',
        'run run-1   epic e1   slice t1',
        'now test_result   started   done 0',
        'state agent_result_ingested   Ctrl + O to expand',
      ].join('\n'),
    );
  });

  it('renders a short status-first collapsed summary for halted and completed outcomes', () => {
    const halted = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          outcome: {
            status: 'halted',
            step: 'test_result',
            runStatus: 'agent_result_ingested',
            reason: 'failed',
          },
        },
      },
      { expanded: false, isPartial: false },
    );
    const completed = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          outcome: {
            status: 'completed',
            runStatus: 'promotion_prepared',
          },
        },
      },
      { expanded: false, isPartial: false },
    );

    expect(halted).toBe(
      [
        'halted · test_result',
        'run unknown   epic -   slice -',
        'now test_result   halted   done 0',
        'reason failed   Ctrl + O to expand',
      ].join('\n'),
    );
    expect(completed).toBe(
      [
        'completed · promotion_prepared',
        'run unknown   epic -   slice -',
        'now -   completed   done 0',
        'outcome completed   Ctrl + O to expand',
      ].join('\n'),
    );
  });

  it('surfaces recent worker and verify activity in the collapsed summary', () => {
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          progress: {
            runId: 'run-1',
            step: 'test_result',
            phase: 'completed',
            fromStatus: 'agent_result_ingested',
            runStatus: 'test_result_ingested',
            activeEpicId: 'e1',
            activeSliceId: 't1',
            completedSliceIds: ['t0'],
          },
          agentStream: {
            kind: 'message',
            runId: 'run-1',
            epicId: 'e1',
            sliceId: 't1',
            sequence: 2,
            message: 'edited src/types.ts',
          },
          verifyStream: {
            kind: 'stdout',
            runId: 'run-1',
            epicId: 'e1',
            sliceId: 't1',
            sequence: 3,
            message: 'tests passed',
          },
        },
      },
      { expanded: false, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'running · slice t1 · test_result_ingested',
        'run run-1   epic e1   slice t1',
        'now test_result   completed   done 1',
        'activity 2 events · latest verify output · tests passed   Ctrl + O to expand',
      ].join('\n'),
    );
  });

  it('renders worker tool calls as readable updates instead of raw event numbers', () => {
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          progress: {
            runId: 'run-1',
            step: 'agent_result',
            phase: 'started',
            fromStatus: 'slice_execution_requested',
            runStatus: 'slice_execution_requested',
            activeEpicId: 'frontier-1',
            activeSliceId: 'task-1',
            completedSliceIds: [],
          },
          agentStream: {
            kind: 'tool',
            runId: 'run-1',
            epicId: 'frontier-1',
            sliceId: 'task-1',
            sequence: 56,
            message: 'tool write_worktree_file completed',
          },
        },
      },
      { expanded: true, isPartial: true },
    );

    expect(rendered).toContain('recent updates: 1');
    expect(rendered).toContain('→ worker tool call #56');
    expect(rendered).toContain('  run run-1 · epic frontier-1 · slice task-1');
    expect(rendered).toContain('  write_worktree_file completed');
    expect(rendered).not.toContain('event 56');
    expect(rendered).not.toContain('tool write_worktree_file completed');
  });

  it('renders exact expanded sections and ordering from structured details', () => {
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          progress: {
            runId: 'run-1',
            step: 'test_result',
            phase: 'completed',
            fromStatus: 'agent_result_ingested',
            runStatus: 'test_result_ingested',
            activeEpicId: 'e1',
            activeSliceId: 't1',
            completedSliceIds: ['t0'],
          },
          agentStream: {
            kind: 'message',
            runId: 'run-1',
            epicId: 'e1',
            sliceId: 't1',
            sequence: 2,
            message: 'edited src/types.ts',
          },
          verifyStream: {
            kind: 'stdout',
            runId: 'run-1',
            epicId: 'e1',
            sliceId: 't1',
            sequence: 3,
            message: 'tests passed',
          },
          outcome: {
            status: 'completed',
            runStatus: 'promotion_prepared',
          },
        },
      },
      { expanded: true, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'completed · promotion_prepared',
        'Ctrl + O to collapse',
        '',
        '--- Run Status ---',
        'run id: run-1',
        'active epic: e1',
        'active slice: t1',
        'current state: test_result_ingested',
        'current step: test_result',
        'phase: completed',
        'slices completed: 1',
        '',
        '--- Timeline ---',
        '[✓] test_result -> test_result_ingested',
        'phase change: completed from agent_result_ingested',
        'next target: promotion_prepared',
        '',
        '--- Subtool Activity ---',
        'recent updates: 2',
        '→ worker update #2',
        '  run run-1 · epic e1 · slice t1',
        '  edited src/types.ts',
        '→ verify output #3',
        '  run run-1 · epic e1 · slice t1',
        '  tests passed',
        '',
        '--- Outcome ---',
        'outcome: completed',
        'final state: promotion_prepared',
      ].join('\n'),
    );
  });
});
