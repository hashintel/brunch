import { describe, expect, it } from 'vitest';

import {
  ASK_TOOL,
  PRESENT_CANDIDATES_TOOL,
  PRESENT_DIGEST_TOOL,
  PRESENT_REVIEW_SET_TOOL,
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

describe('structured exchange tool guidance', () => {
  it('teaches one-shot ask and declared offer continuations', () => {
    const tools = registerTools();
    const ask = tools.get(ASK_TOOL);
    const candidates = tools.get(PRESENT_CANDIDATES_TOOL);
    const review = tools.get(PRESENT_REVIEW_SET_TOOL);

    expect(`${ask.description}\n${ask.promptGuidelines.join('\n')}`).toContain(
      'Omit options for free text; include options for single-select; set multiple for multi-select.',
    );
    expect(`${ask.description}\n${ask.promptGuidelines.join('\n')}`).toContain(
      'Use ask for ordinary Brunch questions; do not call present_question.',
    );
    expect(`${ask.description}\n${ask.promptGuidelines.join('\n')}`).toContain(
      'Use options[] for finite choices instead of numbered body text.',
    );
    expect(`${candidates.description}\n${candidates.promptGuidelines.join('\n')}`).toContain(
      'recognition-only',
    );
    expect(`${candidates.description}\n${candidates.promptGuidelines.join('\n')}`).toContain(
      'Choosing a candidate records fan-in intent; it does not commit graph truth',
    );
    expect(`${review.description}\n${review.promptGuidelines.join('\n')}`).toContain(
      'Do not call request_review',
    );
    expect(`${ask.description}\n${ask.promptGuidelines.join('\n')}`).toContain('continues');
  });
});

describe('structured exchange renderers', () => {
  it('keeps renderCall empty for every registered exchange tool', () => {
    const tools = registerTools();
    expect([...tools.keys()]).toEqual([
      ASK_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      PRESENT_DIGEST_TOOL,
    ]);

    for (const [name, tool] of tools) {
      expect(stripAnsi(tool.renderCall({}, theme, {}).render(80).join('\n')), name).toBe('');
    }
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

  it('renders exchange tool validation failures as human-readable markdown without raw payloads', async () => {
    const tools = registerTools();
    const ask = tools.get(ASK_TOOL);
    const candidates = tools.get(PRESENT_CANDIDATES_TOOL);

    const askResult = await ask.execute(
      'bad-ask-call',
      { exchangeId: 'bad-ask', body: { raw: 'do-not-leak' } },
      undefined,
      undefined,
      { hasUI: false } as never,
    );
    const candidatesResult = await candidates.execute(
      'bad-candidates-call',
      { exchangeId: 'bad-candidates', heading: { raw: 'do-not-leak' }, candidates: [] },
      undefined,
      undefined,
      {} as never,
    );

    for (const [toolName, tool, result] of [
      [ASK_TOOL, ask, askResult],
      [PRESENT_CANDIDATES_TOOL, candidates, candidatesResult],
    ] as const) {
      expect(result.details).toMatchObject({ status: 'validation_failed', tool: toolName });
      const rendered = stripAnsi(tool.renderResult(result, {}, theme, {}).render(80).join('\n'));
      expect(rendered).toContain('TOOL_INPUT_INVALID');
      expect(rendered).toContain(`The ${toolName} tool could not use the supplied arguments.`);
      expect(rendered).not.toContain('do-not-leak');
      expect(rendered).not.toContain('"raw"');
    }
  });

  it('renders ask as the Markdown pass-through of its content string', async () => {
    // D104-L revision 2026-07-02: the formatter's content markdown is the designed
    // surface for both audiences; renderResult displays that same string.
    const ask = registerTools().get(ASK_TOOL);

    const result = await ask.execute(
      'call-1',
      { exchangeId: 'x-1', body: 'Body text' },
      undefined,
      undefined,
      {
        hasUI: false,
      } as never,
    );

    const rendered = stripAnsi(ask.renderResult(result, {}, theme, {}).render(80).join('\n'));
    expect(rendered).toContain('Body text');
    expect(rendered).toContain('ask requires interactive UI');
  });
});
