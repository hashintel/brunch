import { describe, expect, it, vi } from 'vitest';

import { createDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import {
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
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
  renderShell?: string;
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

function pendingReviewSet(exchangeId: string, heading = 'Review proposal') {
  return [
    {
      type: 'message',
      message: {
        role: 'toolResult',
        details: {
          schema: 'brunch.structured_exchange.present',
          v: 1,
          exchange_id: exchangeId,
          tool_meta: { curr: PRESENT_REVIEW_SET_TOOL, next: REQUEST_RESPONSE_TOOL },
          display: { heading },
          review_set: {
            nodes: [
              { draft_id: 'req-approval', plane: 'intent', kind: 'requirement', title: 'Approval is atomic' },
            ],
            edges: [
              {
                category: 'dependency',
                dependency: { draft_id: 'req-approval' },
                dependent: { existing_code: 'G1' },
              },
            ],
          },
        },
      },
    },
  ];
}

describe('structured exchange present/request tools', () => {
  it('registers implemented present/request tools as sequential', () => {
    const tools = registeredTools();

    expect([...tools.keys()]).toEqual([
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      REQUEST_RESPONSE_TOOL,
    ]);
    expect(tools.get(PRESENT_QUESTION_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_REVIEW_SET_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(REQUEST_RESPONSE_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_QUESTION_TOOL)?.renderShell).toBe('self');
    expect(tools.get(PRESENT_REVIEW_SET_TOOL)?.renderShell).toBe('self');
    expect(tools.get(REQUEST_RESPONSE_TOOL)?.renderShell).toBe('self');
  });

  it('persists a freeform present_question result through the shared project and format seam', async () => {
    const present = registeredTools().get(PRESENT_QUESTION_TOOL);
    if (!present) throw new Error('present_question was not registered');

    const result = await present.execute(
      'present-question-freeform-call-1',
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
      "# What problem are we solving?

      Keep the answer grounded in current Brunch session behavior."
    `);
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'problem-frame',
      tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
      response_kind: 'answer',
      display: {
        heading: 'What problem are we solving?',
        body: 'Keep the answer grounded in current Brunch session behavior.',
      },
    });
  });

  it('persists a choice present_question result as markdown content plus recoverable details', async () => {
    const present = registeredTools().get(PRESENT_QUESTION_TOOL);
    if (!present) throw new Error('present_question was not registered');

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
      },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toContain('# Where should the shell live?');
    expect(result.content[0]?.text).toContain('Clearer ownership.');
    expect(result.content[0]?.text).not.toContain('<!--');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location',
      tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
      response_kind: 'choice',
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

  it('responds to a pending present_question through the UI editor using the presented prompt', async () => {
    const editor = vi.fn(async () => 'Answer collected by request_response.');
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-ui-call',
      { exchangeId: 'respond-question' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { editor },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'respond-question',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'answer',
                  display: { heading: 'What should request_response ask?', body: 'This body is context.' },
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(editor).toHaveBeenCalledWith('What should request_response ask?');
    expect(result.details).toMatchObject({
      exchange_id: 'respond-question',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_answer' },
      answered: { text: 'Answer collected by request_response.' },
    });
  });

  it('responds to a pending present_question through the live broker when no editor exists', async () => {
    const awaitAnswer = vi.fn(async () => 'Answer collected by broker.');
    const request_response = registeredTools({ liveExchange: { awaitAnswer } }).get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-broker-call',
      { exchangeId: 'respond-broker' },
      undefined,
      undefined,
      {
        hasUI: false,
        ui: {},
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'respond-broker',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'answer',
                  display: { heading: 'Answer from broker?' },
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(awaitAnswer).toHaveBeenCalledWith({ exchangeId: 'respond-broker' });
    expect(result.details).toMatchObject({ answered: { text: 'Answer collected by broker.' } });
  });

  it('records request_response cancellation and unknown/non-question diagnostics without throwing', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const cancelled = await request_response.execute(
      'request-response-cancelled-call',
      { exchangeId: 'respond-cancelled' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { editor: async () => undefined },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'respond-cancelled',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'answer',
                  display: { heading: 'Cancel this?' },
                },
              },
            },
          ],
        },
      } as never,
    );
    const unknown = await request_response.execute(
      'request-response-unknown-call',
      { exchangeId: 'missing' },
      undefined,
      undefined,
      { hasUI: false, ui: {}, sessionManager: { getBranch: () => [] } } as never,
    );
    const headlessChoice = await request_response.execute(
      'request-response-headless-choice-call',
      { exchangeId: 'options' },
      undefined,
      undefined,
      {
        hasUI: false,
        ui: {},
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'options',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choice',
                  display: { heading: 'Choose' },
                  options: [{ id: 'a', content: 'A' }],
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(cancelled.details).toMatchObject({ tool_meta: { curr: 'request_answer' }, cancelled: {} });
    expect(unknown.details).toMatchObject({ status: 'unavailable' });
    expect(headlessChoice.details).toMatchObject({
      unavailable: { message: 'request_response choice requires interactive UI' },
    });
  });

  it('offers request_response as the recovery continuation for unmatched present_question', () => {
    const incomplete = findIncompleteStructuredExchangePresents([
      {
        type: 'message',
        message: {
          role: 'toolResult',
          details: {
            schema: 'brunch.structured_exchange.present',
            v: 1,
            exchange_id: 'recover-answer',
            tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
            response_kind: 'answer',
            display: { heading: 'Recover this answer?' },
          },
        },
      },
    ]);

    expect(incomplete[0]?.continuationTool).toBe(REQUEST_RESPONSE_TOOL);
  });

  it('responds to a pending choice present_question without repeating the presented content', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-choice-call-1',
      { exchangeId: 'shell-location' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          select: async () => 'Move under src/tui-client',
          input: async () => 'Aligns ownership with /reload iteration.',
        },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'shell-location',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choice',
                  display: { heading: 'Select one option.' },
                  options: [
                    { id: 'root', content: 'Keep src/pi-extensions.ts' },
                    { id: 'tui', content: 'Move under src/tui-client' },
                  ],
                  comment_prompt: 'Optional comment',
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.content[0]?.text).toContain('# Response');
    expect(result.content[0]?.text).toContain('Move under src/tui-client');
    expect(result.content[0]?.text).not.toContain('Clearer ownership');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choice' },
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

    expect(result.content[0]?.text).toContain('# Review cycle wiring');
    expect(result.content[0]?.text).toContain('Epistemic status: inferred');
    expect(result.content[0]?.text).toContain('## Entity drafts');
    expect(result.content[0]?.text).toContain('Approval is atomic');
    expect(result.content[0]?.text).toContain('## Edge drafts');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'review-cycle-1',
      tool_meta: { curr: PRESENT_REVIEW_SET_TOOL, next: REQUEST_RESPONSE_TOOL },
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

  it('rejects a JSON-string review-set payload at the param boundary, not deep in the executor', async () => {
    // Regression: the live ship-gate run passed payload as a JSON-encoded string
    // (payload was z.unknown()), which slipped past the tool boundary and only
    // failed with an opaque "payload must be an object" deep in the executor.
    const present = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!present) throw new Error('present_review_set was not registered');

    await expect(
      present.execute(
        'present-review-string',
        { exchangeId: 'review-string', payload: JSON.stringify(validReviewPayload()) },
        undefined,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('rejects the mutate_graph {createBasis, ops} shape as a review-set payload', async () => {
    // Regression: same live run — the agent reached for the mutate_graph payload
    // shape; without schemaVersion it must fail at the param boundary.
    const present = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!present) throw new Error('present_review_set was not registered');

    await expect(
      present.execute(
        'present-review-wrong-shape',
        {
          exchangeId: 'review-wrong-shape',
          payload: { createBasis: 'explicit', ops: [{ op: 'create_node', kind: 'context' }] },
        },
        undefined,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('rejects malformed nested review-set companions at the param boundary', async () => {
    const present = registeredTools({ review: reviewDeps() }).get(PRESENT_REVIEW_SET_TOOL);
    if (!present) throw new Error('present_review_set was not registered');

    await expect(
      present.execute(
        'present-review-malformed-grounding',
        { exchangeId: 'review-malformed-grounding', payload: { ...validReviewPayload(), grounding: 'thin' } },
        undefined,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('drives request_response review decisions against a pending present_review_set', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    for (const [selected, review, comment] of [
      ['Approve', 'approve', 'Looks right.'],
      ['Request changes', 'request_changes', 'Tighten the grounding.'],
      ['Reject', 'reject', 'Wrong direction.'],
    ] as const) {
      const result = await request_response.execute(
        `request-response-review-${review}`,
        { exchangeId: 'review-cycle-1' },
        undefined,
        undefined,
        {
          hasUI: true,
          ui: { select: async () => selected, input: async () => comment },
          sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
        } as never,
      );

      expect(result.content[0]?.text).toContain('# Review decision');
      expect(result.details).toMatchObject({
        exchange_id: 'review-cycle-1',
        tool_meta: { prev: PRESENT_REVIEW_SET_TOOL, curr: 'request_review' },
        answered: { decision: review, comment },
      });
    }
  });

  it('requires request_response review change requests to carry a non-empty comment', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-review-empty-change',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { select: async () => 'Request changes', input: async () => '   ' },
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );

    expect(result.details).toMatchObject({
      tool_meta: { curr: 'request_review' },
      unavailable: { message: 'request_response review change request requires a comment' },
    });
  });

  it('records request_response review cancellation and unavailable UI as terminal outcomes', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const cancelled = await request_response.execute(
      'request-response-review-cancelled',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { select: async () => undefined },
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );
    const unavailable = await request_response.execute(
      'request-response-review-unavailable',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: false,
        ui: {},
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );

    expect(cancelled.details).toMatchObject({ cancelled: {}, tool_meta: { curr: 'request_review' } });
    expect(unavailable.details).toMatchObject({ unavailable: {}, tool_meta: { curr: 'request_review' } });
    expect(isStructuredExchangeRequestDetails(cancelled.details)).toBe(true);
    expect(isStructuredExchangeRequestDetails(unavailable.details)).toBe(true);
  });

  it('responds to a pending multi-choice present_question through a TUI custom picker', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');
    const editor = vi.fn();

    const result = await request_response.execute(
      'request-response-choices-custom-call-1',
      { exchangeId: 'priorities' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: async (factory: (...args: unknown[]) => unknown) => {
            let picked: unknown;
            const component = factory(null, theme, null, (result: unknown) => {
              picked = result;
            }) as { render(width: number): string[]; handleInput(data: string): void };
            expect(component.render(80).join('\n')).toContain('[ ] Move quickly');
            component.handleInput(' ');
            component.handleInput('\x1b[B');
            component.handleInput(' ');
            component.handleInput('\r');
            return picked;
          },
          input: async () => 'Speed is primary.',
          editor,
        },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'priorities',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choices',
                  display: { heading: 'Select all priorities.' },
                  options: [
                    { id: 'speed', content: 'Move quickly' },
                    { id: 'safety', content: 'Keep the transcript safe' },
                  ],
                  comment_prompt: 'If more than one, which is primary?',
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(editor).not.toHaveBeenCalled();
    expect(result.content[0]?.text).not.toContain('brunch.structured_exchange.request_choices.editor');
    expect(result.content[0]?.text).toContain('Move quickly');
    expect(result.content[0]?.text).toContain('Keep the transcript safe');
    expect(result.content[0]?.text).toContain('Speed is primary.');
    expect(result.details).toMatchObject({
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choices' },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'safety', label: 'Keep the transcript safe', kind: 'listed' },
        ],
        comment: 'Speed is primary.',
      },
    });
  });

  it('responds to a pending multi-choice present_question through the editor fallback', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-choices-call-1',
      { exchangeId: 'priorities' },
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
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'priorities',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choices',
                  display: { heading: 'Select all priorities.' },
                  options: [
                    { id: 'speed', content: 'Move quickly' },
                    { id: 'safety', content: 'Keep the transcript safe' },
                  ],
                  allow_other: true,
                  comment_prompt: 'Optional comment',
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.content[0]?.text).toContain('# Response');
    expect(result.content[0]?.text).toContain('Move quickly');
    expect(result.content[0]?.text).toContain('Other');
    expect(result.content[0]?.text).toContain('Also keep the proof deterministic.');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      exchange_id: 'priorities',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choices' },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'other', label: 'Other', kind: 'other' },
        ],
        comment: 'Also keep the proof deterministic.',
      },
    });
  });

  it('rejects request_response multi-choice other/none selections without a comment', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-choices-call-2',
      { exchangeId: 'priorities' },
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
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'priorities',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choices',
                  display: { heading: 'Select all priorities.' },
                  options: [{ id: 'speed', content: 'Move quickly' }],
                  allow_other: true,
                  allow_none: true,
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.details).toMatchObject({
      tool_meta: { curr: 'request_choices' },
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
            tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
            response_kind: 'choice',
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
