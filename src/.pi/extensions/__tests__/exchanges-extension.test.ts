import { describe, expect, it } from 'vitest';

import {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_QUESTION_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange,
} from '../exchanges/index.js';

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ansiPattern, '');
}

function registerTools() {
  const tools = new Map<string, any>();
  registerStructuredExchange({
    registerTool(definition: any) {
      tools.set(definition.name, definition);
    },
  } as any);
  return tools;
}

const theme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe('structured exchange renderers', () => {
  it('keeps renderCall non-semantic for present/request tools', () => {
    const tools = registerTools();
    const present = tools.get(PRESENT_QUESTION_TOOL);
    const candidates = tools.get(PRESENT_CANDIDATES_TOOL);
    const request_response = tools.get(REQUEST_RESPONSE_TOOL);

    expect(stripAnsi(present.renderCall({}, theme, {}).render(80).join('\n'))).toBe('');
    expect(stripAnsi(candidates.renderCall({}, theme, {}).render(80).join('\n'))).toBe('');
    expect(stripAnsi(request_response.renderCall({}, theme, {}).render(80).join('\n'))).toBe('');
  });

  it('renders present_candidates from tool result markdown content', async () => {
    const present = registerTools().get(PRESENT_CANDIDATES_TOOL);

    const result = await present.execute(
      'call-candidates-1',
      {
        exchangeId: 'candidate-direction',
        heading: 'Choose direction',
        candidates: [
          {
            id: 'local',
            title: 'Local workbench',
            user_rubric: {
              core_bet: 'Local-first graph work.',
              best_fit: 'Current POC.',
              cost_complexity: 'Own local state.',
              covers_well: 'Graph and transcript.',
              main_risks: 'No cloud proof.',
              lock_in_constraints: 'Local semantics.',
            },
            meta_rubric: {},
            graph_refs: [{ node_id: 'node-1' }],
          },
        ],
      },
      undefined,
      undefined,
      {} as never,
    );

    const rendered = stripAnsi(present.renderResult(result, {}, theme, {}).render(80).join('\n'));
    expect(rendered).toContain('Choose direction');
    expect(rendered).toContain('Local workbench');
    expect(rendered).toContain('Local-first graph work.');
  });

  it('renders present_question from tool result markdown content', async () => {
    const present = registerTools().get(PRESENT_QUESTION_TOOL);

    const result = await present.execute(
      'call-1',
      {
        exchangeId: 'x-1',
        heading: 'Choose',
        body: 'Body text',
        options: [{ id: 'a', content: 'Alpha', rationale: 'First' }],
      },
      undefined,
      undefined,
      {} as never,
    );

    const rendered = stripAnsi(present.renderResult(result, {}, theme, {}).render(80).join('\n'));
    expect(rendered).toContain('Choose');
    expect(rendered).toContain('Alpha');
    expect(rendered).toContain('First');
  });
});
