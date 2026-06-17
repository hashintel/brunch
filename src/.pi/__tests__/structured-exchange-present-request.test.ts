import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import {
  PRESENT_OPTIONS_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_ANSWER_TOOL,
  REQUEST_CHOICE_TOOL,
  REQUEST_CHOICES_TOOL,
  REQUEST_REVIEW_TOOL,
  registerStructuredExchange,
} from '../extensions/exchanges/index.js';
import {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from '../extensions/exchanges/shared/recovery.js';

interface ToolTextContent {
  type: 'text';
  text: string;
}

interface ToolExecutionResult {
  content: ToolTextContent[];
  details: any;
}

interface RegisteredTool {
  name: string;
  executionMode?: string;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<ToolExecutionResult>;
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

describe('structured exchange present/request tools', () => {
  it('registers implemented present/request tools as sequential', () => {
    const tools = registeredTools();

    expect([...tools.keys()]).toEqual([
      'present_question',
      PRESENT_OPTIONS_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      'request_answer',
      REQUEST_CHOICE_TOOL,
      REQUEST_CHOICES_TOOL,
      REQUEST_REVIEW_TOOL,
    ]);
    expect(tools.get(PRESENT_OPTIONS_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(REQUEST_CHOICE_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_REVIEW_SET_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(REQUEST_CHOICES_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(REQUEST_REVIEW_TOOL)?.executionMode).toBe('sequential');
  });

  it('persists a present_question result through the shared project and format seam', async () => {
    const present = registeredTools().get('present_question');
    if (!present) throw new Error('present_question was not registered');

    const result = await present.execute(
      'present-question-call-1',
      {
        exchangeId: 'problem-frame',
        heading: 'What problem are we solving?',
        body: 'Keep the answer grounded in current Brunch session behavior.',
      },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toMatchInlineSnapshot(`
      "## What problem are we solving?

      Keep the answer grounded in current Brunch session behavior."
    `);
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'problem-frame',
      tool_meta: { curr: 'present_question', next: 'request_answer' },
      display: {
        heading: 'What problem are we solving?',
        body: 'Keep the answer grounded in current Brunch session behavior.',
      },
    });
  });

  it('persists a present_options result as markdown content plus recoverable details', async () => {
    const present = registeredTools().get(PRESENT_OPTIONS_TOOL);
    if (!present) throw new Error('present_options was not registered');

    const result = await present.execute(
      'present-call-1',
      {
        exchangeId: 'shell-location',
        heading: 'Where should the shell live?',
        body: 'Choose the module boundary for Brunch Pi extensions.',
        options: [
          {
            id: 'root',
            content: 'Keep src/pi-extensions.ts',
            rationale: 'Smallest diff.',
          },
          {
            id: 'tui',
            content: 'Move under src/tui-client',
            rationale: 'Clearer ownership.',
          },
        ],
        expectedRequestTool: REQUEST_CHOICE_TOOL,
      },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toContain('## Where should the shell live?');
    expect(result.content[0]?.text).toContain('Clearer ownership.');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location',
      tool_meta: { curr: PRESENT_OPTIONS_TOOL, next: REQUEST_CHOICE_TOOL },
      display: {
        heading: 'Where should the shell live?',
        body: 'Choose the module boundary for Brunch Pi extensions.',
      },
      options: [{ id: 'root' }, { id: 'tui', rationale: 'Clearer ownership.' }],
    });

    const rendered = result.content[0] ? present.renderResult(result, {}, theme).render?.(80).join('\n') : '';
    expect(rendered).toContain('Where should the shell live?');
    expect(rendered).toContain('Move under src/tui-client');
  });

  it('records request_answer responses from the UI editor when no broker is attached', async () => {
    const request = registeredTools().get(REQUEST_ANSWER_TOOL);
    if (!request) throw new Error('request_answer was not registered');

    const result = await request.execute(
      'request-answer-ui-call',
      {
        exchangeId: 'answer-source-ui',
        respondsToPresentTool: 'present_question',
        prompt: 'What should the UI answer?',
      },
      undefined,
      undefined,
      { hasUI: true, ui: { editor: async () => 'Use the local UI editor.' } } as never,
    );

    expect(result.details).toMatchObject({
      exchange_id: 'answer-source-ui',
      tool_meta: { prev: 'present_question', curr: REQUEST_ANSWER_TOOL },
      answered: { text: 'Use the local UI editor.' },
    });
  });

  it('records request_answer responses from the live broker when only a broker is attached', async () => {
    const request = registeredTools({
      liveExchange: { awaitAnswer: async () => 'Use the live sidecar broker.' },
    }).get(REQUEST_ANSWER_TOOL);
    if (!request) throw new Error('request_answer was not registered');

    const result = await request.execute(
      'request-answer-broker-call',
      {
        exchangeId: 'answer-source-broker',
        respondsToPresentTool: 'present_question',
        prompt: 'What should the broker answer?',
      },
      undefined,
      undefined,
      { hasUI: false, ui: {} } as never,
    );

    expect(result.details).toMatchObject({
      exchange_id: 'answer-source-broker',
      tool_meta: { prev: 'present_question', curr: REQUEST_ANSWER_TOOL },
      answered: { text: 'Use the live sidecar broker.' },
    });
  });

  it('records request_answer unavailable when no answer source exists', async () => {
    const request = registeredTools().get(REQUEST_ANSWER_TOOL);
    if (!request) throw new Error('request_answer was not registered');

    const result = await request.execute(
      'request-answer-unavailable-call',
      {
        exchangeId: 'answer-source-unavailable',
        respondsToPresentTool: 'present_question',
        prompt: 'What should answer?',
      },
      undefined,
      undefined,
      { hasUI: false, ui: {} } as never,
    );

    expect(result.details).toMatchObject({
      exchange_id: 'answer-source-unavailable',
      tool_meta: { prev: 'present_question', curr: REQUEST_ANSWER_TOOL },
      unavailable: { message: 'request_answer requires interactive UI' },
    });
  });

  it('persists a request_choice response without repeating the presented content', async () => {
    const request = registeredTools().get(REQUEST_CHOICE_TOOL);
    if (!request) throw new Error('request_choice was not registered');

    const result = await request.execute(
      'request-call-1',
      {
        exchangeId: 'shell-location',
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: 'Select one option.',
        choices: [
          { id: 'root', label: 'Keep src/pi-extensions.ts' },
          { id: 'tui', label: 'Move under src/tui-client' },
        ],
        allowOther: false,
        commentPrompt: 'Optional comment',
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          select: async () => 'Move under src/tui-client',
          input: async () => 'Aligns ownership with /reload iteration.',
        },
      } as never,
    );

    expect(result.content[0]?.text).toContain('### Response');
    expect(result.content[0]?.text).toContain('Move under src/tui-client');
    expect(result.content[0]?.text).not.toContain('Clearer ownership');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location',
      tool_meta: { prev: PRESENT_OPTIONS_TOOL, curr: REQUEST_CHOICE_TOOL },
      answered: {
        choice: { id: 'tui', label: 'Move under src/tui-client', kind: 'listed' },
        comment: 'Aligns ownership with /reload iteration.',
      },
    });
  });

  it('presents a dry-run-valid review-set payload as durable markdown and recoverable details', async () => {
    const present = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!present) throw new Error('present_review_set was not registered');

    const payload = validReviewPayload();
    const result = await present.execute(
      'present-review-call-1',
      { exchangeId: 'review-cycle-1', proposalEntryId: 'proposal-entry-1', payload },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toContain('## Review cycle wiring');
    expect(result.content[0]?.text).toContain('Epistemic status: inferred');
    expect(result.content[0]?.text).toContain('### Entity drafts');
    expect(result.content[0]?.text).toContain('Approval is atomic');
    expect(result.content[0]?.text).toContain('### Edge drafts');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'review-cycle-1',
      tool_meta: { curr: PRESENT_REVIEW_SET_TOOL, next: REQUEST_REVIEW_TOOL },
      review_set: {
        nodes: [{ draft_id: 'goal-review' }, { draft_id: 'req-approve' }],
        edges: [{ dependency: { draft_id: 'req-approve' }, dependent: { draft_id: 'goal-review' } }],
      },
    });
  });

  it('keeps structurally illegal review-set proposals non-reviewable', async () => {
    const present = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!present) throw new Error('present_review_set was not registered');

    const result = await present.execute(
      'present-review-call-bad',
      { exchangeId: 'review-cycle-bad', payload: { ...validReviewPayload(), epistemicStatus: undefined } },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.details).toMatchObject({ status: 'structural_illegal' });
    expect(isStructuredExchangePresentDetails(result.details)).toBe(false);
    expect(
      findIncompleteStructuredExchangePresents([
        { type: 'message', message: { role: 'toolResult', details: result.details } },
      ]),
    ).toEqual([]);
  });

  it('persists request_review approve, change-request, and reject responses', async () => {
    const request = registeredTools().get(REQUEST_REVIEW_TOOL);
    if (!request) throw new Error('request_review was not registered');

    for (const [selected, review, comment] of [
      ['Approve', 'approve', 'Looks right.'],
      ['Request changes', 'request_changes', 'Tighten the grounding.'],
      ['Reject', 'reject', 'Wrong direction.'],
    ] as const) {
      const result = await request.execute(
        `request-review-${review}`,
        { exchangeId: 'review-cycle-1', prompt: 'Review proposal' },
        undefined,
        undefined,
        { hasUI: true, ui: { select: async () => selected, input: async () => comment } } as never,
      );

      expect(result.content[0]?.text).toContain('### Review decision');
      expect(result.details).toMatchObject({
        exchange_id: 'review-cycle-1',
        tool_meta: { prev: PRESENT_REVIEW_SET_TOOL, curr: REQUEST_REVIEW_TOOL },
        answered: { decision: review, comment },
      });
    }
  });

  it('requires request_review change requests to carry a non-empty comment', async () => {
    const request = registeredTools().get(REQUEST_REVIEW_TOOL);
    if (!request) throw new Error('request_review was not registered');

    const result = await request.execute(
      'request-review-empty-change',
      { exchangeId: 'review-cycle-1', prompt: 'Review proposal' },
      undefined,
      undefined,
      { hasUI: true, ui: { select: async () => 'Request changes', input: async () => '   ' } } as never,
    );

    expect(result.details).toMatchObject({
      tool_meta: { curr: REQUEST_REVIEW_TOOL },
      unavailable: { message: 'request_review request_changes requires a comment' },
    });
  });

  it('records request_review cancellation and unavailable UI as terminal outcomes', async () => {
    const request = registeredTools().get(REQUEST_REVIEW_TOOL);
    if (!request) throw new Error('request_review was not registered');

    const cancelled = await request.execute(
      'request-review-cancelled',
      { exchangeId: 'review-cycle-1', prompt: 'Review proposal' },
      undefined,
      undefined,
      { hasUI: true, ui: { select: async () => undefined } } as never,
    );
    const unavailable = await request.execute(
      'request-review-unavailable',
      { exchangeId: 'review-cycle-1', prompt: 'Review proposal' },
      undefined,
      undefined,
      { hasUI: false, ui: {} } as never,
    );

    expect(cancelled.details).toMatchObject({ cancelled: {}, tool_meta: { curr: REQUEST_REVIEW_TOOL } });
    expect(unavailable.details).toMatchObject({ unavailable: {}, tool_meta: { curr: REQUEST_REVIEW_TOOL } });
    expect(isStructuredExchangeRequestDetails(cancelled.details)).toBe(true);
    expect(isStructuredExchangeRequestDetails(unavailable.details)).toBe(true);
  });

  it('persists a request_choices response through the editor fallback', async () => {
    const request = registeredTools().get(REQUEST_CHOICES_TOOL);
    if (!request) throw new Error('request_choices was not registered');

    const result = await request.execute(
      'request-choices-call-1',
      {
        exchangeId: 'priorities',
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: 'Select all priorities.',
        choices: [
          { id: 'speed', label: 'Move quickly' },
          { id: 'safety', label: 'Keep the transcript safe' },
        ],
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

    expect(result.content[0]?.text).toContain('### Response');
    expect(result.content[0]?.text).toContain('Move quickly');
    expect(result.content[0]?.text).toContain('Other');
    expect(result.content[0]?.text).toContain('Also keep the proof deterministic.');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      exchange_id: 'priorities',
      tool_meta: { prev: PRESENT_OPTIONS_TOOL, curr: REQUEST_CHOICES_TOOL },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'other', label: 'Other', kind: 'other' },
        ],
        comment: 'Also keep the proof deterministic.',
      },
    });
  });

  it('rejects request_choices other/none selections without a comment', async () => {
    const request = registeredTools().get(REQUEST_CHOICES_TOOL);
    if (!request) throw new Error('request_choices was not registered');

    const result = await request.execute(
      'request-choices-call-2',
      {
        exchangeId: 'priorities',
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: 'Select all priorities.',
        choices: [{ id: 'speed', label: 'Move quickly' }],
        allowOther: true,
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

    expect(result.details).toMatchObject({
      tool_meta: { curr: REQUEST_CHOICES_TOOL },
      unavailable: { message: 'request_choices requires a comment for Other or None selections' },
    });
    expect(result.content[0]?.text).toContain('request_choices requires a comment');
  });

  it('detects an unmatched present result for recovery', () => {
    const incomplete = findIncompleteStructuredExchangePresents([
      {
        type: 'message',
        message: {
          role: 'toolResult',
          details: {
            schema: 'brunch.structured_exchange.present',
            v: 1,
            exchange_id: 'shell-location',
            tool_meta: { curr: PRESENT_OPTIONS_TOOL, next: REQUEST_CHOICE_TOOL },
            display: { heading: 'Where should the shell live?' },
            options: [{ id: 'root', content: 'Keep src/pi-extensions.ts' }],
          },
        },
      },
    ]);

    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.details.exchange_id).toBe('shell-location');
  });
});
