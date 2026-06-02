import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import {
  loadJsonlTranscriptEntries,
  loadLinearElicitationExchangeProjection,
  loadLinearTranscriptDisplayProjection,
  NonLinearTranscriptError,
  projectElicitationExchanges,
  projectTranscriptDisplay,
} from './elicitation-exchange.js';
import { createSessionBindingData } from './session-binding.js';
import { STRUCTURED_EXCHANGE_RESULT_SCHEMA } from './structured-exchange.js';
import { assistantMessage, userMessage } from './test-helpers.js';

const assistant = {
  id: 'a1',
  type: 'message',
  message: assistantMessage('Pick one'),
};
const structuredPrompt = {
  id: 'p1',
  type: 'custom',
  customType: 'brunch.elicitation_prompt',
  data: { choices: ['A', 'B'] },
};
const toolResult = {
  id: 't1',
  type: 'message',
  message: {
    role: 'toolResult',
    toolCallId: 'call-1',
    toolName: 'read',
    content: [{ type: 'text', text: 'tool output' }],
    isError: false,
  },
};
const presentQuestionToolResult = {
  id: 'present-question-1',
  type: 'message',
  parentId: null,
  message: {
    role: 'toolResult',
    toolCallId: 'present-call-1',
    toolName: 'present_question',
    content: [{ type: 'text', text: '## Domain?\n\nWhat are we specifying?' }],
    details: {
      schema: 'brunch.structured_exchange.present',
      schemaVersion: 1,
      exchangeId: 'domain',
      presentTool: 'present_question',
      kind: 'question',
      status: 'presented',
      expectedRequest: { tool: 'request_answer', required: true },
      createdAtToolCallId: 'present-call-1',
    },
    isError: false,
  },
};
const requestAnswerToolResult = {
  id: 'request-answer-1',
  type: 'message',
  parentId: 'present-question-1',
  message: {
    role: 'toolResult',
    toolCallId: 'request-call-1',
    toolName: 'request_answer',
    content: [{ type: 'text', text: '### Response\n\nDeveloper tooling' }],
    details: {
      schema: 'brunch.structured_exchange.request',
      schemaVersion: 1,
      exchangeId: 'domain',
      requestTool: 'request_answer',
      status: 'answered',
      respondsTo: { exchangeId: 'domain', presentTool: 'present_question' },
      answer: 'Developer tooling',
      createdAtToolCallId: 'request-call-1',
    },
    isError: false,
  },
};
const mismatchedRequestAnswerToolResult = {
  ...requestAnswerToolResult,
  id: 'request-answer-mismatch',
  message: {
    ...requestAnswerToolResult.message,
    details: {
      ...requestAnswerToolResult.message.details,
      exchangeId: 'other-domain',
      respondsTo: {
        exchangeId: 'other-domain',
        presentTool: 'present_question',
      },
    },
  },
};
const requestChoicesToolResult = {
  id: 'request-choices-1',
  type: 'message',
  parentId: 'present-options-1',
  message: {
    role: 'toolResult',
    toolCallId: 'request-call-choices-1',
    toolName: 'request_choices',
    content: [
      {
        type: 'text',
        text: '### Response\n\n- Move quickly\n- Other\n\nComment:\n\n> Keep it deterministic.',
      },
    ],
    details: {
      schema: 'brunch.structured_exchange.request',
      schemaVersion: 1,
      exchangeId: 'domain',
      requestTool: 'request_choices',
      status: 'answered',
      respondsTo: { exchangeId: 'domain', presentTool: 'present_options' },
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'other', label: 'Other' },
      ],
      comment: 'Keep it deterministic.',
      createdAtToolCallId: 'request-call-choices-1',
    },
    isError: false,
  },
};
const structuredExchangeToolResult = {
  id: 'sq1',
  type: 'message',
  message: {
    role: 'toolResult',
    toolCallId: 'call-exchange-1',
    toolName: 'structured_exchange',
    content: [{ type: 'text', text: 'User answered: Developer tooling' }],
    details: {
      schema: STRUCTURED_EXCHANGE_RESULT_SCHEMA,
      schemaVersion: 1,
      status: 'answered',
      question: 'Domain?',
      mode: 'text',
      answers: [
        {
          type: 'text',
          label: 'Developer tooling',
          value: 'Developer tooling',
        },
      ],
      transport: { surface: 'rpc-editor' },
    },
    isError: false,
  },
};
const unavailableStructuredExchangeToolResult = {
  id: 'sq-unavailable',
  type: 'message',
  message: {
    role: 'toolResult',
    toolCallId: 'call-exchange-2',
    toolName: 'structured_exchange',
    content: [{ type: 'text', text: 'Structured exchange unavailable.' }],
    details: {
      schema: STRUCTURED_EXCHANGE_RESULT_SCHEMA,
      schemaVersion: 1,
      status: 'unavailable',
      question: 'Domain?',
      mode: 'text',
      answers: [],
      transport: { surface: 'headless' },
      message: 'Structured exchange UI is unavailable.',
    },
    isError: false,
  },
};
const user = {
  id: 'u1',
  type: 'message',
  message: userMessage('A'),
};
const structuredResponse = {
  id: 'r1',
  type: 'custom',
  customType: 'brunch.elicitation_response',
  data: { choice: 'A' },
};

