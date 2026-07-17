import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { createDb } from '../../../db/connection.js';
import {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from '../../../exchanges/recovery.js';
import { CommandExecutor } from '../../../graph/command-executor.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import {
  ASK_TOOL,
  PRESENT_CANDIDATES_TOOL,
  PRESENT_DIGEST_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange,
} from '../exchanges/index.js';

interface ToolTextContent {
  type: 'text';
  text: string;
}

interface ToolExecutionResult {
  content: ToolTextContent[];
  details: any;
  terminate?: boolean;
}

interface RegisteredTool {
  name: string;
  executionMode?: string;
  renderShell?: string;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<ToolExecutionResult>;
  renderCall: () => { render?: (width: number) => string[] };
  renderResult: (
    result: ToolExecutionResult,
    options: unknown,
    theme: FakeTheme,
    context?: unknown,
  ) => { render?: (width: number) => string[] };
}

interface FakeTheme {
  fg: (_color: string, text: string) => string;
  bold?: (text: string) => string;
}

const theme: FakeTheme = {
  fg: (_color, text) => text,
  bold: (text) => text,
};

function registeredTools(
  options: Parameters<typeof registerStructuredExchange>[1] = {},
): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  registerStructuredExchange(
    {
      registerTool(tool: RegisteredTool) {
        tools.set(tool.name, tool);
      },
    } as never,
    options,
  );
  return tools;
}

function reviewDeps() {
  const db = createDb(':memory:');
  const commandExecutor = new CommandExecutor(db);
  const spec = commandExecutor.createSpec({ name: 'Review Spec', slug: 'review-spec' });
  if (spec.status !== 'success') throw new Error('Unable to create review spec');
  return { specId: spec.specId, commandExecutor };
}

interface TestPickerComponent {
  render(width: number): string[];
  handleInput(data: string): void;
}

function customPickByIndex(index: number) {
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    let picked: unknown;
    const component = factory(null, theme, null, (result: unknown) => {
      picked = result;
    }) as TestPickerComponent;
    expect(component.render(80).join('\n')).toContain('╭');
    for (let step = 0; step < index; step += 1) component.handleInput('\x1b[B');
    component.handleInput('\r');
    return picked;
  });
}

function customMultiPick(indexes: readonly number[]) {
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    let picked: unknown;
    const component = factory(null, theme, null, (result: unknown) => {
      picked = result;
    }) as TestPickerComponent;
    expect(component.render(80).join('\n')).toContain('╭');
    let cursor = 0;
    for (const index of indexes) {
      while (cursor < index) {
        component.handleInput('\x1b[B');
        cursor += 1;
      }
      component.handleInput(' ');
    }
    component.handleInput('\r');
    return picked;
  });
}

function customPickWithChromeAssertions(
  index: number,
  assertions: (rendered: string) => void,
  input?: { readonly prompt: string; readonly value: string },
) {
  let presentation = 0;
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    let result: unknown;
    const component = factory(null, theme, null, (value: unknown) => {
      result = value;
    }) as TestPickerComponent;
    const rendered = component.render(80).join('\n');
    if (presentation === 0) {
      assertions(rendered);
      for (let step = 0; step < index; step += 1) component.handleInput('\x1b[B');
      component.handleInput('\r');
    } else {
      if (!input) throw new Error('custom input presented unexpectedly');
      expect(rendered).toContain(input.prompt);
      component.handleInput(input.value);
      component.handleInput('\r');
    }
    presentation += 1;
    return result;
  });
}

function customPickWithRenderedText(index: number, expectedText: string) {
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    let picked: unknown;
    const component = factory(null, theme, null, (result: unknown) => {
      picked = result;
    }) as TestPickerComponent;
    expect(component.render(80).join('\n')).toContain(expectedText);
    for (let step = 0; step < index; step += 1) component.handleInput('\x1b[B');
    component.handleInput('\r');
    return picked;
  });
}

type CustomStep =
  | { readonly kind: 'pick'; readonly index: number }
  | { readonly kind: 'multi'; readonly indexes: readonly number[]; readonly restoredText?: string }
  | { readonly kind: 'input'; readonly prompt: string; readonly value?: string };

function customInteractionSequence(steps: readonly CustomStep[]) {
  let presentation = 0;
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    const step = steps[presentation];
    presentation += 1;
    if (!step) throw new Error('custom component presented more times than expected');

    let result: unknown;
    const component = factory(null, theme, null, (value: unknown) => {
      result = value;
    }) as TestPickerComponent;
    const rendered = component.render(80).join('\n');
    expect(rendered).toContain('╭');
    if (step.kind === 'pick') {
      for (let index = 0; index < step.index; index += 1) component.handleInput('\x1b[B');
      component.handleInput('\r');
    } else if (step.kind === 'multi') {
      if (step.restoredText) expect(rendered).toContain(step.restoredText);
      let cursor = 0;
      for (const index of step.indexes) {
        while (cursor < index) {
          component.handleInput('\x1b[B');
          cursor += 1;
        }
        component.handleInput(' ');
      }
      component.handleInput('\r');
    } else {
      expect(rendered).toContain(step.prompt);
      if (step.value === undefined) component.handleInput('\x1b');
      else {
        component.handleInput(step.value);
        component.handleInput('\r');
      }
    }
    return result;
  });
}

