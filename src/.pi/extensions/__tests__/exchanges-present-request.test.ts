import { describe, expect, it, vi } from 'vitest';

import { createDb } from '../../../db/connection.js';
import {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from '../../../exchanges/recovery.js';
import { CommandExecutor } from '../../../graph/command-executor.js';
import {
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
    },
    meta_rubric: {},
    graph_refs: [{ node_id: `${id}-node` }],
  };
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

function pendingDigest(exchangeId: string, heading = 'Review source digest') {
  return [
    {
      type: 'message',
      message: {
        role: 'toolResult',
        details: {
          schema: 'brunch.structured_exchange.present',
          v: 1,
          exchange_id: exchangeId,
          tool_meta: { curr: PRESENT_DIGEST_TOOL, next: REQUEST_RESPONSE_TOOL },
          display: { heading },
          digest: {
            abstract: 'The source says summarize before graph mapping.',
            analysis: 'The digest is advisory input, not graph truth.',
          },
        },
      },
    },
  ];
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
              {
                draft_id: 'req-approval',
                proposed_code: 'REQ1',
                plane: 'intent',
                kind: 'requirement',
                title: 'Approval is atomic',
              },
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

describe('structured exchange present/request tools', () => {
  it('registers implemented present/request tools as sequential', () => {
    const tools = registeredTools();

    expect([...tools.keys()]).toEqual([
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      PRESENT_DIGEST_TOOL,
      REQUEST_RESPONSE_TOOL,
    ]);
    expect(tools.get(PRESENT_QUESTION_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_REVIEW_SET_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_CANDIDATES_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_DIGEST_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(REQUEST_RESPONSE_TOOL)?.executionMode).toBe('sequential');
    expect(tools.get(PRESENT_QUESTION_TOOL)?.renderShell).toBe('self');
    expect(tools.get(PRESENT_REVIEW_SET_TOOL)?.renderShell).toBe('self');
    expect(tools.get(PRESENT_CANDIDATES_TOOL)?.renderShell).toBe('self');
    expect(tools.get(PRESENT_DIGEST_TOOL)?.renderShell).toBe('self');
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
      "## Question: What problem are we solving?

      > Keep the answer grounded in current Brunch session behavior."
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

    expect(result.content[0]?.text).toContain('## Question: Where should the shell live?');
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

    const select = vi.fn(async () => 'A');
    const noCustomChoice = await request_response.execute(
      'request-response-no-custom-choice-call',
      { exchangeId: 'options' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { select },
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
    // User cancel terminates the turn (inert wait); unavailable stays
    // reactive so the model can reroute.
    expect(cancelled.terminate).toBe(true);
    expect(unknown.details).toMatchObject({ status: 'unavailable' });
    expect(unknown.terminate).toBeUndefined();
    expect(headlessChoice.details).toMatchObject({
      unavailable: { message: 'request_response choice requires interactive UI' },
    });
    expect(headlessChoice.terminate).toBeUndefined();
    expect(noCustomChoice.details).toMatchObject({
      unavailable: { message: 'request_response choice requires interactive UI' },
    });
    expect(select).not.toHaveBeenCalled();
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
          custom: customPickByIndex(1),
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

    expect(result.content[0]?.text).toContain('## Answer');
    expect(result.content[0]?.text).toContain('Move under src/tui-client');
    expect(result.content[0]?.text).toContain('~~1. __Keep src/pi-extensions.ts__~~');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choice' },
      answered: {
        choice: { id: 'tui', label: 'Move under src/tui-client', kind: 'listed' },
        options: [
          { id: 'root', content: 'Keep src/pi-extensions.ts' },
          { id: 'tui', content: 'Move under src/tui-client' },
        ],
        comment: 'Aligns ownership with /reload iteration.',
      },
    });
  });

  it('records an Other choice label without duplicating it as the comment', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');
    const input = vi.fn(async () =>
      input.mock.calls.length === 1 ? 'Something else entirely' : 'Needs a custom path.',
    );

    const result = await request_response.execute(
      'request-response-choice-other-call',
      { exchangeId: 'shell-location-other' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customPickByIndex(1),
          input,
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
                  exchange_id: 'shell-location-other',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choice',
                  display: { heading: 'Select one option.' },
                  options: [{ id: 'root', content: 'Keep src/pi-extensions.ts' }],
                  allow_other: true,
                  comment_prompt: 'Optional comment',
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.content[0]?.text).toContain('- [x] *Other:* Something else entirely');
    expect(result.content[0]?.text).toContain('> Needs a custom path.');
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location-other',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choice' },
      answered: {
        choice: { id: 'other', label: 'Something else entirely', kind: 'other' },
        options: [{ id: 'root', content: 'Keep src/pi-extensions.ts' }],
        comment: 'Needs a custom path.',
      },
    });
    expect(result.details.answered.comment).not.toBe('Something else entirely');
  });

  it('records a single-choice None selection with its required comment and no write-in', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');
    const inputPrompts: string[] = [];

    const result = await request_response.execute(
      'request-response-choice-none-call',
      { exchangeId: 'shell-location-none' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          // options: [root] + Other + None -> None sits at picker index 2.
          custom: customPickByIndex(2),
          input: async (prompt: string) => {
            inputPrompts.push(prompt);
            return 'No listed option fits this session.';
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
                  exchange_id: 'shell-location-none',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choice',
                  display: { heading: 'Select one option.' },
                  options: [{ id: 'root', content: 'Keep src/pi-extensions.ts' }],
                  allow_other: true,
                  allow_none: true,
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(inputPrompts).toEqual(['Required comment']);
    expect(result.details).toMatchObject({
      exchange_id: 'shell-location-none',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choice' },
      answered: {
        choice: { id: 'none', label: 'None', kind: 'none' },
        options: [{ id: 'root', content: 'Keep src/pi-extensions.ts' }],
        comment: 'No listed option fits this session.',
      },
    });
  });

  it('maps duplicate present_question option labels back to the selected stable id', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const select = vi.fn(async () => '2. Repeat label');
    const custom = customPickByIndex(1);
    const result = await request_response.execute(
      'request-response-duplicate-choice-call',
      { exchangeId: 'duplicate-options' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom, select },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'duplicate-options',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choice',
                  display: { heading: 'Select one option.' },
                  options: [
                    { id: 'first-option', content: 'Repeat label' },
                    { id: 'second-option', content: 'Repeat label' },
                  ],
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(custom).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      exchange_id: 'duplicate-options',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choice' },
      answered: {
        choice: { id: 'second-option', label: 'Repeat label', kind: 'listed' },
      },
    });
  });

  it('presents candidates as durable markdown and recoverable details without graph dependencies', async () => {
    const present = registeredTools().get(PRESENT_CANDIDATES_TOOL);
    if (!present) throw new Error('present_candidates was not registered');

    const result = await present.execute(
      'present-candidates-call-1',
      {
        exchangeId: 'candidate-direction',
        heading: 'Which direction should we take?',
        body: 'Pick one candidate.',
        candidates: [
          {
            id: 'local-workbench',
            title: 'Local workbench',
            user_rubric: {
              core_bet: 'Make local graph work the thesis.',
              best_fit: 'Keeps the POC focused.',
              cost_complexity: 'Requires owning local state clearly.',
              covers_well: 'Covers chrome, transcript, and graph coherence.',
              main_risks: 'Does not solve cloud collaboration.',
              lock_in_constraints: 'Commits to local-first semantics.',
              recommendation: 'Choose this for the POC.',
            },
            meta_rubric: { commitment: 'Defers cloud concerns.' },
            graph_refs: [{ node_id: 'node-1' }],
          },
        ],
      },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toContain('# Which direction should we take?');
    expect(result.content[0]?.text).toContain('## 1. Local workbench');
    expect(result.content[0]?.text).toContain('**Core bet:** Make local graph work the thesis.');
    expect(result.content[0]?.text).not.toContain('Defers cloud concerns.');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'candidate-direction',
      tool_meta: { curr: PRESENT_CANDIDATES_TOOL, next: REQUEST_RESPONSE_TOOL },
      candidates: [{ id: 'local-workbench', graph_refs: [{ node_id: 'node-1' }] }],
    });
    expect(result.details).not.toHaveProperty('review_set');
  });

  it('presents digest as durable markdown and recoverable prose-only details', async () => {
    const present = registeredTools().get(PRESENT_DIGEST_TOOL);
    if (!present) throw new Error('present_digest was not registered');

    const result = await present.execute(
      'present-digest-call-1',
      {
        exchangeId: 'digest-large-source',
        heading: 'Review source digest',
        body: 'Approve this before graph mapping.',
        digest: {
          abstract: 'The source says summarize before graph mapping.',
          analysis: 'The digest is advisory input, not graph truth.',
          recommendation: 'Approve after checking source fidelity.',
        },
      },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.text).toContain('# Review source digest');
    expect(result.content[0]?.text).toContain('## Abstract');
    expect(result.content[0]?.text).toContain('The source says summarize before graph mapping.');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'digest-large-source',
      tool_meta: { curr: PRESENT_DIGEST_TOOL, next: REQUEST_RESPONSE_TOOL },
      digest: { abstract: 'The source says summarize before graph mapping.' },
    });
    expect(result.details).not.toHaveProperty('review_set');
    expect(result.details).not.toHaveProperty('candidates');
  });

  it('responds to pending present_candidates as a candidate pick, not a graph write', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-candidate-call-1',
      { exchangeId: 'candidate-direction' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(0) },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'candidate-direction',
                  tool_meta: { curr: PRESENT_CANDIDATES_TOOL, next: REQUEST_RESPONSE_TOOL },
                  display: { heading: 'Which direction should we take?' },
                  candidates: [
                    {
                      id: 'local-workbench',
                      title: 'Local workbench',
                      user_rubric: {
                        core_bet: 'Make local graph work the thesis.',
                        best_fit: 'Keeps the POC focused.',
                        cost_complexity: 'Requires owning local state clearly.',
                        covers_well: 'Covers chrome, transcript, and graph coherence.',
                        main_risks: 'Does not solve cloud collaboration.',
                        lock_in_constraints: 'Commits to local-first semantics.',
                      },
                      meta_rubric: {},
                      graph_refs: [{ node_id: 'node-1' }],
                    },
                  ],
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.content[0]?.text).toContain('- [x] 1. __Local workbench__');
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'candidate-direction',
      tool_meta: { prev: PRESENT_CANDIDATES_TOOL, curr: 'request_choice', next: 'capture_candidate' },
      answered: {
        choice: { id: 'local-workbench', label: 'Local workbench', kind: 'listed' },
        options: [{ id: 'local-workbench', content: 'Local workbench' }],
      },
    });
    expect(result.details).not.toHaveProperty('review_set');
  });

  it('maps duplicate candidate titles back to the selected candidate id', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const select = vi.fn(async () => '2. Same direction');
    const custom = customPickByIndex(1);
    const result = await request_response.execute(
      'request-response-duplicate-candidate-call',
      { exchangeId: 'duplicate-candidates' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom, select },
        sessionManager: {
          getBranch: () => [
            {
              type: 'message',
              message: {
                role: 'toolResult',
                details: {
                  schema: 'brunch.structured_exchange.present',
                  v: 1,
                  exchange_id: 'duplicate-candidates',
                  tool_meta: { curr: PRESENT_CANDIDATES_TOOL, next: REQUEST_RESPONSE_TOOL },
                  display: { heading: 'Which direction should we take?' },
                  candidates: [
                    candidateDetails('first-candidate', 'Same direction'),
                    candidateDetails('second-candidate', 'Same direction'),
                  ],
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(custom).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      exchange_id: 'duplicate-candidates',
      tool_meta: { prev: PRESENT_CANDIDATES_TOOL, curr: 'request_choice', next: 'capture_candidate' },
      answered: {
        choice: { id: 'second-candidate', label: 'Same direction', kind: 'listed' },
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

    expect(result.content[0]?.text).toContain('## Proposal: Review cycle wiring');
    expect(result.content[0]?.text).toContain(
      '> Commit review-set approvals as explicit graph truth only after user review.',
    );
    expect(result.content[0]?.text).toContain('__$REQ1: Approval is atomic__');
    expect(result.content[0]?.text).toContain('depends on __$REQ1__');
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true);
    expect(result.details).toMatchObject({
      exchange_id: 'review-cycle-1',
      tool_meta: { curr: PRESENT_REVIEW_SET_TOOL, next: REQUEST_RESPONSE_TOOL },
      review_set: {
        nodes: [
          { draft_id: 'goal-review', proposed_code: 'G1' },
          { draft_id: 'req-approve', proposed_code: 'REQ1' },
        ],
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

    for (const [_selected, review, comment] of [
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
          ui: {
            custom: customPickByIndex(['approve', 'request_changes', 'reject'].indexOf(review)),
            input: async () => comment,
          },
          sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
        } as never,
      );

      expect(result.content[0]?.text).toContain('## Review:');
      expect(result.details).toMatchObject({
        exchange_id: 'review-cycle-1',
        tool_meta: { prev: PRESENT_REVIEW_SET_TOOL, curr: 'request_review' },
        answered: { decision: review, comment },
      });
    }
  });

  it('drives request_response digest review decisions and echoes accepted abstract', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    for (const [_selected, review, comment] of [
      ['Approve', 'approve', 'Looks right.'],
      ['Request changes', 'request_changes', 'Tighten the source limitation.'],
      ['Reject', 'reject', 'Wrong direction.'],
    ] as const) {
      const result = await request_response.execute(
        `request-response-digest-${review}`,
        { exchangeId: 'digest-large-source' },
        undefined,
        undefined,
        {
          hasUI: true,
          ui: {
            custom: customPickByIndex(['approve', 'request_changes', 'reject'].indexOf(review)),
            input: async () => comment,
          },
          sessionManager: { getBranch: () => pendingDigest('digest-large-source') },
        } as never,
      );

      expect(result.content[0]?.text).toContain('## Review:');
      expect(result.details).toMatchObject({
        exchange_id: 'digest-large-source',
        tool_meta: { prev: PRESENT_DIGEST_TOOL, curr: 'request_review' },
        answered: { decision: review, comment },
      });
      if (review === 'approve') {
        expect(result.details).toMatchObject({
          answered: { accepted_abstract: 'The source says summarize before graph mapping.' },
        });
      }
    }
  });

  it('records request_response digest cancellation and unavailable UI as terminal outcomes without next', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const cancelled = await request_response.execute(
      'request-response-digest-cancelled',
      { exchangeId: 'digest-large-source' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customCancel() },
        sessionManager: { getBranch: () => pendingDigest('digest-large-source') },
      } as never,
    );
    const unavailable = await request_response.execute(
      'request-response-digest-unavailable',
      { exchangeId: 'digest-large-source' },
      undefined,
      undefined,
      {
        hasUI: false,
        ui: {},
        sessionManager: { getBranch: () => pendingDigest('digest-large-source') },
      } as never,
    );

    expect(cancelled.details.tool_meta).toEqual({ prev: PRESENT_DIGEST_TOOL, curr: 'request_review' });
    expect(unavailable.details.tool_meta).toEqual({ prev: PRESENT_DIGEST_TOOL, curr: 'request_review' });
    expect(isStructuredExchangeRequestDetails(cancelled.details)).toBe(true);
    expect(isStructuredExchangeRequestDetails(unavailable.details)).toBe(true);
  });

  it('re-prompts empty review change-request comments and cancels on dismissal', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');
    const prompts: string[] = [];

    const result = await request_response.execute(
      'request-response-review-empty-change',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          custom: customPickByIndex(1),
          input: async (prompt: string) => {
            prompts.push(prompt);
            return prompts.length === 1 ? '   ' : 'Tighten the grounding.';
          },
        },
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );

    expect(prompts).toEqual([
      'Required change request',
      'Required change request (required — cannot be empty)',
    ]);
    expect(result.details).toMatchObject({
      tool_meta: { curr: 'request_review' },
      answered: { decision: 'request_changes', comment: 'Tighten the grounding.' },
    });

    const dismissed = await request_response.execute(
      'request-response-review-dismissed-change',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { custom: customPickByIndex(1), input: async () => undefined },
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );

    expect(dismissed.details).toMatchObject({
      tool_meta: { curr: 'request_review' },
      cancelled: {},
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
        ui: { custom: customCancel() },
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
    const select = vi.fn(async () => 'Approve');
    const noCustom = await request_response.execute(
      'request-response-review-no-custom',
      { exchangeId: 'review-cycle-1' },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { select },
        sessionManager: { getBranch: () => pendingReviewSet('review-cycle-1') },
      } as never,
    );

    expect(cancelled.details).toMatchObject({ cancelled: {}, tool_meta: { curr: 'request_review' } });
    expect(cancelled.terminate).toBe(true);
    expect(unavailable.details).toMatchObject({ unavailable: {}, tool_meta: { curr: 'request_review' } });
    expect(unavailable.terminate).toBeUndefined();
    expect(noCustom.details).toMatchObject({ unavailable: {}, tool_meta: { curr: 'request_review' } });
    expect(select).not.toHaveBeenCalled();
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

  it('collects the Other write-in text when the custom picker selects Other', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');
    const inputPrompts: string[] = [];

    const result = await request_response.execute(
      'request-response-choices-custom-other-call',
      { exchangeId: 'priorities-other' },
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
            component.handleInput('\x1b[B');
            component.handleInput('\x1b[B');
            component.handleInput(' ');
            component.handleInput('\r');
            return picked;
          },
          input: async (prompt: string) => {
            inputPrompts.push(prompt);
            if (inputPrompts.length === 1) return '   ';
            if (inputPrompts.length === 2) return 'Ship it behind a CLI flag';
            return 'None of the listed options fit.';
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
                  exchange_id: 'priorities-other',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choices',
                  display: { heading: 'Select all priorities.' },
                  options: [
                    { id: 'speed', content: 'Move quickly' },
                    { id: 'safety', content: 'Keep the transcript safe' },
                  ],
                  allow_other: true,
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(inputPrompts).toEqual(['Other', 'Other (required — cannot be empty)', 'Required comment']);
    expect(result.details).toMatchObject({
      exchange_id: 'priorities-other',
      tool_meta: { prev: PRESENT_QUESTION_TOOL, curr: 'request_choices' },
      answered: {
        choices: [{ id: 'other', label: 'Ship it behind a CLI flag', kind: 'other' }],
        comment: 'None of the listed options fit.',
      },
    });
  });

  it('cancels the custom-picker choices response when the Other write-in is dismissed', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-choices-custom-other-empty-call',
      { exchangeId: 'priorities-other-empty' },
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
            component.handleInput('\x1b[B');
            component.handleInput('\x1b[B');
            component.handleInput(' ');
            component.handleInput('\r');
            return picked;
          },
          input: async () => undefined,
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
                  exchange_id: 'priorities-other-empty',
                  tool_meta: { curr: PRESENT_QUESTION_TOOL, next: REQUEST_RESPONSE_TOOL },
                  response_kind: 'choices',
                  display: { heading: 'Select all priorities.' },
                  options: [
                    { id: 'speed', content: 'Move quickly' },
                    { id: 'safety', content: 'Keep the transcript safe' },
                  ],
                  allow_other: true,
                },
              },
            },
          ],
        },
      } as never,
    );

    expect(result.details).toMatchObject({
      exchange_id: 'priorities-other-empty',
      tool_meta: { curr: 'request_choices' },
      cancelled: {},
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

    expect(result.content[0]?.text).toContain('## Answer');
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
        options: [
          { id: 'speed', content: 'Move quickly' },
          { id: 'safety', content: 'Keep the transcript safe' },
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

  it('rejects request_response multi-choice None combined with other selections', async () => {
    const request_response = registeredTools().get(REQUEST_RESPONSE_TOOL);
    if (!request_response) throw new Error('request_response was not registered');

    const result = await request_response.execute(
      'request-response-choices-none-combined-call',
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
                { id: 'none', label: 'None' },
              ],
              comment: 'Contradictory selection.',
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
      unavailable: { message: 'request_choices cannot combine None with other selections' },
    });
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
