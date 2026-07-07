import { describe, expect, it } from 'vitest';

import {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_DIGEST_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
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

describe('structured exchange tool guidance', () => {
  it('teaches present-side response selection and the single request_response terminal', () => {
    const tools = registerTools();
    const present = tools.get(PRESENT_QUESTION_TOOL);
    const candidates = tools.get(PRESENT_CANDIDATES_TOOL);
    const review = tools.get(PRESENT_REVIEW_SET_TOOL);
    const request = tools.get(REQUEST_RESPONSE_TOOL);

    expect(`${present.description}\n${present.promptGuidelines.join('\n')}`).toContain(
      'Omit options for a free-text answer; include options for a finite choice; set multiple only when the user may pick more than one option.',
    );
    expect(`${present.description}\n${present.promptGuidelines.join('\n')}`).toContain(
      'Do not put numbered candidate answers in body markdown when options[] should carry them.',
    );
    expect(`${present.description}\n${present.promptGuidelines.join('\n')}`).toContain(
      'Use multiple: true when the options are not mutually exclusive; use single-select only when exactly one answer is wanted.',
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
    expect(`${request.description}\n${request.promptGuidelines.join('\n')}`).not.toMatch(
      /request_answer|request_choice|request_choices|request_review/,
    );
  });
});

describe('structured exchange renderers', () => {
  it('keeps renderCall empty for every registered exchange tool', () => {
    const tools = registerTools();
    expect([...tools.keys()]).toEqual([
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      PRESENT_DIGEST_TOOL,
      REQUEST_RESPONSE_TOOL,
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

  it('renders present_question as the Markdown pass-through of its content string', async () => {
    // D104-L revision 2026-07-02: the formatter's content markdown is the designed
    // surface for both audiences; renderResult displays that same string.
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
    expect(rendered).toContain('Question: Choose');
    expect(rendered).toContain('Alpha');
    expect(rendered).toContain('First');
  });
});
