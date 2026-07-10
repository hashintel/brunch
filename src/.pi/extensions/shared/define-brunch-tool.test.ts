import { Type } from 'typebox';
import { describe, expect, it } from 'vitest';

import { defineBrunchTool, hasBrunchDefaultRenderer } from './define-brunch-tool.js';

const theme = {
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => `<bold>${text}</bold>`,
};

function render(component: { render(width: number): string[] }): string {
  return component.render(80).join('\n');
}

function renderContext(state: object, isError = false) {
  return {
    args: { value: 'hello' },
    toolCallId: 'call-1',
    invalidate() {},
    lastComponent: undefined,
    state,
    cwd: '/tmp',
    executionStarted: true,
    argsComplete: true,
    isPartial: !isError,
    expanded: false,
    showImages: false,
    isError,
  };
}

function createTool(label = 'Example tool') {
  return defineBrunchTool({
    name: 'example_tool',
    label,
    description: 'Exercises the shared Brunch renderer.',
    parameters: Type.Object({ value: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text' as const, text: params.value.toUpperCase() }],
        details: { length: params.value.length },
      };
    },
  });
}

describe('defineBrunchTool', () => {
  it('renders one padded muted line and updates its dot through partial, success, and error results', () => {
    const tool = createTool();
    const state = {};
    const call = tool.renderCall!({ value: 'hello' }, theme as never, renderContext(state) as never);

    expect(tool.renderShell).toBe('self');
    expect(hasBrunchDefaultRenderer(tool)).toBe(true);
    expect(hasBrunchDefaultRenderer({ renderShell: 'self' })).toBe(false);
    expect(render(call).trimEnd()).toBe(
      ' <accent><bold>◉</bold></accent><muted> Brunch: Example tool</muted>',
    );

    const partialSlot = tool.renderResult!(
      { content: [{ type: 'text', text: 'still running' }], details: { length: 0 } },
      { expanded: true, isPartial: true },
      theme as never,
      renderContext(state) as never,
    );
    expect(render(call)).toContain('<accent><bold>◉</bold></accent>');
    expect(render(partialSlot)).toBe('');

    const successSlot = tool.renderResult!(
      { content: [{ type: 'text', text: 'secret result' }], details: { length: 6 } },
      { expanded: true, isPartial: false },
      theme as never,
      renderContext(state) as never,
    );
    expect(render(call).trimEnd()).toBe(
      ' <success><bold>◉</bold></success><muted> Brunch: Example tool</muted>',
    );
    expect(render(successSlot)).toBe('');
    expect(render(call)).not.toContain('secret result');

    tool.renderResult!(
      { content: [{ type: 'text', text: 'failure details' }], details: { length: 0 } },
      { expanded: true, isPartial: false },
      theme as never,
      renderContext(state, true) as never,
    );
    expect(render(call).trimEnd()).toBe(' <error><bold>◉</bold></error><muted> Brunch: Example tool</muted>');
    expect(render(call)).not.toContain('failure details');
  });

  it('falls back to the tool name when the label is empty', () => {
    const tool = createTool('');
    const call = tool.renderCall!({ value: 'hello' }, theme as never, renderContext({}) as never);

    expect(render(call)).toContain('Brunch: example_tool');
  });

  it('preserves parameter and result-detail inference from Pi defineTool', async () => {
    const result = await createTool().execute(
      'call-1',
      { value: 'hello' },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content).toEqual([{ type: 'text', text: 'HELLO' }]);
    expect(result.details.length).toBe(5);
  });
});
