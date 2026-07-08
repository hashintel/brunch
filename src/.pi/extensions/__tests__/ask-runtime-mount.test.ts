import { type KeybindingsManager, type Theme } from '@earendil-works/pi-coding-agent';
import { type Component, TUI } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { zAskDetails } from '../../../exchanges/schemas/index.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { createAskTool } from '../exchanges/ask.js';
import type { StructuredExchangeUiContext } from '../exchanges/shared/ui-context.js';

type ToolTextContent = { readonly type: 'text'; readonly text: string };
type AskToolResult = {
  readonly content: readonly ToolTextContent[];
  readonly details: unknown;
  readonly terminate?: true;
};

type AskTool = ReturnType<typeof createAskTool> & {
  readonly execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<AskToolResult>;
};

type MountedCustomScript = (terminal: VirtualTerminal) => Promise<void> | void;
type CustomUi = NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>;
type CustomMock = CustomUi & ReturnType<typeof vi.fn>;

const theme = createTestLabTheme() as Theme;

async function executeAsk(params: Record<string, unknown>, ctx: StructuredExchangeUiContext) {
  const tool = createAskTool() as AskTool;
  return tool.execute('ask-runtime-mount-call', params, undefined, undefined, ctx);
}

function mountedCustom(options: {
  readonly assertViewport: (viewport: string) => void;
  readonly script: MountedCustomScript;
}): CustomMock {
  return vi.fn(
    async <T>(
      factory: (
        tui: TUI,
        theme: Theme,
        keybindings: KeybindingsManager,
        done: (result?: T) => void,
      ) => Component,
      _options?: unknown,
    ): Promise<T | undefined> => {
      const terminal = new VirtualTerminal(90, 28);
      const tui = new TUI(terminal);
      const result = new Promise<T | undefined>((resolve) => {
        const component = factory(tui, theme, undefined as unknown as KeybindingsManager, resolve);
        tui.addChild(component);
        tui.setFocus(component);
      });

      terminal.clearScreen();
      tui.start();
      try {
        await terminal.waitForRender();
        options.assertViewport(terminal.getViewport().join('\n'));
        await options.script(terminal);
        return await result;
      } finally {
        terminal.stop();
        tui.stop();
      }
    },
  ) as unknown as CustomMock;
}

function expectBracketedWorkingIndicator(setWorkingVisible: ReturnType<typeof vi.fn>) {
  expect(setWorkingVisible.mock.calls.map(([visible]) => visible)).toEqual([false, true]);
}

