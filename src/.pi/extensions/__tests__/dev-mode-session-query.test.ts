import { readFile } from 'node:fs/promises';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { createBrunchFauxHarness } from '../../../dev/index.js';
import {
  BRUNCH_SESSION_QUERY_TOOL,
  createBrunchSessionQueryTool,
  querySessionBranch,
  registerBrunchSessionQuery,
  zBrunchSessionQueryParams,
} from '../dev-mode/session-query/index.js';
import { toolParameters } from '../shared/tool-schema.js';

const branch = [
  messageEntry('u1', { role: 'user', content: 'show me the graph summary' }),
  messageEntry('a1', {
    role: 'assistant',
    content: [
      { type: 'text', text: 'I will inspect it.' },
      { type: 'toolCall', id: 'call-1', name: 'read_graph', arguments: { specId: 42 } },
    ],
  }),
  messageEntry('t1', {
    role: 'toolResult',
    toolCallId: 'call-1',
    toolName: 'read_graph',
    content: [{ type: 'text', text: 'GRAPH EXACT VALUE' }],
    details: { review: { status: 'clear' } },
    isError: false,
  }),
  messageEntry('c1', {
    role: 'custom',
    customType: 'structured-exchange',
    content: [{ type: 'text', text: 'option alpha' }],
    details: { x: 'alpha' },
  }),
  messageEntry('c2', {
    role: 'custom',
    customType: 'structured-exchange',
    content: [{ type: 'text', text: 'option beta' }],
    details: { x: 'beta' },
  }),
  messageEntry('b1', {
    role: 'bashExecution',
    command: 'npm test',
    output: 'all green',
    exitCode: 0,
    cancelled: false,
    truncated: false,
  }),
];

