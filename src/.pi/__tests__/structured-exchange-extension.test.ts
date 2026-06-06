import { describe, expect, it } from 'vitest';

import registerStructuredExchange, {
  PRESENT_OPTIONS_TOOL,
  REQUEST_CHOICE_TOOL,
} from '../extensions/exchanges/index.js';

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
    const present = tools.get(PRESENT_OPTIONS_TOOL);
    const request = tools.get(REQUEST_CHOICE_TOOL);

    expect(stripAnsi(present.renderCall({}, theme, {}).render(80).join('\n'))).toBe('');
    expect(stripAnsi(request.renderCall({}, theme, {}).render(80).join('\n'))).toBe('');
  });

  it('renders present_options from tool result markdown content', async () => {
    const present = registerTools().get(PRESENT_OPTIONS_TOOL);

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