describe('ask runtime mount contract', () => {
  it('mounts free-text ask in a real TUI, resolves schema-valid details, and collects a comment rung', async () => {
    const custom = mountedCustom({
      assertViewport: (viewport) => {
        expect(viewport).toContain('What should Brunch remember?');
      },
      script: async (terminal) => {
        terminal.sendInput('Use the real mounted editor.');
        await terminal.waitForRender();
        expect(terminal.getViewport().join('\n')).toContain('Use the real mounted editor.');
        terminal.sendInput('\r');
      },
    });
    const input = vi.fn(async () => 'Keep the comment too.');
    const setWorkingVisible = vi.fn();

    const result = await executeAsk(
      {
        exchangeId: 'runtime-free-text',
        body: 'What should Brunch remember?',
        commentPrompt: 'Any note?',
      },
      { hasUI: true, ui: { custom, input, setWorkingVisible } },
    );

    const details = zAskDetails.parse(result.details);
    expect(details).toMatchObject({
      exchange_id: 'runtime-free-text',
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      answered: { text: 'Use the real mounted editor.', comment: 'Keep the comment too.' },
    });
    expect(result.content[0]?.text).toContain('Keep the comment too.');
    expect(input).toHaveBeenCalledExactlyOnceWith('Any note?');
    expect(custom).toHaveBeenCalledOnce();
    expectBracketedWorkingIndicator(setWorkingVisible);
  });

  it('mounts single-select ask in a real TUI and resolves the selected option echo', async () => {
    const setWorkingVisible = vi.fn();
    const custom = mountedCustom({
      assertViewport: (viewport) => {
        expect(viewport).toContain('Choose the route');
        expect(viewport).toContain('Fast path');
        expect(viewport).toContain('Safe path');
      },
      script: (terminal) => {
        terminal.sendInput('\x1b[B');
        terminal.sendInput('\r');
      },
    });

    const result = await executeAsk(
      {
        exchangeId: 'runtime-single-choice',
        body: 'Choose the route',
        options: [
          { id: 'fast', label: 'Fast path' },
          { id: 'safe', label: 'Safe path' },
        ],
      },
      { hasUI: true, ui: { custom, setWorkingVisible } },
    );

    const details = zAskDetails.parse(result.details);
    expect(details).toMatchObject({
      exchange_id: 'runtime-single-choice',
      tool_meta: { curr: 'ask', next: 'capture_choice' },
      answered: {
        choice: { id: 'safe', label: 'Safe path', kind: 'listed' },
        options: [
          { id: 'fast', content: 'Fast path' },
          { id: 'safe', content: 'Safe path' },
        ],
      },
    });
    expect(result.content[0]?.text).toContain('Safe path');
    expect(custom).toHaveBeenCalledOnce();
    expectBracketedWorkingIndicator(setWorkingVisible);
  });

  it('mounts multi-select ask in a real TUI and preserves None exclusivity', async () => {
    const setWorkingVisible = vi.fn();
    const input = vi.fn(async () => 'No listed option applies.');
    const custom = mountedCustom({
      assertViewport: (viewport) => {
        expect(viewport).toContain('Select applicable routes');
        expect(viewport).toContain('Fast path');
        expect(viewport).toContain('Safe path');
        expect(viewport).toContain('None');
      },
      script: (terminal) => {
        terminal.sendInput(' ');
        terminal.sendInput('\x1b[B');
        terminal.sendInput('\x1b[B');
        terminal.sendInput(' ');
        terminal.sendInput('\r');
      },
    });

    const result = await executeAsk(
      {
        exchangeId: 'runtime-multi-choice',
        body: 'Select applicable routes',
        options: [
          { id: 'fast', label: 'Fast path' },
          { id: 'safe', label: 'Safe path' },
        ],
        multiple: true,
        allowNone: true,
      },
      { hasUI: true, ui: { custom, input, setWorkingVisible } },
    );

    const details = zAskDetails.parse(result.details);
    expect(details).toMatchObject({
      exchange_id: 'runtime-multi-choice',
      tool_meta: { curr: 'ask', next: 'capture_choices' },
      answered: {
        choices: [{ id: 'none', label: 'None', kind: 'none' }],
        comment: 'No listed option applies.',
      },
    });
    expect(input).toHaveBeenCalledExactlyOnceWith('Required comment', undefined);
    expect(custom).toHaveBeenCalledOnce();
    expectBracketedWorkingIndicator(setWorkingVisible);
  });

  it('resolves escape as the cancelled terminal on every mounted ask surface', async () => {
    const cases = [
      {
        name: 'free-text',
        params: { exchangeId: 'runtime-free-cancel', body: 'Cancel free text?' },
      },
      {
        name: 'single-select',
        params: {
          exchangeId: 'runtime-single-cancel',
          body: 'Cancel single?',
          options: [{ id: 'one', label: 'One' }],
        },
      },
      {
        name: 'multi-select',
        params: {
          exchangeId: 'runtime-multi-cancel',
          body: 'Cancel multi?',
          options: [{ id: 'one', label: 'One' }],
          multiple: true,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const custom = mountedCustom({
        assertViewport: (viewport) => {
          expect(viewport).toContain(testCase.params.body);
        },
        script: (terminal) => {
          terminal.sendInput('\x1b');
        },
      });

      const result = await executeAsk(testCase.params, { hasUI: true, ui: { custom } });
      const details = zAskDetails.parse(result.details);
      expect(details).toMatchObject({
        exchange_id: testCase.params.exchangeId,
        tool_meta: { curr: 'ask' },
        cancelled: {},
      });
      expect(result.terminate).toBe(true);
      expect(custom, testCase.name).toHaveBeenCalledOnce();
    }
  });
});
