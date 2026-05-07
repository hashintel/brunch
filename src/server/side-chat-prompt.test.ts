import { describe, expect, it } from 'vitest';

import {
  buildSideChatPrompt,
  type SideChatPinnedItem,
  type SideChatSpecContext,
} from './side-chat-prompt.js';

const baseItem = {
  kind: 'decision' as const,
  referenceCode: 'D12',
  content: 'Use SQLite for the local store.',
};

const baseSpecContext = {
  specName: 'Brunch',
  groundingSummary: 'A spec-elicitation tool aimed at solo product developers.',
};

describe('buildSideChatPrompt', () => {
  it('returns a system message naming the side-chat role', () => {
    const { system } = buildSideChatPrompt(baseItem, 'Why SQLite?', baseSpecContext);

    expect(system).toMatch(/side[- ]chat/i);
    expect(system.length).toBeGreaterThan(0);
  });

  it('puts the user message into a single user-role turn that carries the pinned referenceCode and content', () => {
    const { messages } = buildSideChatPrompt(baseItem, 'Why SQLite?', baseSpecContext);

    expect(messages).toHaveLength(1);
    const [userMessage] = messages;
    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toContain('D12');
    expect(userMessage.content).toContain('Use SQLite for the local store.');
    expect(userMessage.content).toContain('Why SQLite?');
  });

  it('includes the item rationale when present', () => {
    const itemWithRationale = {
      ...baseItem,
      rationale: 'Local-first, no server dependency.',
    };

    const { messages } = buildSideChatPrompt(itemWithRationale, 'Why?', baseSpecContext);

    expect(messages[0].content).toContain('Local-first, no server dependency.');
  });

  it('omits the rationale when null', () => {
    const itemWithoutRationale = { ...baseItem, rationale: null };

    const { messages } = buildSideChatPrompt(itemWithoutRationale, 'Why?', baseSpecContext);

    expect(messages[0].content).not.toMatch(/rationale/i);
  });

  it('omits the rationale when undefined', () => {
    const { messages } = buildSideChatPrompt(baseItem, 'Why?', baseSpecContext);

    expect(messages[0].content).not.toMatch(/rationale/i);
  });

  it('includes the spec name and grounding summary as background context', () => {
    const { system } = buildSideChatPrompt(baseItem, 'Why?', baseSpecContext);

    expect(system).toContain('Brunch');
    expect(system).toContain('A spec-elicitation tool aimed at solo product developers.');
  });

  it('keeps the spec context as background, not as the primary focus', () => {
    const { system, messages } = buildSideChatPrompt(baseItem, 'Why SQLite?', baseSpecContext);

    // The pinned item must appear in the user-message focus (the primary thing being discussed),
    // and the spec context must appear in the system background, not the user message.
    expect(messages[0].content).toContain('D12');
    expect(messages[0].content).not.toContain('A spec-elicitation tool aimed at solo product developers.');

    // The system prompt frames spec context with a backgrounding cue.
    expect(system).toMatch(/background|context/i);
  });

  it('does not inject interviewer phase-stage instructions', () => {
    const { system } = buildSideChatPrompt(baseItem, 'Why?', baseSpecContext);

    expect(system).not.toMatch(/grounding phase/i);
    expect(system).not.toMatch(/design phase/i);
    expect(system).not.toMatch(/requirements review/i);
    expect(system).not.toMatch(/criteria review/i);
    expect(system).not.toMatch(/ask_question/i);
    expect(system).not.toMatch(/propose_phase_closure/i);
    expect(system).not.toMatch(/you('re| are) (conducting|an interviewer)/i);
  });

  it('handles a grounding summary that is null or absent', () => {
    const { system: systemWithNull } = buildSideChatPrompt(baseItem, 'Why?', {
      specName: 'Brunch',
      groundingSummary: null,
    });
    const { system: systemWithUndefined } = buildSideChatPrompt(baseItem, 'Why?', { specName: 'Brunch' });

    expect(systemWithNull).toContain('Brunch');
    expect(systemWithUndefined).toContain('Brunch');
  });

  it('appends prior turns after the pinned-context user turn and ends with the new user message', () => {
    const { messages } = buildSideChatPrompt(baseItem, 'Follow-up: what about backups?', baseSpecContext, [
      { role: 'user', text: 'Why SQLite?' },
      { role: 'assistant', text: 'Because it ships in-process and needs no daemon.' },
    ]);

    expect(messages).toHaveLength(3);
    // First turn carries the pinned-item context
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('D12');
    expect(messages[0].content).toContain('Use SQLite for the local store.');
    expect(messages[0].content).toContain('Why SQLite?');
    // Middle turn is the assistant reply, plain text
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: 'Because it ships in-process and needs no daemon.',
    });
    // Final turn is the new user message, plain text (no re-injection of pinned context)
    expect(messages[2]).toEqual({
      role: 'user',
      content: 'Follow-up: what about backups?',
    });
    expect(messages[2].content).not.toContain('D12');
  });

  it('treats an empty history the same as no history', () => {
    const withEmpty = buildSideChatPrompt(baseItem, 'Why SQLite?', baseSpecContext, []);
    const withNone = buildSideChatPrompt(baseItem, 'Why SQLite?', baseSpecContext);

    expect(withEmpty).toEqual(withNone);
  });

  it('drops a trailing history user turn before appending the new user message', () => {
    const { messages } = buildSideChatPrompt(baseItem, 'Try again', baseSpecContext, [
      { role: 'user', text: 'Why SQLite?' },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('D12');
    expect(messages[0].content).not.toContain('Why SQLite?');
    expect(messages[0].content).toContain('Try again');
  });

  it('labels the item by its kind so the model knows what it is looking at', () => {
    const { messages } = buildSideChatPrompt(
      { kind: 'requirement', referenceCode: 'R3', content: 'Users can export specs as Markdown.' },
      'Should this include images?',
      baseSpecContext,
    );

    expect(messages[0].content).toMatch(/requirement/i);
    expect(messages[0].content).toContain('R3');
  });
});

const item: SideChatPinnedItem = {
  kind: 'decision',
  referenceCode: 'D7',
  content: 'Use SQLite.',
};
const spec: SideChatSpecContext = { specName: 'Demo' };

describe('buildSideChatPrompt — activeAnnotations', () => {
  it('appends a "User-pinned snippets" block to the system prompt when activeAnnotations are present', () => {
    const { system } = buildSideChatPrompt(item, 'hi', spec, [], {
      activeAnnotations: [
        { referenceCode: 'C1', snapshot: 'household', body: null },
        { referenceCode: 'D7', snapshot: 'Use SQLite', body: 'we considered libsql' },
      ],
    });
    expect(system).toContain('User-pinned snippets');
    expect(system).toContain('1. [C1]');
    expect(system).toContain('household');
    expect(system).toContain('2. [D7]');
    expect(system).toContain('we considered libsql');
  });

  it('does not add the block when activeAnnotations is empty', () => {
    const { system } = buildSideChatPrompt(item, 'hi', spec, [], { activeAnnotations: [] });
    expect(system).not.toContain('User-pinned snippets');
  });

  it('does not add the block when options is omitted', () => {
    const { system } = buildSideChatPrompt(item, 'hi', spec, []);
    expect(system).not.toContain('User-pinned snippets');
  });
});

describe('buildSideChatPrompt — spanHint', () => {
  it('prepends the span hint to the latest user message', () => {
    const { messages } = buildSideChatPrompt(item, 'tell me more', spec, [], {
      spanHint: 'household income',
    });
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')!;
    expect(lastUser.content).toContain('household income');
    expect(lastUser.content).toContain('tell me more');
  });

  it('applies spanHint to the current user message when history exists', () => {
    const { messages } = buildSideChatPrompt(
      item,
      'current question',
      spec,
      [
        { role: 'user', text: 'historical question' },
        { role: 'assistant', text: 'historical answer' },
      ],
      { spanHint: 'current phrase' },
    );

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toContain('historical question');
    expect(messages[0].content).not.toContain('current phrase');
    expect(messages[2]).toEqual({
      role: 'user',
      content: 'About the highlighted phrase «current phrase»: current question',
    });
  });

  it('does not modify messages when spanHint is absent', () => {
    const { messages } = buildSideChatPrompt(item, 'tell me more', spec, []);
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')!;
    expect(lastUser.content).not.toContain('About the highlighted phrase');
  });
});
