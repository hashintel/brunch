import { type KeybindingsManager, type Theme } from '@earendil-works/pi-coding-agent';
import { type Component, TUI } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { projectPresentDigest } from '../../../exchanges/projections/present-digest.js';
import { zAskDetails } from '../../../exchanges/schemas/index.js';
import { appendBrunchAgentRuntimeSwitch } from '../../../session/runtime-state.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { operationalModeBorderColorRole } from '../../components/mode-border-theme.js';
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
const roleTheme = {
  fg: (color: string, text: string) => `${color}:${text}`,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

async function executeAsk(params: Record<string, unknown>, ctx: StructuredExchangeUiContext) {
  const tool = createAskTool() as AskTool;
  return tool.execute('ask-runtime-mount-call', params, undefined, undefined, ctx);
}

function mountedCustom(options: {
  readonly assertViewport: (viewport: string) => void;
  readonly script: MountedCustomScript;
}): CustomMock {
  return mountedCustomSequence([options]);
}

function mountedCustomSequence(
  steps: readonly {
    readonly assertViewport: (viewport: string) => void;
    readonly script: MountedCustomScript;
  }[],
): CustomMock {
  let stepIndex = 0;
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
      const step = steps[stepIndex++];
      if (!step) throw new Error(`Unexpected mounted custom call ${stepIndex}`);
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
        step.assertViewport(terminal.getViewport().join('\n'));
        await step.script(terminal);
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
  it('injects the current mode border role into every mounted ask surface', async () => {
    const entries: Array<{ type?: unknown; customType?: unknown; data?: unknown }> = [];
    const sessionManager = {
      getEntries: () => entries,
      getBranch: () => entries,
      appendCustomEntry: (customType: string, data: unknown) => {
        entries.push({ type: 'custom', customType, data });
      },
    };
    appendBrunchAgentRuntimeSwitch(sessionManager, { schemaVersion: 1, operationalMode: 'execute' }, 'user');

    const cases = [
      { name: 'free-text', params: { exchangeId: 'mode-free', body: 'Explain the tradeoff' } },
      {
        name: 'single-select',
        params: {
          exchangeId: 'mode-single',
          body: 'Choose one',
          options: [{ id: 'one', label: 'One' }],
        },
      },
      {
        name: 'multi-select',
        params: {
          exchangeId: 'mode-multi',
          body: 'Choose all',
          options: [{ id: 'one', label: 'One' }],
          multiple: true,
        },
      },
    ] as const;

    for (const testCase of cases) {
      let rendered = '';
      const custom = vi.fn(async (factory: Parameters<CustomUi>[0]) => {
        const terminal = new VirtualTerminal(90, 28);
        const tui = new TUI(terminal);
        const component = factory(
          tui,
          roleTheme as Theme,
          undefined as unknown as KeybindingsManager,
          () => {},
        );
        rendered = component.render(80).join('\n');
        return undefined;
      }) as unknown as CustomMock;

      await executeAsk(testCase.params, { hasUI: true, ui: { custom }, sessionManager });

      expect(rendered, testCase.name).toContain(`${operationalModeBorderColorRole('execute')}:`);
    }
  });

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
    const custom = mountedCustomSequence([
      {
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
      },
      {
        assertViewport: (viewport) => expect(viewport).toContain('Required comment'),
        script: (terminal) => terminal.sendInput('\x1b'),
      },
      {
        assertViewport: (viewport) => {
          expect(viewport).toContain('Select applicable routes');
          expect(viewport).toMatch(/\[x\].*None/);
        },
        script: (terminal) => terminal.sendInput('\r'),
      },
      {
        assertViewport: (viewport) => expect(viewport).toContain('Required comment'),
        script: (terminal) => {
          terminal.sendInput('No listed option applies.');
          terminal.sendInput('\r');
        },
      },
    ]);

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
      { hasUI: true, ui: { custom, setWorkingVisible } },
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
    expect(custom).toHaveBeenCalledTimes(4);
    expect(setWorkingVisible.mock.calls.map(([visible]) => visible)).toEqual([false, true, false, true]);
  });

  it('collects a digest questionnaire in one mounted terminal with Back, Next, and final Submit', async () => {
    const setWorkingVisible = vi.fn();
    const digest = projectPresentDigest({
      exchangeId: 'digest-final',
      heading: 'Digest',
      digest: { abstract: 'Runtime-owned final abstract.' },
    });
    const entries = [
      {
        type: 'message',
        message: { role: 'toolResult', toolName: 'present_digest', details: digest.details },
      },
    ];
    const custom = mountedCustom({
      assertViewport: (viewport) => {
        expect(viewport).toContain('Question 1 of 2');
        expect(viewport).toContain('Next');
      },
      script: async (terminal) => {
        terminal.sendInput('First answer');
        terminal.sendInput('\r');
        await terminal.waitForRender();
        expect(terminal.getViewport().join('\n')).toContain('Back (←) · Submit');
        terminal.sendInput('\x1b[D');
        await terminal.waitForRender();
        expect(terminal.getViewport().join('\n')).toContain('First answer');
        terminal.sendInput('\r');
        terminal.sendInput('\x1b[B');
        terminal.sendInput('\r');
      },
    });

    const result = await executeAsk(
      {
        exchangeId: 'digest-questionnaire',
        acceptsDigest: 'digest-final',
        questions: [
          { id: 'why', kind: 'free-text', prompt: 'Why now?' },
          {
            id: 'route',
            kind: 'single-select',
            prompt: 'Which route?',
            options: [
              { id: 'safe', label: 'Safe' },
              { id: 'fast', label: 'Fast' },
            ],
          },
        ],
      },
      { hasUI: true, ui: { custom, setWorkingVisible }, sessionManager: { getBranch: () => entries } },
    );

    expect(zAskDetails.parse(result.details)).toMatchObject({
      accepts_digest: 'digest-final',
      answered: { submitted: true, accepted_abstract: 'Runtime-owned final abstract.' },
      questionnaire: [
        { answer: { questionId: 'why', text: 'First answer' } },
        { answer: { questionId: 'route', optionId: 'fast' } },
      ],
    });
    expect(custom).toHaveBeenCalledOnce();
    expectBracketedWorkingIndicator(setWorkingVisible);
  });

  it('serializes multi-select questionnaire answers in declared option order regardless of toggle order', async () => {
    const digest = projectPresentDigest({
      exchangeId: 'ordered-digest',
      heading: 'Digest',
      digest: { abstract: 'Ordering test digest.' },
    });
    const params = {
      exchangeId: 'ordered-questionnaire',
      acceptsDigest: 'ordered-digest',
      questions: [
        {
          id: 'priorities',
          kind: 'multi-select',
          prompt: 'Which priorities apply?',
          options: [
            { id: 'clarity', label: 'Clarity' },
            { id: 'speed', label: 'Speed' },
            { id: 'safety', label: 'Safety' },
          ],
        },
      ],
    };
    const runWithInputs = async (inputs: readonly string[]) => {
      const custom = mountedCustom({
        assertViewport: (viewport) => expect(viewport).toContain('Which priorities apply?'),
        script: (terminal) => inputs.forEach((input) => terminal.sendInput(input)),
      });
      const result = await executeAsk(params, {
        hasUI: true,
        ui: { custom },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: { role: 'toolResult', toolName: 'present_digest', details: digest.details },
            },
          ],
        },
      });
      const details = zAskDetails.parse(result.details);
      if (!('questionnaire' in details)) throw new Error('Expected questionnaire details');
      return details.questionnaire[0]?.answer;
    };

    const declarationOrder = await runWithInputs([' ', '\x1b[B', '\x1b[B', ' ', '\r']);
    const reverseInteractionOrder = await runWithInputs([
      '\x1b[B',
      '\x1b[B',
      ' ',
      '\x1b[A',
      '\x1b[A',
      ' ',
      '\r',
    ]);

    expect(declarationOrder).toMatchObject({ optionIds: ['clarity', 'safety'] });
    expect(reverseInteractionOrder).toEqual(declarationOrder);
  });

  it('rejects a second questionnaire id once the final digest already has a submitted carrier', async () => {
    const digest = projectPresentDigest({
      exchangeId: 'digest-final',
      heading: 'Digest',
      digest: { abstract: 'Runtime-owned final abstract.' },
    });
    const submitted = {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'questionnaire-first',
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      question: { body: 'Digest questionnaire' },
      accepts_digest: 'digest-final',
      questionnaire: [
        {
          question: {
            id: 'confirm',
            kind: 'single-select',
            prompt: 'Proceed?',
            options: [{ id: 'yes', label: 'Yes' }],
          },
          answer: { questionId: 'confirm', kind: 'single-select', optionId: 'yes' },
        },
      ],
      answered: { submitted: true, accepted_abstract: 'Runtime-owned final abstract.' },
    };
    const custom = vi.fn();
    const result = await executeAsk(
      {
        exchangeId: 'questionnaire-second',
        acceptsDigest: 'digest-final',
        questions: [
          {
            id: 'confirm',
            kind: 'single-select',
            prompt: 'Proceed?',
            options: [{ id: 'yes', label: 'Yes' }],
          },
        ],
      },
      {
        hasUI: true,
        ui: { custom },
        sessionManager: {
          getBranch: () => [
            { type: 'message', message: { role: 'toolResult', details: digest.details } },
            { type: 'message', message: { role: 'toolResult', details: submitted } },
          ],
        },
      },
    );

    expect(result.details).toMatchObject({
      unavailable: { message: expect.stringContaining('final eligible') },
    });
    expect(custom).not.toHaveBeenCalled();
  });

  it('cancels a mounted digest questionnaire without a submitted carrier', async () => {
    const digest = projectPresentDigest({
      exchangeId: 'digest-cancel',
      heading: 'Digest',
      digest: { abstract: 'Not accepted.' },
    });
    const custom = mountedCustom({
      assertViewport: (viewport) => expect(viewport).toContain('Question 1 of 1'),
      script: (terminal) => terminal.sendInput('\x1b'),
    });
    const result = await executeAsk(
      {
        exchangeId: 'questionnaire-cancel',
        acceptsDigest: 'digest-cancel',
        questions: [
          {
            id: 'confirm',
            kind: 'single-select',
            prompt: 'Proceed?',
            options: [{ id: 'yes', label: 'Yes' }],
          },
        ],
      },
      {
        hasUI: true,
        ui: { custom },
        sessionManager: {
          getBranch: () => [{ type: 'message', message: { role: 'toolResult', details: digest.details } }],
        },
      },
    );
    expect(zAskDetails.parse(result.details)).toMatchObject({ cancelled: {} });
    expect(result.terminate).toBe(true);
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
