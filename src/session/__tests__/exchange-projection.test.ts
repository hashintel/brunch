import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import {
  loadJsonlTranscriptEntries,
  loadLinearSessionExchangeProjection,
  loadLinearTranscriptDisplayProjection,
  projectSessionExchanges,
  projectTranscriptDisplay,
} from '../exchange-projection.js';
import { createSessionBindingData } from '../session-binding.js';

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
      v: 1,
      exchange_id: 'domain',
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display: {
        heading: 'Domain?',
        body: 'What are we specifying?',
      },
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
      v: 1,
      exchange_id: 'domain',
      tool_meta: { prev: 'present_question', curr: 'request_answer' },
      answered: { text: 'Developer tooling' },
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
      exchange_id: 'other-domain',
    },
  },
};
const presentReviewSetToolResult = {
  id: 'present-review-set-1',
  type: 'message',
  parentId: null,
  message: {
    role: 'toolResult',
    toolCallId: 'present-review-call-1',
    toolName: 'present_review_set',
    content: [{ type: 'text', text: '## Review cycle wiring\n\nReview this graph proposal.' }],
    details: {
      schema: 'brunch.structured_exchange.present',
      v: 1,
      exchange_id: 'review-cycle',
      tool_meta: { curr: 'present_review_set', next: 'ask' },
      display: {
        heading: 'Review cycle wiring',
        body: 'Review this graph proposal.',
      },
      review_set: {
        nodes: [
          {
            draft_id: 'goal-review',
            proposed_code: 'G1',
            plane: 'intent',
            kind: 'goal',
            title: 'Review graph proposals',
          },
        ],
        edges: [],
      },
    },
    isError: false,
  },
};
const requestReviewToolResult = {
  id: 'request-review-1',
  type: 'message',
  parentId: 'present-review-set-1',
  message: {
    role: 'toolResult',
    toolCallId: 'request-review-call-1',
    toolName: 'request_review',
    content: [{ type: 'text', text: '### Review decision\n\nApproved.' }],
    details: {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'review-cycle',
      tool_meta: { prev: 'present_review_set', curr: 'request_review' },
      answered: { decision: 'approve' },
    },
    isError: false,
  },
};
const presentDigestToolResult = {
  id: 'present-digest-1',
  type: 'message',
  parentId: null,
  message: {
    role: 'toolResult',
    toolCallId: 'present-digest-call-1',
    toolName: 'present_digest',
    content: [{ type: 'text', text: '## Review source digest\n\nApprove this digest before mapping.' }],
    details: {
      schema: 'brunch.structured_exchange.present',
      v: 1,
      exchange_id: 'digest-cycle',
      tool_meta: { curr: 'present_digest', next: 'ask' },
      display: {
        heading: 'Review source digest',
        body: 'Approve this digest before mapping.',
      },
      digest: { abstract: 'The source asks for advisory capture before settlement.' },
    },
    isError: false,
  },
};
const requestDigestReviewToolResult = {
  id: 'request-digest-review-1',
  type: 'message',
  parentId: 'present-digest-1',
  message: {
    role: 'toolResult',
    toolCallId: 'request-digest-review-call-1',
    toolName: 'ask',
    content: [{ type: 'text', text: '### Review decision\n\nApproved.' }],
    details: {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'digest-cycle',
      tool_meta: { prev: 'present_digest', curr: 'request_review' },
      answered: {
        decision: 'approve',
        accepted_abstract: 'The source asks for advisory capture before settlement.',
      },
    },
    isError: false,
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
      v: 1,
      exchange_id: 'domain',
      tool_meta: { prev: 'present_question', curr: 'request_choices' },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'other', label: 'Other', kind: 'other' },
        ],
        options: [
          { id: 'speed', content: 'Move quickly' },
          { id: 'other', content: 'Other' },
        ],
        comment: 'Keep it deterministic.',
      },
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
    toolName: 'request_answer',
    content: [{ type: 'text', text: 'User answered: Developer tooling' }],
    details: {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'domain',
      tool_meta: { prev: 'present_question', curr: 'request_answer', next: 'capture_answer' },
      answered: { text: 'Developer tooling' },
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
    toolName: 'request_answer',
    content: [{ type: 'text', text: 'Structured exchange unavailable.' }],
    details: {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'domain',
      tool_meta: { prev: 'present_question', curr: 'request_answer' },
      unavailable: { message: 'Structured exchange UI is unavailable.' },
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

describe('session exchange projection', () => {
  it('projects assistant prompt spans and user response spans with stable ranges', () => {
    const exchanges = projectSessionExchanges([
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

  it('includes known standalone elicitor custom entries on the prompt side', () => {
    const projection = projectSessionExchanges([
      assistant,
      {
        id: 'offer-1',
        type: 'custom',
        customType: 'brunch.establishment_offer',
        data: { lens: 'intent' },
      },
      user,
    ]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1', 'offer-1']);
  });

  it('ignores unknown custom entries even when their type contains prompt', () => {
    const projection = projectSessionExchanges([
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
    const projection = projectSessionExchanges([assistant, user, structuredResponse]);

    expect(projection.exchanges[0]?.responseEntryIds).toEqual(['u1', 'r1']);
    expect(projection.exchanges[0]?.responseRange).toEqual({
      start: 'u1',
      end: 'r1',
    });
  });

  it('includes Pi toolResult messages on the prompt side', () => {
    const projection = projectSessionExchanges([assistant, toolResult, user]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['a1', 't1']);
    expect(projection.exchanges[0]?.promptRange).toEqual({
      start: 'a1',
      end: 't1',
    });
  });

  it('projects an unmatched present tool result as an open prompt', () => {
    const projection = projectSessionExchanges([presentQuestionToolResult]);

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
    const projection = projectSessionExchanges([presentQuestionToolResult, requestAnswerToolResult]);

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

  it('closes present_review_set only with the matching terminal request_review result', () => {
    const projection = projectSessionExchanges([presentReviewSetToolResult, requestReviewToolResult]);

    expect(projection).toMatchObject({
      status: 'ready',
      exchanges: [
        {
          promptEntryIds: ['present-review-set-1'],
          responseEntryIds: ['request-review-1'],
        },
      ],
      openPrompt: null,
    });
  });

  it('closes present_digest with the matching terminal request_review result', () => {
    const projection = projectSessionExchanges([presentDigestToolResult, requestDigestReviewToolResult]);

    expect(projection).toMatchObject({
      status: 'ready',
      exchanges: [
        {
          promptEntryIds: ['present-digest-1'],
          responseEntryIds: ['request-digest-review-1'],
        },
      ],
      openPrompt: null,
    });
  });

  it('does not close an open present with a mismatched request tuple', () => {
    const projection = projectSessionExchanges([
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
          toolName: 'present_question',
          details: {
            schema: 'brunch.structured_exchange.present',
            v: 1,
            exchange_id: 'domain',
            tool_meta: { curr: 'present_question', next: 'request_response' },
            response_kind: 'choices',
            display: { heading: 'Choose priorities' },
            options: [
              { id: 'speed', content: 'Move quickly' },
              { id: 'other', content: 'Other' },
            ],
          },
        },
      };
      const requestChoices = {
        ...requestChoicesToolResult,
        id: `request-choices-${status}`,
        message: {
          ...requestChoicesToolResult.message,
          details:
            status === 'answered'
              ? requestChoicesToolResult.message.details
              : {
                  schema: 'brunch.structured_exchange.request',
                  v: 1,
                  exchange_id: 'domain',
                  tool_meta: { prev: 'present_question', curr: 'request_choices' },
                  [status]: status === 'cancelled' ? {} : { message: 'request_choices unavailable' },
                },
        },
      };

      const projection = projectSessionExchanges([presentOptions, requestChoices]);

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
          exchange_id: 'other-domain',
        },
      },
    };
    const unexpectedRequestTool = {
      ...requestChoicesToolResult,
      id: 'request-choices-unexpected-tool',
      message: {
        ...requestChoicesToolResult.message,
        details: requestChoicesToolResult.message.details,
      },
    };

    for (const request of [wrongPresentToolRequest, unexpectedRequestTool]) {
      const projection = projectSessionExchanges([presentQuestionToolResult, request]);

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
    const projection = projectSessionExchanges([presentQuestionToolResult, structuredExchangeToolResult]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['present-question-1']);
    expect(projection.exchanges[0]?.responseEntryIds).toEqual(['sq1']);
    expect(projection.exchanges[0]?.responseRange).toEqual({
      start: 'sq1',
      end: 'sq1',
    });
    expect(projection.openPrompt).toBeNull();
  });

  it('classifies unavailable canonical request results as response-side entries', () => {
    const projection = projectSessionExchanges([
      presentQuestionToolResult,
      unavailableStructuredExchangeToolResult,
    ]);

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(['present-question-1']);
    expect(projection.exchanges[0]?.responseEntryIds).toEqual(['sq-unavailable']);
  });

  it('returns an explicit empty/open shape for incomplete transcripts', () => {
    expect(projectSessionExchanges([])).toEqual({
      status: 'empty',
      exchanges: [],
      openPrompt: null,
    });

    expect(projectSessionExchanges([assistant])).toEqual({
      status: 'open_prompt',
      exchanges: [],
      openPrompt: {
        promptRange: { start: 'a1', end: 'a1' },
        promptEntryIds: ['a1'],
      },
    });
  });

  it('ignores orphan user responses before a prompt', () => {
    const projection = projectSessionExchanges([
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

    const projection = await loadLinearSessionExchangeProjection(manager.getSessionFile()!);

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
      toolCallId: 'present-jsonl',
      toolName: 'present_question',
      content: [{ type: 'text', text: '## Domain?' }],
      details: {
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'jsonl-text',
        tool_meta: { curr: 'present_question', next: 'request_response' },
        response_kind: 'answer',
        display: { heading: 'Domain?' },
      },
      isError: false,
      timestamp: 0,
    });
    manager.appendMessage({
      role: 'toolResult',
      toolCallId: 'call-exchange-jsonl',
      toolName: 'ask',
      content: [{ type: 'text', text: 'User answered: Developer tooling' }],
      details: {
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'jsonl-text',
        tool_meta: { prev: 'present_question', curr: 'request_answer', next: 'capture_answer' },
        answered: { text: 'Developer tooling' },
      },
      isError: false,
      timestamp: 0,
    });

    const projection = await loadLinearSessionExchangeProjection(manager.getSessionFile()!);

    expect(projection.status).toBe('ready');
    expect(projection.exchanges).toHaveLength(1);
    expect(projection.exchanges[0]?.promptEntryIds).toHaveLength(2);
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

  it('projects only the active sibling exchange and excludes abandoned asks', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-helper-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    appendBinding(manager);
    const sharedPromptId = manager.appendMessage(assistantMessage('Choose a path'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.appendMessage(assistantMessage('Abandoned follow-up ask'));
    manager.branch(sharedPromptId);
    manager.appendMessage(userMessage('Selected answer'));

    const projection = await loadLinearSessionExchangeProjection(manager.getSessionFile()!);

    expect(projection).toMatchObject({
      status: 'ready',
      exchanges: [{ responseEntryIds: [expect.any(String)] }],
    });
    const activeEntries = await loadJsonlTranscriptEntries(manager.getSessionFile()!);
    expect(JSON.stringify(activeEntries)).not.toContain('Abandoned answer');
    expect(JSON.stringify(activeEntries)).not.toContain('Abandoned follow-up ask');
  });

  it('loads the selected sibling path from a Pi JSONL tree', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-pi-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    const sharedPromptId = manager.appendMessage(assistantMessage('Choose a path'));
    manager.appendMessage(userMessage('Old path'));
    manager.branch(sharedPromptId);
    manager.appendMessage(userMessage('Selected path'));

    const entries = await loadJsonlTranscriptEntries(manager.getSessionFile()!);
    expect(JSON.stringify(entries)).toContain('Selected path');
    expect(JSON.stringify(entries)).not.toContain('Old path');
  });

  it('delegates invalid header rejection to Pi SessionManager', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-jsonl-header-'));
    const headerlessFile = join(dir, 'headerless.jsonl');
    await writeFile(headerlessFile, `${JSON.stringify(assistant)}\n${JSON.stringify(user)}\n`);

    await expect(loadJsonlTranscriptEntries(headerlessFile)).rejects.toThrow(
      'Session file is not a valid pi session',
    );
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

    expect(projectSessionExchanges(entries).exchanges).toHaveLength(1);
  });
});