function customCancel() {
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    let picked: unknown = 'not-cancelled';
    const component = factory(null, theme, null, (result: unknown) => {
      picked = result;
    }) as TestPickerComponent;
    component.handleInput('\x1b');
    return picked;
  });
}

function validReviewPayload() {
  return {
    schemaVersion: 1,
    lens: 'intent',
    epistemicStatus: 'inferred',
    grounding: {
      summary: 'The user described a launch review flow.',
      support: ['The transcript asks for exact approval before graph mutation.'],
    },
    pitch: {
      title: 'Review cycle wiring',
      narrative: 'Commit review-set approvals as explicit graph truth only after user review.',
    },
    entityDrafts: [
      { draftId: 'goal-review', plane: 'intent', kind: 'goal', title: 'Review graph proposals' },
      { draftId: 'req-approve', plane: 'intent', kind: 'requirement', title: 'Approval is atomic' },
    ],
    edgeDrafts: [
      {
        category: 'dependency',
        dependency: { draftId: 'req-approve' },
        dependent: { draftId: 'goal-review' },
      },
    ],
  };
}

function validPlanReviewPayload() {
  return {
    schemaVersion: 1,
    lens: 'plan',
    epistemicStatus: 'asserted',
    grounding: {
      summary: 'The user wants one committed handoff package below the frontier.',
      support: ['The executor needs requirement, design, and verification anchors together.'],
    },
    pitch: {
      title: 'Commit the scope handoff package',
      narrative: 'Review one plan-lens package that the executor can consume directly.',
    },
    entityDrafts: [
      {
        draftId: 'frontier-scope-proof',
        plane: 'plan',
        kind: 'frontier',
        title: 'Scope proof frontier',
      },
      {
        draftId: 'scope-handoff',
        plane: 'plan',
        kind: 'scope',
        title: 'Executor handoff package',
      },
      {
        draftId: 'check-handoff-proof',
        plane: 'oracle',
        kind: 'check',
        title: 'Scope handoff proof',
      },
    ],
    edgeDrafts: [
      {
        category: 'composition',
        whole: { draftId: 'frontier-scope-proof' },
        part: { draftId: 'scope-handoff' },
      },
      {
        category: 'dependency',
        dependency: { draftId: 'check-handoff-proof' },
        dependent: { draftId: 'scope-handoff' },
      },
    ],
  };
}

function candidateParams(exchangeId = 'candidate-direction') {
  return {
    exchangeId,
    heading: 'Which direction should we take?',
    body: 'Pick one candidate.',
    candidates: [
      candidateDetails('local-workbench', 'Local workbench'),
      candidateDetails('remote-workbench', 'Remote workbench'),
    ],
  };
}

function candidateDetails(id: string, title: string) {
  return {
    id,
    title,
    user_rubric: {
      core_bet: 'Make local graph work the thesis.',
      best_fit: 'Keeps the POC focused.',
      cost_complexity: 'Requires owning local state clearly.',
      covers_well: 'Covers chrome, transcript, and graph coherence.',
      main_risks: 'Does not solve cloud collaboration.',
      lock_in_constraints: 'Commits to local-first semantics.',
      recommendation: 'Choose this for the POC.',
    },
    meta_rubric: {},
    graph_refs: [{ node_id: `${id}-node` }],
  };
}

async function presentResult(toolName: string, params: Record<string, unknown>) {
  const tool = registeredTools({ review: reviewDeps() }).get(toolName);
  if (!tool) throw new Error(`${toolName} was not registered`);
  return tool.execute(`${toolName}-call`, params, undefined, undefined, {} as never);
}

function branchWith(details: unknown) {
  return [{ type: 'message', message: { role: 'toolResult', details } }];
}

