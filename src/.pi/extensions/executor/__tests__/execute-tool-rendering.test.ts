import { describe, expect, it } from 'vitest';

import { createExecutePlanCheckTool } from '../execute-plan-check/index.js';
import { createExecuteSnapshotTool } from '../execute-snapshot/index.js';
import { createExecuteStatusTool } from '../execute-status/index.js';

const theme = {
  fg: (_kind: string, value: string) => value,
  bg: (_kind: string, value: string) => value,
  bold: (value: string) => value,
};

interface Renderable {
  render(width: number): string[];
}

interface RenderTool {
  readonly name: string;
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
  if (!tool.renderResult) throw new Error(`${tool.name} is missing renderResult`);
  return render(tool.renderResult(result as never, options, theme as never, {} as never));
}

describe('standalone execute tool rendering', () => {
  it('renders execute_snapshot as a short status-first summary when collapsed', () => {
    const tool = createExecuteSnapshotTool({
      specId: 42,
      reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) },
    }) as unknown as RenderTool;
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          snapshot: {
            specId: 42,
            mode: 'greenfield',
            requirements: Array.from({ length: 7 }, () => ({ id: 'r' })),
            criteria: [],
          },
          source: { graphLsn: 128, visibility: 'active' },
          sideEffects: [],
        },
      },
      { expanded: false, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'ready · spec 42',
        'mode greenfield · graph 128',
        'requirements 7 · criteria 0',
        'no side effects · [+] expand · Ctrl+O',
      ].join('\n'),
    );
  });

  it('renders execute_plan_check as a short status-first summary when collapsed', () => {
    const tool = createExecutePlanCheckTool({
      specId: 42,
      reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) },
    }) as unknown as RenderTool;
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          check: {
            status: 'blocked',
            counts: { requirements: 2, criteria: 0, verifiedRequirements: 0 },
            findings: [
              { severity: 'error', message: 'Requirement R2 has no verification criteria' },
              { severity: 'error', message: 'Slice t3 depends on unknown slice t9' },
            ],
          },
          source: { graphLsn: 128, visibility: 'active' },
          sideEffects: [],
        },
      },
      { expanded: false, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'blocked · 2 findings',
        'graph 128 · active view',
        'requirements 2 · criteria 0 · verified 0',
        'top issue Requirement R2 has no verification criteria · [+] expand · Ctrl+O',
      ].join('\n'),
    );
  });

  it('renders execute_status as a short status-first summary when collapsed', () => {
    const tool = createExecuteStatusTool() as unknown as RenderTool;
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          discipline: 'strict',
          availableDisciplines: ['strict', 'interpretive'],
          portedTools: ['execute_status', 'execute_orchestrate'],
          pendingTools: [],
          sideEffects: [],
        },
      },
      { expanded: false, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'ready · strict',
        'disciplines 2 · ported 2',
        'pending 0',
        'no side effects · [+] expand · Ctrl+O',
      ].join('\n'),
    );
  });

  it('renders execute_plan_check expanded without reusing the orchestrator layout', () => {
    const tool = createExecutePlanCheckTool({
      specId: 42,
      reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) },
    }) as unknown as RenderTool;
    const rendered = renderResult(
      tool,
      {
        content: [{ type: 'text', text: 'fallback' }],
        details: {
          check: {
            status: 'blocked',
            counts: { requirements: 2, criteria: 0, verifiedRequirements: 0 },
            findings: [
              { severity: 'error', message: 'Requirement R2 has no verification criteria' },
              { severity: 'error', message: 'Slice t3 depends on unknown slice t9' },
            ],
          },
          source: { graphLsn: 128, visibility: 'active' },
          sideEffects: [],
        },
      },
      { expanded: true, isPartial: false },
    );

    expect(rendered).toBe(
      [
        'blocked · 2 findings',
        '[-] collapse · Ctrl+O',
        '',
        'Status',
        'check status: blocked',
        'graph lsn: 128',
        'view: active',
        'requirements: 2',
        'criteria: 0',
        'verified requirements: 0',
        '',
        'Findings',
        '- Requirement R2 has no verification criteria',
        '- Slice t3 depends on unknown slice t9',
        '',
        'Side Effects',
        'none',
      ].join('\n'),
    );
    expect(rendered).not.toContain('Run Status');
    expect(rendered).not.toContain('Timeline');
  });
});
