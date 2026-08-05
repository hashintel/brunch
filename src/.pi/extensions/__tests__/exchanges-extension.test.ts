import { describe, expect, it } from 'vitest';

import {
  ASK_TOOL,
  PRESENT_CANDIDATES_TOOL,
  PRESENT_DIGEST_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  registerStructuredExchange,
} from '../exchanges/index.js';
import { assertProviderLegalToolSchema, hasToolParametersProvenance } from '../shared/tool-schema.js';

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

  it('exposes WR5 continuation conduct guidance through registered tool definitions', () => {
    const tools = registerTools();
    const ask = tools.get(ASK_TOOL);
    const digest = tools.get(PRESENT_DIGEST_TOOL);
    const guidance = [ask, digest]
      .map((tool) => `${tool.description}\n${tool.promptGuidelines.join('\n')}`)
      .join('\n');

    expect(guidance).toContain('Never author a listed option that duplicates the built-in Other affordance');
    expect(guidance).toContain("Do not restate a present_* offer's large pretext or digest body");
    expect(guidance).toContain('Collect conversational free-text corrections or clarifications');
    expect(guidance).toContain('A continued ask does not accept the digest for capture');
    expect(guidance).toContain('acceptsDigest');
    expect(guidance).not.toContain('approve / request changes / reject');
    expect(guidance).not.toContain('accepted terminal echoes the abstract');
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

  it('keeps every exchange schema adapter-derived and provider-legal, with the ask questionnaire fields', () => {
    const schemas = Object.fromEntries([...registerTools()].map(([name, tool]) => [name, tool.parameters]));

    for (const [name, parameters] of Object.entries(schemas)) {
      expect(hasToolParametersProvenance(parameters), `${name} adapter provenance`).toBe(true);
      expect(() => assertProviderLegalToolSchema(parameters), name).not.toThrow();
    }

    expect(JSON.stringify(schemas[PRESENT_REVIEW_SET_TOOL])).toContain('settlement');
    expect(JSON.stringify(schemas[PRESENT_REVIEW_SET_TOOL])).toContain('advisory');
    expect(JSON.stringify(schemas[PRESENT_REVIEW_SET_TOOL])).toContain('settled');
    expect(schemas.ask).toMatchObject({
      properties: {
        acceptsDigest: { type: 'string' },
        questions: { type: 'array', minItems: 1 },
      },
    });
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

  it('keeps validation feedback model-visible while ask rejection stays out of the transcript', async () => {
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

    expect(askResult.details).toMatchObject({ status: 'validation_failed', tool: ASK_TOOL });
    expect(askResult.content[0]?.text).toContain(
      `The ${ASK_TOOL} tool could not use the supplied arguments.`,
    );
    expect(ask.renderResult(askResult, {}, theme, {}).render(80)).toEqual([]);

    expect(candidatesResult.details).toMatchObject({
      status: 'validation_failed',
      tool: PRESENT_CANDIDATES_TOOL,
    });
    const rendered = stripAnsi(
      candidates.renderResult(candidatesResult, {}, theme, {}).render(80).join('\n'),
    );
    expect(rendered).toContain('TOOL_INPUT_INVALID');
    expect(rendered).not.toContain('do-not-leak');
    expect(rendered).not.toContain('"raw"');
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