describe('structured exchange ask tools', () => {
  it('registers ask and offer presents only; legacy present_question/request_response are retired', () => {
    const tools = registeredTools();

    expect([...tools.keys()]).toEqual([
      ASK_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      PRESENT_DIGEST_TOOL,
    ]);
    expect(tools.has(PRESENT_QUESTION_TOOL)).toBe(false);
    expect(tools.has(REQUEST_RESPONSE_TOOL)).toBe(false);
    for (const tool of tools.values()) {
      expect(tool.executionMode).toBe('sequential');
      expect(tool.renderShell).toBe('self');
    }
  });

  it('persists standalone free-text ask answers and renders the question plus answer together', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const custom = vi.fn(async (factory: (...args: unknown[]) => unknown) => {
      const terminal = new VirtualTerminal(80, 24);
      const tui = new TUI(terminal);
      let answer: unknown;
      const component = factory(tui, theme, null, (result: unknown) => {
        answer = result;
      }) as TestPickerComponent & { setText(text: string): void };
      expect(component.render(80).join('\n')).toContain('What problem are we solving?');
      component.setText('Answer collected by custom editor.');
      component.handleInput('\r');
      return answer;
    });

    const result = await ask.execute(
      'ask-freeform-call',
      {
        exchangeId: 'problem-frame',
        body: 'What problem are we solving?',
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom } } as never,
    );

    expect(result.content[0]?.text).not.toContain('## Question');
    expect(result.content[0]?.text).toContain('What problem are we solving?');
    expect(result.content[0]?.text).toContain('**Answer:**');
    expect(result.content[0]?.text).toContain('Answer collected by custom editor.');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'problem-frame',
      tool_meta: { curr: ASK_TOOL, next: 'capture_answer' },
      question: { body: 'What problem are we solving?' },
      answered: { text: 'Answer collected by custom editor.' },
    });
  });

  it('falls back from a stubbed custom editor to ctx.ui.editor before declaring cancellation', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const custom = vi.fn(async () => undefined);
    const editor = vi.fn(async () => 'Answer collected by sealed editor.');

    const result = await ask.execute(
      'ask-freeform-stubbed-custom-call',
      { exchangeId: 'stubbed-custom', body: 'Use editor fallback?' },
      undefined,
      undefined,
      { hasUI: true, ui: { custom, editor } } as never,
    );

    expect(custom).toHaveBeenCalledOnce();
    expect(editor).toHaveBeenCalledWith('Use editor fallback?');
    expect(result.details).toMatchObject({ answered: { text: 'Answer collected by sealed editor.' } });
  });

  it('collects an optional free-text comment only when commentPrompt is provided', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const input = vi.fn(async () => 'Context for the answer.');

    const withPrompt = await ask.execute(
      'ask-freeform-comment',
      {
        exchangeId: 'freeform-comment',
        body: 'What problem are we solving?',
        commentPrompt: 'Anything else?',
      },
      undefined,
      undefined,
      { hasUI: true, ui: { editor: async () => 'The core answer.', input } } as never,
    );
    const withoutPrompt = await ask.execute(
      'ask-freeform-no-comment',
      { exchangeId: 'freeform-no-comment', body: 'What problem are we solving?' },
      undefined,
      undefined,
      { hasUI: true, ui: { editor: async () => 'The core answer.', input } } as never,
    );

    expect(input).toHaveBeenCalledExactlyOnceWith('Anything else?');
    expect(withPrompt.details).toMatchObject({
      answered: { text: 'The core answer.', comment: 'Context for the answer.' },
    });
    expect(withPrompt.content[0]?.text).toContain('Context for the answer.');
    expect(withoutPrompt.details).toMatchObject({ answered: { text: 'The core answer.' } });
    expect((withoutPrompt.details as { answered?: { comment?: string } }).answered?.comment).toBeUndefined();
  });

  it('skips the optional comment for choice asks that omit commentPrompt', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const input = vi.fn(async () => 'Should never be collected.');

    const single = await ask.execute(
      'ask-choice-no-comment-prompt',
      {
        exchangeId: 'choice-no-comment-prompt',
        body: 'Select one option.',
        options: [
          { id: 'first-option', label: 'First' },
          { id: 'second-option', label: 'Second' },
        ],
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom: customPickByIndex(0), input } } as never,
    );
    const multi = await ask.execute(
      'ask-choices-no-comment-prompt',
      {
        exchangeId: 'choices-no-comment-prompt',
        body: 'Select all that apply.',
        options: [
          { id: 'speed', label: 'Move quickly' },
          { id: 'safety', label: 'Keep the transcript safe' },
        ],
        multiple: true,
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom: customMultiPick([0]), input } } as never,
    );

    expect(input).not.toHaveBeenCalled();
    expect(single.details).toMatchObject({ answered: { choice: { id: 'first-option' } } });
    expect(multi.details).toMatchObject({ answered: { choices: [{ id: 'speed' }] } });
  });

  it('records cancellation with terminate, broker fallback, unavailable, and empty-answer discipline', async () => {
    const openAsk = vi.fn(async () => 'Answer collected by broker.');
    const notify = vi.fn();
    const setStatus = vi.fn();
    const ask = registeredTools({ liveExchange: { openAsk } }).get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');

    const cancelled = await ask.execute(
      'ask-cancelled',
      { exchangeId: 'cancelled', body: 'Cancel?' },
      undefined,
      undefined,
      { hasUI: true, ui: { custom: customCancel(), notify, setStatus } } as never,
    );
    const brokered = await ask.execute(
      'ask-brokered',
      { exchangeId: 'brokered', body: 'Broker?' },
      undefined,
      undefined,
      { hasUI: false, ui: { notify, setStatus } } as never,
    );
    const unavailable = await registeredTools()
      .get(ASK_TOOL)!
      .execute('ask-unavailable', { exchangeId: 'unavailable', body: 'Unavailable?' }, undefined, undefined, {
        hasUI: false,
        ui: {},
      } as never);
    const empty = await registeredTools()
      .get(ASK_TOOL)!
      .execute('ask-empty', { exchangeId: 'empty', body: 'No blanks.' }, undefined, undefined, {
        hasUI: true,
        ui: { editor: async () => '   ' },
      } as never);

    expect(cancelled.details).toMatchObject({ tool_meta: { curr: ASK_TOOL }, cancelled: {} });
    expect(cancelled.terminate).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/\/brunch:consult.*\/brunch:mode/), 'info');
    expect(notify).not.toHaveBeenCalledWith(expect.stringContaining('/brunch:continue'), expect.anything());
    expect(setStatus).not.toHaveBeenCalledWith('brunch.ask', expect.anything());
    expect(openAsk).toHaveBeenCalledWith(
      {
        exchangeId: 'brokered',
        mode: 'text',
        question: { body: 'Broker?' },
      },
      expect.any(AbortSignal),
    );
    expect(brokered.details).toMatchObject({ answered: { text: 'Answer collected by broker.' } });
    expect(setStatus).not.toHaveBeenCalled();
    expect(unavailable.details).toMatchObject({ unavailable: { message: 'ask requires interactive UI' } });
    expect(empty.details).toMatchObject({ unavailable: { message: 'ask answer cannot be empty' } });
  });

  it('collects standalone single-choice asks with stable ids, Other/None comments, and duplicate labels', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');

    const duplicate = await ask.execute(
      'ask-choice-duplicate',
      {
        exchangeId: 'duplicate-options',
        body: 'Select one option.',
        options: [
          { id: 'first-option', label: 'Repeat label' },
          { id: 'second-option', label: 'Repeat label' },
        ],
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom: customPickByIndex(1) } } as never,
    );
    const other = await ask.execute(
      'ask-choice-other',
      {
        exchangeId: 'other-option',
        body: 'Select one option.',
        options: [{ id: 'root', label: 'Keep src/pi-extensions.ts' }],
        allowOther: true,
        commentPrompt: 'Optional comment',
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customInteractionSequence([
            { kind: 'pick', index: 1 },
            { kind: 'input', prompt: 'Other', value: 'Something else entirely' },
            { kind: 'input', prompt: 'Optional comment', value: 'Needs a custom path.' },
          ]),
        },
      } as never,
    );
    const none = await ask.execute(
      'ask-choice-none',
      {
        exchangeId: 'none-option',
        body: 'Select one option.',
        options: [{ id: 'root', label: 'Keep src/pi-extensions.ts' }],
        allowOther: true,
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customInteractionSequence([
            { kind: 'pick', index: 2 },
            { kind: 'input', prompt: 'Required comment', value: 'No listed option fits.' },
          ]),
        },
      } as never,
    );
    const customOnly = await ask.execute(
      'ask-choice-none-no-input',
      {
        exchangeId: 'none-no-input',
        body: 'Select one option.',
        options: [{ id: 'root', label: 'Keep src/pi-extensions.ts' }],
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customInteractionSequence([
            { kind: 'pick', index: 1 },
            { kind: 'input', prompt: 'Required comment', value: 'No listed option fits.' },
          ]),
        },
      } as never,
    );

    expect(duplicate.details).toMatchObject({
      answered: { choice: { id: 'second-option', label: 'Repeat label', kind: 'listed' } },
    });
    expect(other.details).toMatchObject({
      answered: {
        choice: { id: 'other', label: 'Something else entirely', kind: 'other' },
        comment: 'Needs a custom path.',
      },
    });
    expect(none.details).toMatchObject({
      answered: { choice: { id: 'none', label: 'None', kind: 'none' }, comment: 'No listed option fits.' },
    });
    expect(customOnly.details).toMatchObject({
      answered: { choice: { id: 'none', label: 'None', kind: 'none' }, comment: 'No listed option fits.' },
    });
  });

  it('carries option descriptions into standalone and declared-continuation picker choices', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const standalone = await ask.execute(
      'ask-choice-description',
      {
        exchangeId: 'choice-description',
        body: 'Select one option.',
        options: [
          {
            id: 'local-workbench',
            label: 'Local workbench',
            description: 'Keeps the proof close to fixtures.',
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickWithRenderedText(0, 'Keeps the proof close to fixtures.') },
      } as never,
    );

    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());
    const continuation = await ask.execute(
      'ask-candidate-continuation-description',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickWithRenderedText(0, 'Choose this for the POC.') },
        sessionManager: { getBranch: () => branchWith(candidates.details) },
      } as never,
    );

    expect(standalone.details).toMatchObject({
      answered: { choice: { id: 'local-workbench', label: 'Local workbench', kind: 'listed' } },
    });
    expect(continuation.details).toMatchObject({
      answered: { choice: { id: 'local-workbench', label: 'Local workbench', kind: 'listed' } },
    });
  });

  it('collects standalone multi-choice asks through custom UI and editor envelope fallback', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');

    const custom = await ask.execute(
      'ask-multi-custom',
      {
        exchangeId: 'priorities-custom',
        body: 'Select all priorities.',
        options: [
          { id: 'speed', label: 'Move quickly' },
          { id: 'safety', label: 'Keep the transcript safe' },
        ],
        multiple: true,
        commentPrompt: 'Optional comment',
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customInteractionSequence([
            { kind: 'multi', indexes: [0, 1] },
            { kind: 'input', prompt: 'Optional comment', value: 'Speed is primary.' },
          ]),
        },
      } as never,
    );
    const editor = await ask.execute(
      'ask-multi-editor',
      {
        exchangeId: 'priorities-editor',
        body: 'Select all priorities.',
        options: [
          { id: 'speed', label: 'Move quickly' },
          { id: 'safety', label: 'Keep the transcript safe' },
        ],
        multiple: true,
        allowOther: true,
        commentPrompt: 'Optional comment',
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          editor: async (prefill: string) => {
            const payload = JSON.parse(prefill);
            payload.response = {
              status: 'answered',
              choices: [
                { id: 'speed', label: 'Move quickly' },
                { id: 'other', label: 'Other' },
              ],
              comment: 'Also keep the proof deterministic.',
            };
            return JSON.stringify(payload);
          },
        },
      } as never,
    );

    expect(custom.content[0]?.text).not.toContain('brunch.structured_exchange.request_choices.editor');
    expect(custom.details).toMatchObject({
      tool_meta: { curr: ASK_TOOL, next: 'capture_choices' },
      answered: { choices: [{ id: 'speed' }, { id: 'safety' }], comment: 'Speed is primary.' },
    });
    expect(editor.details).toMatchObject({
      tool_meta: { curr: ASK_TOOL, next: 'capture_choices' },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'other', label: 'Other', kind: 'other' },
        ],
        comment: 'Also keep the proof deterministic.',
      },
    });
  });

  it('rejects invalid standalone multi-choice editor selections', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');

    const missingComment = await ask.execute(
      'ask-multi-missing-comment',
      {
        exchangeId: 'priorities-missing-comment',
        body: 'Select all priorities.',
        options: [{ id: 'speed', label: 'Move quickly' }],
        multiple: true,
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          editor: async (prefill: string) => {
            const payload = JSON.parse(prefill);
            payload.response = {
              status: 'answered',
              choices: [{ id: 'none', label: 'None' }],
              comment: '   ',
            };
            return JSON.stringify(payload);
          },
        },
      } as never,
    );
    const combinedNone = await ask.execute(
      'ask-multi-combined-none',
      {
        exchangeId: 'priorities-combined-none',
        body: 'Select all priorities.',
        options: [{ id: 'speed', label: 'Move quickly' }],
        multiple: true,
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          editor: async (prefill: string) => {
            const payload = JSON.parse(prefill);
            payload.response = {
              status: 'answered',
              choices: [
                { id: 'speed', label: 'Move quickly' },
                { id: 'none', label: 'None' },
              ],
              comment: 'Contradictory selection.',
            };
            return JSON.stringify(payload);
          },
        },
      } as never,
    );

    expect(missingComment.details).toMatchObject({
      unavailable: { message: 'request_choices requires a comment for Other or None selections' },
    });
    expect(combinedNone.details).toMatchObject({
      unavailable: { message: 'request_choices cannot combine None with other selections' },
    });
  });

  it('presents offers with declared ask continuations and recovery reads those declarations', async () => {
    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());
    const digest = await presentResult(PRESENT_DIGEST_TOOL, {
      exchangeId: 'digest-large-source',
      heading: 'Review source digest',
      body: 'Approve this before graph mapping.',
      digest: {
        abstract: 'The source says summarize before graph mapping.',
        analysis: 'The digest is advisory input, not graph truth.',
      },
    });
    const review = await presentResult(PRESENT_REVIEW_SET_TOOL, {
      exchangeId: 'review-cycle-1',
      payload: validReviewPayload(),
    });

    for (const result of [candidates, digest, review]) {
      expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
      expect(result.details).toMatchObject({ continuation: { tool: ASK_TOOL } });
      expect(result.details.continuation.params.body).toEqual(expect.any(String));
    }
    expect(candidates.details.continuation.params.options).toEqual(expect.any(Array));
    expect(review.details.continuation.params.options).toEqual(expect.any(Array));
    expect(digest.details.continuation.params.options).toBeUndefined();
    const incomplete = findIncompleteStructuredExchangePresents(branchWith(candidates.details));
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.continuationTool).toBe(ASK_TOOL);
  });

  it('keeps a declared continuation resumable after cancelled or unavailable terminals', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());

    const cancelled = await ask.execute(
      'ask-candidate-cancel',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customCancel(), notify: vi.fn(), setStatus: vi.fn() },
        sessionManager: { getBranch: () => branchWith(candidates.details) },
      } as never,
    );
    expect(cancelled.details).toMatchObject({ cancelled: {} });

    const branchAfterCancel = [
      ...branchWith(candidates.details),
      { type: 'message', message: { role: 'toolResult', details: cancelled.details } },
    ];
    expect(findIncompleteStructuredExchangePresents(branchAfterCancel)).toHaveLength(1);

    const reCollected = await ask.execute(
      'ask-candidate-after-cancel',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(0), setStatus: vi.fn() },
        sessionManager: { getBranch: () => branchAfterCancel },
      } as never,
    );
    expect(reCollected.details).toMatchObject({
      answered: { choice: { id: 'local-workbench', kind: 'listed' } },
    });

    const branchAfterAnswer = [
      ...branchAfterCancel,
      { type: 'message', message: { role: 'toolResult', details: reCollected.details } },
    ];
    expect(findIncompleteStructuredExchangePresents(branchAfterAnswer)).toHaveLength(0);
  });

  it('notifies transient continuation guidance on cancel without publishing footer status', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());

    const notify = vi.fn();
    const setStatus = vi.fn();
    await ask.execute(
      'ask-candidate-cancel-hint',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customCancel(), notify, setStatus },
        sessionManager: { getBranch: () => branchWith(candidates.details) },
      } as never,
    );
    expect(notify).toHaveBeenCalledWith(
      expect.stringMatching(/\/brunch:continue.*\/brunch:consult.*\/brunch:mode/),
      'info',
    );
    expect(setStatus).not.toHaveBeenCalledWith('brunch.continue', expect.anything());

    const answerStatus = vi.fn();
    await ask.execute(
      'ask-candidate-answer-hint',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(0), setStatus: answerStatus },
        sessionManager: { getBranch: () => branchWith(candidates.details) },
      } as never,
    );
    expect(answerStatus).not.toHaveBeenCalled();
  });

  it('renders validated ask terminals with distinct rails over canonical markdown and falls back for malformed details', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const base = {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'rail-fixture',
      tool_meta: { curr: 'ask' },
      question: { body: 'Question?' },
    };
    const fixtures = [
      {
        label: 'Answered',
        details: { ...base, tool_meta: { curr: 'ask', next: 'capture_answer' }, answered: { text: 'Yes.' } },
      },
      { label: 'Cancelled', details: { ...base, cancelled: {} } },
      { label: 'Unavailable', details: { ...base, unavailable: { message: 'No UI.' } } },
    ];

    for (const fixture of fixtures) {
      const canonical = `# Canonical ${fixture.label}\n\nFormatter-owned body.`;
      const rendered = ask
        .renderResult({ content: [{ type: 'text', text: canonical }], details: fixture.details }, {}, theme)
        .render?.(80)
        .join('\n');
      expect(rendered).toContain(fixture.label);
      expect(rendered).toContain(`Canonical ${fixture.label}`);
      expect(rendered).toContain('Formatter-owned body.');
    }

    const rejected = await ask.execute(
      'ask-invalid-rail',
      { exchangeId: 'bad', body: '', rawRejectedValue: 'RAW_SENTINEL' },
      undefined,
      undefined,
      {} as never,
    );
    const rejectedRendered = ask.renderResult(rejected, {}, theme).render?.(80).join('\n');
    expect(rejectedRendered).toContain('Input rejected');
    expect(rejectedRendered).toContain('ask');
    expect(rejectedRendered).toContain('body');
    expect(rejectedRendered).toContain('retry');
    expect(rejectedRendered).not.toContain('RAW_SENTINEL');

    const fallback = ask
      .renderResult(
        {
          content: [{ type: 'text', text: '# Existing fallback\n\nCanonical malformed-details body.' }],
          details: { ...base, mystery: {} },
        },
        {},
        theme,
      )
      .render?.(80)
      .join('\n');
    expect(fallback).toContain('Existing fallback');
    expect(fallback).toContain('Canonical malformed-details body.');
    expect(fallback).not.toMatch(/Answered|Cancelled|Unavailable|Input rejected/);
    expect(ask.renderCall().render?.(80).join('')).toBe('');
  });

  it('renders present_candidates from validated details and falls back to content for malformed details', async () => {
    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());
    const tool = registeredTools({ review: reviewDeps() }).get(PRESENT_CANDIDATES_TOOL);
    if (!tool) throw new Error('present_candidates was not registered');

    const richRendered = tool.renderResult(candidates, {}, theme).render?.(80).join('\n');
    const fallbackRendered = tool
      .renderResult(
        {
          content: [{ type: 'text', text: '# Fallback content\n\nUse the canonical content record.' }],
          details: { schema: 'wrong', candidates: [] },
        },
        {},
        theme,
      )
      .render?.(80)
      .join('\n');

    expect(richRendered).toContain('1. Local workbench');
    expect(richRendered).toContain('Status: Recognition proposal');
    expect(richRendered).not.toContain('**Core bet:**');
    expect(fallbackRendered).toContain('Fallback content');
    expect(fallbackRendered).toContain('Use the canonical content record.');
  });

  it('renders present_review_set from validated details and falls back for malformed or structural-illegal details', async () => {
    const review = await presentResult(PRESENT_REVIEW_SET_TOOL, {
      exchangeId: 'review-cycle-1',
      payload: validReviewPayload(),
    });
    const tool = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!tool) throw new Error('present_review_set was not registered');

    const richRendered = tool.renderResult(review, {}, theme).render?.(80).join('\n');
    const malformedFallback = tool
      .renderResult(
        {
          content: [{ type: 'text', text: '# Fallback content\n\nUse the canonical content record.' }],
          details: { schema: 'wrong', review_set: { nodes: [], edges: [] } },
        },
        {},
        theme,
      )
      .render?.(80)
      .join('\n');
    const structuralIllegal = await registeredTools()
      .get(PRESENT_REVIEW_SET_TOOL)
      ?.execute(
        'review-no-deps',
        {
          exchangeId: 'review-cycle-1',
          payload: validReviewPayload(),
        },
        undefined,
        undefined,
        {} as never,
      );
    if (!structuralIllegal) throw new Error('present_review_set returned no structural-illegal result');
    const structuralIllegalRendered = tool.renderResult(structuralIllegal, {}, theme).render?.(80).join('\n');

    expect(richRendered).toContain('Terms');
    expect(richRendered).toContain('Intent');
    expect(richRendered).toContain('goal         G1    Review graph proposals');
    expect(richRendered).toContain('refs: G1');
    expect(richRendered).not.toContain('accepted');
    expect(richRendered).not.toContain('committed');
    expect(richRendered).not.toContain('applied');
    expect(malformedFallback).toContain('Fallback content');
    expect(malformedFallback).toContain('Use the canonical content record.');
    expect(structuralIllegalRendered).toContain('STRUCTURAL_ILLEGAL');
    expect(structuralIllegalRendered).toContain('review-set graph dependencies unavailable');
  });

  it('accepts a plan-lens review set with a scope package', async () => {
    const review = await presentResult(PRESENT_REVIEW_SET_TOOL, {
      exchangeId: 'scope-review-cycle',
      payload: validPlanReviewPayload(),
    });
    const tool = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!tool) throw new Error('present_review_set was not registered');

    const rendered = tool.renderResult(review, {}, theme).render?.(80).join('\n');

    expect(rendered).toContain('Assurance');
    expect(rendered).toContain('Planning');
    expect(rendered).toContain('check     CH1   Scope handoff proof');
    expect(rendered).toContain('scope     SCP1  Executor handoff package');
    expect(rendered).toContain('refs: SCP1');
  });

  // Digest continuations route to the editor (free-text feedback), not a decision picker — that
  // path is proven in "drives candidate/review decisions and conversational digest feedback by
  // reference". Only candidate and review-set offers expose picker chrome, so only they belong here.
  it('shows only controls in candidate and review-set continuation pickers', async () => {
    const ask = registeredTools({ review: reviewDeps() }).get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const offers = [
      {
        details: (await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams())).details,
        exchangeId: 'candidate-direction',
        repeatedPretext: ['Which direction should we take?', 'Pick one candidate.'],
        expectedControl: 'Local workbench',
      },
      {
        details: (
          await presentResult(PRESENT_REVIEW_SET_TOOL, {
            exchangeId: 'review-live-chrome',
            payload: validReviewPayload(),
          })
        ).details,
        exchangeId: 'review-live-chrome',
        repeatedPretext: ['Review cycle wiring', 'Commit review-set approvals'],
        expectedControl: 'Approve',
        comment: { prompt: 'Optional comment', value: 'Looks right.' },
      },
    ];

    for (const offer of offers) {
      await ask.execute(`ask-${offer.exchangeId}`, { continues: offer.exchangeId }, undefined, undefined, {
        hasUI: true,
        ui: {
          custom: customPickWithChromeAssertions(
            0,
            (rendered) => {
              expect(rendered).toContain(offer.expectedControl);
              for (const pretext of offer.repeatedPretext) expect(rendered).not.toContain(pretext);
            },
            offer.comment,
          ),
        },
        sessionManager: { getBranch: () => branchWith(offer.details) },
      } as never);
    }
  });

  it('drives candidate/review decisions and conversational digest feedback by reference', async () => {
    const deps = reviewDeps();
    const acceptReviewSet = vi.spyOn(deps.commandExecutor, 'acceptReviewSet');
    const ask = registeredTools({ review: deps }).get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const candidates = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams());
    const review = await presentResult(PRESENT_REVIEW_SET_TOOL, {
      exchangeId: 'review-cycle-1',
      payload: validReviewPayload(),
    });
    const digest = await presentResult(PRESENT_DIGEST_TOOL, {
      exchangeId: 'digest-large-source',
      heading: 'Review source digest',
      digest: { abstract: 'The source says summarize before graph mapping.' },
    });

    const candidateAnswer = await ask.execute(
      'ask-candidate-continuation',
      { continues: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(0) },
        sessionManager: { getBranch: () => branchWith(candidates.details) },
      } as never,
    );
    const reviewAnswer = await ask.execute(
      'ask-review-continuation',
      { continues: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customInteractionSequence([
            { kind: 'pick', index: 1 },
            { kind: 'input', prompt: 'Required change request', value: 'Tighten the grounding.' },
          ]),
        },
        sessionManager: { getBranch: () => branchWith(review.details) },
      } as never,
    );
    const digestAnswer = await ask.execute(
      'ask-digest-continuation',
      { continues: 'digest-large-source' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { editor: async () => 'Looks right.' },
        sessionManager: { getBranch: () => branchWith(digest.details) },
      } as never,
    );

    expect(candidateAnswer.details).toMatchObject({
      tool_meta: { prev: PRESENT_CANDIDATES_TOOL, curr: 'request_choice', next: 'capture_candidate' },
      answered: { choice: { id: 'local-workbench', label: 'Local workbench', kind: 'listed' } },
    });
    expect(reviewAnswer.details).toMatchObject({
      tool_meta: { prev: PRESENT_REVIEW_SET_TOOL, curr: 'request_review' },
      answered: { decision: 'request_changes', comment: 'Tighten the grounding.' },
    });
    expect(acceptReviewSet).not.toHaveBeenCalled();
    expect(digestAnswer.details).toMatchObject({
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      answered: { text: 'Looks right.' },
    });
  });

  it('fails loudly when an offer has no declared continuation', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const present = await presentResult(PRESENT_CANDIDATES_TOOL, candidateParams('undeclared-candidate'));
    const { continuation: _removed, ...details } = present.details;

    const result = await ask.execute(
      'ask-undeclared-continuation',
      { continues: 'undeclared-candidate' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(0) },
        sessionManager: { getBranch: () => branchWith(details) },
      } as never,
    );

    expect(result.details).toMatchObject({
      tool_meta: { curr: ASK_TOOL },
      unavailable: {
        message: 'Structured exchange undeclared-candidate does not declare an ask continuation',
      },
    });
  });

  it('backs out from nested single-choice steps to the picker without recording cancellation', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');

    const otherCustom = customInteractionSequence([
      { kind: 'pick', index: 1 },
      { kind: 'input', prompt: 'Other' },
      { kind: 'pick', index: 0 },
    ]);
    const other = await ask.execute(
      'ask-choice-other-back',
      {
        exchangeId: 'choice-other-back',
        body: 'Select one option.',
        options: [{ id: 'root', label: 'Keep the listed option' }],
        allowOther: true,
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom: otherCustom } } as never,
    );

    const requiredCommentCustom = customInteractionSequence([
      { kind: 'pick', index: 1 },
      { kind: 'input', prompt: 'Required comment' },
      { kind: 'pick', index: 0 },
    ]);
    const requiredComment = await ask.execute(
      'ask-choice-required-comment-back',
      {
        exchangeId: 'choice-required-comment-back',
        body: 'Select one option.',
        options: [{ id: 'root', label: 'Keep the listed option' }],
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: requiredCommentCustom },
      } as never,
    );

    const optionalCommentCustom = customInteractionSequence([
      { kind: 'pick', index: 0 },
      { kind: 'input', prompt: 'Optional comment' },
      { kind: 'pick', index: 1 },
      { kind: 'input', prompt: 'Optional comment', value: '' },
    ]);
    const optionalComment = await ask.execute(
      'ask-choice-optional-comment-back',
      {
        exchangeId: 'choice-optional-comment-back',
        body: 'Select one option.',
        options: [
          { id: 'first', label: 'First path' },
          { id: 'second', label: 'Second path' },
        ],
        commentPrompt: 'Optional comment',
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: optionalCommentCustom },
      } as never,
    );

    expect(other.details).toMatchObject({
      answered: { choice: { id: 'root', label: 'Keep the listed option', kind: 'listed' } },
    });
    expect(requiredComment.details).toMatchObject({
      answered: { choice: { id: 'root', label: 'Keep the listed option', kind: 'listed' } },
    });
    expect(optionalComment.details).toMatchObject({
      answered: { choice: { id: 'second', label: 'Second path', kind: 'listed' } },
    });
    expect(other.terminate).toBeUndefined();
    expect(requiredComment.terminate).toBeUndefined();
    expect(optionalComment.terminate).toBeUndefined();
    expect(otherCustom).toHaveBeenCalledTimes(3);
    expect(requiredCommentCustom).toHaveBeenCalledTimes(3);
    expect(optionalCommentCustom).toHaveBeenCalledTimes(4);
  });

  it('backs out from multi-choice Other entry with checkbox state restored', async () => {
    const ask = registeredTools().get(ASK_TOOL);
    if (!ask) throw new Error('ask was not registered');
    const custom = customInteractionSequence([
      { kind: 'multi', indexes: [0, 2] },
      { kind: 'input', prompt: 'Other' },
      { kind: 'multi', indexes: [2], restoredText: '[x] Move quickly' },
    ]);

    const result = await ask.execute(
      'ask-multi-other-back',
      {
        exchangeId: 'multi-other-back',
        body: 'Select all priorities.',
        options: [
          { id: 'speed', label: 'Move quickly' },
          { id: 'safety', label: 'Keep the transcript safe' },
        ],
        multiple: true,
        allowOther: true,
      },
      undefined,
      undefined,
      { hasUI: true, ui: { custom } } as never,
    );

    expect(result.details).toMatchObject({
      answered: { choices: [{ id: 'speed', label: 'Move quickly', kind: 'listed' }] },
    });
    expect(result.terminate).toBeUndefined();
    expect(custom).toHaveBeenCalledTimes(3);
  });
});