describe('brunch_session_query', () => {
  it('finds entries by role, toolName, customType, and contains predicates', () => {
    expect(querySessionBranch(branch, { find: { role: 'toolResult', toolName: 'read_graph' } })).toEqual([
      expect.objectContaining({
        ref: expect.objectContaining({ id: 't1', role: 'toolResult', toolName: 'read_graph' }),
      }),
    ]);
    expect(
      querySessionBranch(branch, { find: { role: 'custom', customType: 'structured-exchange' } }),
    ).toEqual([
      expect.objectContaining({
        ref: expect.objectContaining({ id: 'c2', role: 'custom', customType: 'structured-exchange' }),
      }),
    ]);
    expect(querySessionBranch(branch, { find: { contains: 'all green' } })).toEqual([
      expect.objectContaining({ ref: expect.objectContaining({ id: 'b1', role: 'bashExecution' }) }),
    ]);
  });

  it('applies last and range over matching entries rather than branch position', () => {
    expect(
      querySessionBranch(branch, {
        find: { role: 'custom', customType: 'structured-exchange', last: 2 },
        select: 'details.x',
      }).map((row) => row.value),
    ).toEqual(['alpha', 'beta']);

    expect(
      querySessionBranch(branch, {
        find: { range: [1, 3] },
        select: 'role',
      }).map((row) => row.value),
    ).toEqual(['assistant', 'toolResult']);
  });

  it('projects a single capped path and an array of capped paths', () => {
    expect(
      querySessionBranch(branch, {
        find: { role: 'toolResult' },
        select: 'content[*].text',
      })[0]?.value,
    ).toEqual('GRAPH EXACT VALUE');

    expect(
      querySessionBranch(branch, {
        find: { role: 'toolResult' },
        select: ['content[*].text', 'details.review.status'],
      })[0]?.value,
    ).toEqual({
      'content[*].text': 'GRAPH EXACT VALUE',
      'details.review.status': 'clear',
    });
  });

  it('roots select at the same normalized view returned when select is omitted', () => {
    // No-select returns a flat view: message fields and entry sidecars merged,
    // so the model sees content/role/details at the top level.
    const entry = querySessionBranch(branch, { find: { toolCallId: 'call-1' } })[0]?.value;
    expect(entry).toEqual({
      type: 'message',
      id: 't1',
      parentId: null,
      timestamp: '2026-06-09T00:00:00.000Z',
      role: 'toolResult',
      toolCallId: 'call-1',
      toolName: 'read_graph',
      content: [{ type: 'text', text: 'GRAPH EXACT VALUE' }],
      details: { review: { status: 'clear' } },
      isError: false,
    });
    // The path the model naturally reaches for from the no-select shape resolves.
    expect(
      querySessionBranch(branch, { find: { toolCallId: 'call-1' }, select: 'content[0].text' })[0]?.value,
    ).toEqual('GRAPH EXACT VALUE');
  });

  it('returns multiple projected rows for multi-match queries', () => {
    expect(
      querySessionBranch(branch, {
        find: { role: 'custom', customType: 'structured-exchange', last: 2 },
        select: 'content[*].text',
      }),
    ).toEqual([
      {
        ref: { id: 'c1', index: 3, role: 'custom', customType: 'structured-exchange' },
        value: 'option alpha',
      },
      {
        ref: { id: 'c2', index: 4, role: 'custom', customType: 'structured-exchange' },
        value: 'option beta',
      },
    ]);
  });

  it('truncates large values with temp-file spillover and respects maxBytes', async () => {
    const tool = createBrunchSessionQueryTool();
    const large = 'x'.repeat(200);
    const result = await tool.execute(
      'query-1',
      { find: { role: 'toolResult' }, select: 'content[*].text', maxBytes: 80 },
      undefined,
      undefined,
      { sessionManager: { getBranch: () => [messageEntry('big', toolResultMessage(large))] } } as never,
    );

    expect(result.content[0]?.type).toBe('text');
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Output truncated');
    expect(result.details?.truncation?.truncated).toBe(true);
    expect(result.details?.truncation?.outputBytes).toBeLessThanOrEqual(80);
    expect(await readFile(result.details!.fullOutputPath!, 'utf8')).toContain(large);
  });

  it('runs in a faux turn and returns verbatim projected values as a tool result', async () => {
    const harness = await createBrunchFauxHarness({
      responses: [
        fauxAssistantMessage(
          fauxToolCall(
            BRUNCH_SESSION_QUERY_TOOL,
            { find: { role: 'custom' }, select: 'content[*].text' },
            { id: 'query-call' },
          ),
        ),
        fauxAssistantMessage('done'),
      ],
      customTools: [createBrunchSessionQueryTool()],
    });

    try {
      harness.session.sessionManager.appendCustomMessageEntry(
        'structured-exchange',
        [{ type: 'text', text: 'VERBATIM CUSTOM VALUE' }],
        true,
      );
      await harness.session.prompt('pull the custom value');

      const toolResult = harness.session.messages.find(
        (message) => message.role === 'toolResult' && message.toolName === BRUNCH_SESSION_QUERY_TOOL,
      );
      if (toolResult?.role !== 'toolResult') throw new Error('brunch_session_query tool result not found');
      expect(toolResult.content[0]).toEqual(
        expect.objectContaining({ text: expect.stringContaining('VERBATIM CUSTOM VALUE') }),
      );
    } finally {
      harness.dispose();
    }
  });

  it('registers the tool through the extension registrar', () => {
    const tools: Array<{ name: string }> = [];
    registerBrunchSessionQuery({ registerTool: (tool: { name: string }) => tools.push(tool) } as never);
    expect(tools.map((tool) => tool.name)).toEqual([BRUNCH_SESSION_QUERY_TOOL]);
  });

  it('registers parameters through the shared Zod adapter without changing the emitted schema', () => {
    expect(createBrunchSessionQueryTool().parameters).toEqual(toolParameters(zBrunchSessionQueryParams));
  });

  it('advertises a JSON Schema draft 2020-12 parameter schema (range uses prefixItems, no draft-07 tuple form)', () => {
    const schema = createBrunchSessionQueryTool().parameters as Record<string, unknown>;
    expect(schema.$schema).toContain('draft/2020-12');
    expect(draft07TupleSmells(schema)).toEqual([]);
    const range = (
      ((schema.properties as Record<string, Record<string, unknown>>).find.properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >
    ).range;
    expect(range).toHaveProperty('prefixItems');
  });
});

// Anthropic rejects tool schemas that are not draft 2020-12; the draft-07 tuple
// form (array-valued `items` + `additionalItems`) is the specific violation that
// kept brunch_session_query from being callable live once it was advertised.
function draft07TupleSmells(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) return node.flatMap((item, i) => draft07TupleSmells(item, `${path}[${i}]`));
  if (typeof node !== 'object' || node === null) return [];
  const record = node as Record<string, unknown>;
  const smells: string[] = [];
  if (Array.isArray(record.items)) smells.push(`${path}.items is an array`);
  if ('additionalItems' in record) smells.push(`${path}.additionalItems present`);
  for (const [key, value] of Object.entries(record))
    smells.push(...draft07TupleSmells(value, `${path}.${key}`));
  return smells;
}

// Faux session entries for the dynamic projector. The entry envelope is the
// canonical SessionEntry shape; only the inner message payload is cast, since
// these fixtures deliberately use partial role shapes to exercise path
// projection rather than reconstruct every required AgentMessage field.
function messageEntry(id: string, message: Record<string, unknown>): SessionEntry {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-09T00:00:00.000Z',
    message: message as unknown as Extract<SessionEntry, { type: 'message' }>['message'],
  };
}

function toolResultMessage(text: string) {
  return {
    role: 'toolResult',
    toolCallId: 'call-big',
    toolName: 'read',
    content: [{ type: 'text', text }],
    isError: false,
  };
}