function appendBinding(manager: SessionManager): void {
  manager.appendCustomEntry(
    'brunch.session_binding',
    createSessionBindingData({
      specId: 1,
    }),
  );
}

describe('elicitation exchange projection', () => {
  it('projects assistant prompt spans and user response spans with stable ranges', () => {
    const exchanges = projectElicitationExchanges([
      { id: 's1', type: 'session' },
      assistant,
      structuredPrompt,
      user,
      {
        id: 'a2',
        type: 'message',
        message: assistantMessage('Why?'),
      },
      {
        id: 'u2',
        type: 'message',
        message: userMessage('Because'),
      },
    ]);

    expect(exchanges).toEqual({
      status: 'ready',
      exchanges: [
        {
          promptRange: { start: 'a1', end: 'p1' },
          responseRange: { start: 'u1', end: 'u1' },
          promptEntryIds: ['a1', 'p1'],
          responseEntryIds: ['u1'],
        },
        {
          promptRange: { start: 'a2', end: 'a2' },
          responseRange: { start: 'u2', end: 'u2' },
          promptEntryIds: ['a2'],
          responseEntryIds: ['u2'],
        },
      ],
      openPrompt: null,
    });
  });

  it('includes known elicitor custom entries on the prompt side', () => {
    const projection = projectElicitationExchanges([
      assistant,
      {
        id: 'offer-1',
        type: 'custom',
        customType: 'brunch.establishment_offer',
        data: { lens: 'step-by-step' },
      },
      {
        id: 'proposal-1',
        type: 'custom',
        customType: 'brunch.review_set_proposal',
        data: { lens: 'propose-scenarios-with-tradeoffs' },
      },
      user,
    ]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1', 'offer-1', 'proposal-1']);
  });

  it('ignores unknown custom entries even when their type contains prompt', () => {
    const projection = projectElicitationExchanges([
      assistant,
      {
        id: 'operational-1',
        type: 'custom',
        customType: 'brunch.operational_prompt_cache',
        data: {},
      },
      user,
    ]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1']);
  });

  it('includes structured response entries on the response side', () => {
    const projection = projectElicitationExchanges([assistant, user, structuredResponse]);

    expect(projection.exchanges[0]?.responseEntryIds).toEqual(['u1', 'r1']);
    expect(projection.exchanges[0]?.responseRange).toEqual({
      start: 'u1',
      end: 'r1',
    });
  });

  it('includes Pi toolResult messages on the prompt side', () => {
    const projection = projectElicitationExchanges([assistant, toolResult, user]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1', 't1']);
    expect(projection.exchanges[0]?.promptRange).toEqual({
      start: 'a1',
      end: 't1',
    });
  });

  it('projects an unmatched present tool result as an open prompt', () => {
    const projection = projectElicitationExchanges([presentQuestionToolResult]);

    expect(projection).toEqual({
      status: 'open_prompt',
      exchanges: [],
      openPrompt: {
        promptRange: { start: 'present-question-1', end: 'present-question-1' },
        promptEntryIds: ['present-question-1'],
      },
    });
  });

  it('closes a present/request structured-exchange tuple only when request details match', () => {
    const projection = projectElicitationExchanges([presentQuestionToolResult, requestAnswerToolResult]);

    expect(projection).toEqual({
      status: 'ready',
      exchanges: [
        {
          promptRange: {
            start: 'present-question-1',
            end: 'present-question-1',
          },
          responseRange: { start: 'request-answer-1', end: 'request-answer-1' },
          promptEntryIds: ['present-question-1'],
          responseEntryIds: ['request-answer-1'],
        },
      ],
      openPrompt: null,
    });
  });

  it('does not close an open present with a mismatched request tuple', () => {
    const projection = projectElicitationExchanges([
      presentQuestionToolResult,
      mismatchedRequestAnswerToolResult,
    ]);

    expect(projection.exchanges).toEqual([]);
    expect(projection.openPrompt?.promptEntryIds).toEqual(['present-question-1']);
  });

  it.each(['answered', 'cancelled', 'unavailable'] as const)(
    'closes present_options with a terminal %s request_choices result',
    (status) => {
      const presentOptions = {
        ...presentQuestionToolResult,
        id: 'present-options-1',
        message: {
          ...presentQuestionToolResult.message,
          toolName: 'present_options',
          details: {
            ...presentQuestionToolResult.message.details,
            presentTool: 'present_options',
            kind: 'options',
            expectedRequest: { tool: 'request_choices', required: true },
          },
        },
      };
      const requestChoices = {
        ...requestChoicesToolResult,
        id: `request-choices-${status}`,
        message: {
          ...requestChoicesToolResult.message,
          details: {
            ...requestChoicesToolResult.message.details,
            status,
          },
        },
      };

      const projection = projectElicitationExchanges([presentOptions, requestChoices]);

      expect(projection.exchanges[0]?.responseEntryIds).toEqual([`request-choices-${status}`]);
      expect(projection.openPrompt).toBeNull();
    },
  );

  it('does not close a present when request tuple identity or tool expectations mismatch', () => {
    const wrongPresentToolRequest = {
      ...requestAnswerToolResult,
      id: 'request-answer-wrong-present-tool',
      message: {
        ...requestAnswerToolResult.message,
        details: {
          ...requestAnswerToolResult.message.details,
          respondsTo: { exchangeId: 'domain', presentTool: 'present_options' },
        },
      },
    };
    const unexpectedRequestTool = {
      ...requestChoicesToolResult,
      id: 'request-choices-unexpected-tool',
      message: {
        ...requestChoicesToolResult.message,
        details: {
          ...requestChoicesToolResult.message.details,
          exchangeId: 'domain',
          respondsTo: {
            exchangeId: 'domain',
            presentTool: 'present_question',
          },
        },
      },
    };

    for (const request of [wrongPresentToolRequest, unexpectedRequestTool]) {
      const projection = projectElicitationExchanges([presentQuestionToolResult, request]);

      expect(projection.exchanges).toEqual([]);
      expect(projection.openPrompt?.promptEntryIds).toEqual(['present-question-1']);
    }
  });

  it('renders structured-exchange present/request tool markdown as transcript rows', () => {
    const projection = projectTranscriptDisplay([presentQuestionToolResult, requestAnswerToolResult]);

    expect(projection.rows).toEqual([
      {
        id: 'present-question-1',
        role: 'prompt',
        text: '## Domain?\n\nWhat are we specifying?',
      },
      {
        id: 'request-answer-1',
        role: 'user',
        text: '### Response\n\nDeveloper tooling',
      },
    ]);
  });

  it('classifies terminal structured-exchange tool results as response-side entries', () => {
    const projection = projectElicitationExchanges([assistant, structuredExchangeToolResult]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1']);
    expect(projection.exchanges[0]?.responseEntryIds).toEqual(['sq1']);
    expect(projection.exchanges[0]?.responseRange).toEqual({
      start: 'sq1',
      end: 'sq1',
    });
    expect(projection.openPrompt).toBeNull();
  });

  it('keeps non-terminal structured-exchange tool results on the prompt side', () => {
    const projection = projectElicitationExchanges([assistant, unavailableStructuredExchangeToolResult]);

    expect(projection.exchanges).toEqual([]);
    expect(projection.openPrompt?.promptEntryIds).toEqual(['a1', 'sq-unavailable']);
  });

  it('returns an explicit empty/open shape for incomplete transcripts', () => {
    expect(projectElicitationExchanges([])).toEqual({
      status: 'empty',
      exchanges: [],
      openPrompt: null,
    });

    expect(projectElicitationExchanges([assistant])).toEqual({
      status: 'open_prompt',
      exchanges: [],
      openPrompt: {
        promptRange: { start: 'a1', end: 'a1' },
        promptEntryIds: ['a1'],
      },
    });
  });

  it('ignores orphan user responses before a prompt', () => {
    const projection = projectElicitationExchanges([
      user,
      {
        id: 'a2',
        type: 'message',
        message: assistantMessage('Later prompt'),
      },
    ]);

    expect(projection).toEqual({
      status: 'open_prompt',
      exchanges: [],
      openPrompt: {
        promptRange: { start: 'a2', end: 'a2' },
        promptEntryIds: ['a2'],
      },
    });
  });

  it('loads and projects a real SessionManager JSONL assistant/user transcript through the product helper', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-jsonl-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    manager.appendMessage(assistantMessage('Question'));
    manager.appendMessage(userMessage('Answer'));

    const projection = await loadLinearElicitationExchangeProjection(manager.getSessionFile()!);

    expect(projection.status).toBe('ready');
    expect(projection.exchanges).toHaveLength(1);
    expect(projection.exchanges[0]?.promptEntryIds[0]).toEqual(expect.any(String));
    expect(projection.exchanges[0]?.responseEntryIds[0]).toEqual(expect.any(String));
  });

  it('loads and projects terminal structured-exchange tool results as JSONL responses', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-structured-exchange-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    manager.appendMessage(assistantMessage('Please answer the structured exchange.'));
    manager.appendMessage({
      role: 'toolResult',
      toolCallId: 'call-exchange-jsonl',
      toolName: 'structured_exchange',
      content: [{ type: 'text', text: 'User answered: Developer tooling' }],
      details: {
        schema: STRUCTURED_EXCHANGE_RESULT_SCHEMA,
        schemaVersion: 1,
        status: 'answered',
        question: 'Domain?',
        mode: 'text',
        answers: [
          {
            type: 'text',
            label: 'Developer tooling',
            value: 'Developer tooling',
          },
        ],
        transport: { surface: 'rpc-editor' },
      },
      isError: false,
      timestamp: 0,
    });

    const projection = await loadLinearElicitationExchangeProjection(manager.getSessionFile()!);

    expect(projection.status).toBe('ready');
    expect(projection.exchanges).toHaveLength(1);
    expect(projection.exchanges[0]?.promptEntryIds).toHaveLength(1);
    expect(projection.exchanges[0]?.responseEntryIds).toHaveLength(1);
  });

  it('loads displayable assistant and user transcript rows', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-display-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    manager.appendMessage(assistantMessage('Question'));
    manager.appendMessage(userMessage('Answer'));

    const projection = await loadLinearTranscriptDisplayProjection(manager.getSessionFile()!);

    expect(projection.rows).toEqual([
      { id: expect.any(String), role: 'assistant', text: 'Question' },
      { id: expect.any(String), role: 'user', text: 'Answer' },
    ]);
  });

  it('loads displayable elicitation prompt custom-message rows without operational custom entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-display-prompt-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    manager.appendCustomMessageEntry('brunch.elicitation_prompt', 'Choose the better framing.', true);
    manager.appendMessage(assistantMessage('Persistence sentinel'));
    manager.appendMessage(userMessage('Option A'));

    const projection = await loadLinearTranscriptDisplayProjection(manager.getSessionFile()!);

    expect(projection.rows).toEqual([
      {
        id: expect.any(String),
        role: 'prompt',
        text: 'Choose the better framing.',
      },
      {
        id: expect.any(String),
        role: 'assistant',
        text: 'Persistence sentinel',
      },
      { id: expect.any(String), role: 'user', text: 'Option A' },
    ]);
  });

  it('projects only text-bearing elicitation prompt custom messages as prompt display rows', () => {
    const projection = projectTranscriptDisplay([
      {
        id: 'binding-1',
        type: 'custom',
        parentId: null,
        customType: 'brunch.session_binding',
        data: { sessionId: 'session-1' },
      },
      {
        id: 'prompt-1',
        type: 'custom_message',
        parentId: 'binding-1',
        customType: 'brunch.elicitation_prompt',
        content: [{ type: 'text', text: 'Describe the user.' }],
        display: true,
      },
      {
        id: 'side-task-1',
        type: 'custom_message',
        parentId: 'prompt-1',
        customType: 'brunch.side_task_result',
        content: 'Operational note',
        display: true,
      },
    ]);

    expect(projection.rows).toEqual([{ id: 'prompt-1', role: 'prompt', text: 'Describe the user.' }]);
  });

  it('preserves the non-linear error discriminant through the product helper', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-helper-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    manager.appendMessage(assistantMessage('Abandoned prompt'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.resetLeaf();
    manager.appendMessage(assistantMessage('Active prompt'));

    await expect(loadLinearElicitationExchangeProjection(manager.getSessionFile()!)).rejects.toThrow(
      NonLinearTranscriptError,
    );
  });

  it('rejects a Pi JSONL file with multiple children from one parent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    manager.appendMessage(assistantMessage('Abandoned prompt'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.resetLeaf();
    manager.appendMessage(assistantMessage('Active prompt'));
    manager.appendMessage(userMessage('Active answer'));

    await expect(loadJsonlTranscriptEntries(manager.getSessionFile()!)).rejects.toThrow(
      NonLinearTranscriptError,
    );
  });

  it('rejects a Pi JSONL file with branched sibling responses', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    const sharedPromptId = manager.appendMessage(assistantMessage('Choose a path'));
    manager.appendMessage(userMessage('Old path'));
    manager.branch(sharedPromptId);
    manager.appendMessage(userMessage('Selected path'));

    await expect(loadJsonlTranscriptEntries(manager.getSessionFile()!)).rejects.toThrow(
      'non-linear Pi transcript branches',
    );
  });

  it('rejects branch-derived sessions and branch summaries before projection', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-jsonl-branch-derived-'));
    const branchDerivedFile = join(dir, 'branch-derived.jsonl');
    const branchSummaryFile = join(dir, 'branch-summary.jsonl');
    await writeFile(
      branchDerivedFile,
      `${JSON.stringify({
        type: 'session',
        version: 3,
        id: 'session-1',
        timestamp: '2026-05-21T00:00:00.000Z',
        cwd: dir,
        parentSession: '/tmp/parent.jsonl',
      })}\n`,
    );
    await writeFile(
      branchSummaryFile,
      `${JSON.stringify({ type: 'session', id: 'session-1', cwd: dir })}\n${JSON.stringify({
        id: 'b1',
        type: 'branch_summary',
        parentId: null,
        timestamp: '2026-05-21T00:00:00.000Z',
        fromId: 'a1',
        summary: 'Branch summary',
      })}\n`,
    );

    await expect(loadJsonlTranscriptEntries(branchDerivedFile)).rejects.toThrow('branch-derived Pi sessions');
    await expect(loadJsonlTranscriptEntries(branchSummaryFile)).rejects.toThrow(
      'branch-summary transcript entries',
    );
  });

  it('rejects file-backed transcripts without exactly one Pi session header', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-jsonl-header-'));
    const headerlessFile = join(dir, 'headerless.jsonl');
    const duplicateHeaderFile = join(dir, 'duplicate-header.jsonl');
    const header = { type: 'session', id: 'session-1', cwd: dir };
    await writeFile(headerlessFile, `${JSON.stringify(assistant)}\n${JSON.stringify(user)}\n`);
    await writeFile(
      duplicateHeaderFile,
      `${JSON.stringify(header)}\n${JSON.stringify(header)}\n${JSON.stringify({
        ...assistant,
        parentId: null,
      })}\n`,
    );

    await expect(loadJsonlTranscriptEntries(headerlessFile)).rejects.toThrow('exactly one Pi session header');
    await expect(loadJsonlTranscriptEntries(duplicateHeaderFile)).rejects.toThrow(
      'exactly one Pi session header',
    );
  });

  it('rejects malformed non-header Pi JSONL entries before projection', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-jsonl-shape-'));
    const file = join(dir, 'malformed.jsonl');
    const header = { type: 'session', id: 'session-1', cwd: dir };
    await writeFile(
      file,
      `${JSON.stringify(header)}\n${JSON.stringify({ ...assistant, parentId: null })}\n${JSON.stringify({
        id: 'u1',
        type: 'message',
        message: userMessage('A'),
      })}\n`,
    );

    await expect(loadJsonlTranscriptEntries(file)).rejects.toThrow('string-or-null parentId');
  });

  it('loads newline-delimited Pi transcript entries from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-jsonl-'));
    const file = join(dir, 'session.jsonl');
    const header = { type: 'session', id: 'session-1', cwd: dir };
    await writeFile(
      file,
      `${JSON.stringify(header)}\n${JSON.stringify({
        ...assistant,
        parentId: null,
      })}\n${JSON.stringify({ ...user, parentId: 'a1' })}\n`,
    );

    const entries = await loadJsonlTranscriptEntries(file);

    expect(projectElicitationExchanges(entries).exchanges).toHaveLength(1);
  });
});
