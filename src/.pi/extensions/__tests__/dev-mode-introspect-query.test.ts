import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  createBrunchIntrospectQueryTool,
  queryIntrospectionCaptures,
  registerBrunchIntrospectQuery,
  zBrunchIntrospectQueryParams,
} from '../dev-mode/introspect-query/index.js';
import {
  type BrunchIntrospectionStore,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
} from '../dev-mode/introspection/index.js';
import { toolParameters } from '../shared/tool-schema.js';

describe('brunch_introspect_query', () => {
  it('returns the latest capture and projects payload and baseOptions paths', () => {
    const store = seededStore();

    expect(
      queryIntrospectionCaptures(store, { select: ['payload.tools[*].name', 'baseOptions.cwd'] }),
    ).toEqual([
      {
        ref: { turnId: 'turn-2', capturedAt: '2026-06-09T00:00:02.000Z' },
        value: { 'payload.tools[*].name': 'brunch_session_query', 'baseOptions.cwd': '/tmp/brunch' },
      },
    ]);
  });

  it('returns the whole queryable capture when select is omitted', () => {
    const store = seededStore();

    expect(queryIntrospectionCaptures(store, {})[0]?.value).toEqual({
      turnId: 'turn-2',
      capturedAt: '2026-06-09T00:00:02.000Z',
      payload: {
        system: 'final two',
        tools: [{ name: 'brunch_session_query' }],
        messages: [{ role: 'user' }],
      },
      baseOptions: { cwd: '/tmp/brunch', selectedTools: ['read'] },
    });
  });

  it('finds captures by turnId and returns an empty result for unknown turn ids', () => {
    const store = seededStore();

    expect(
      queryIntrospectionCaptures(store, { find: { turnId: 'turn-1' }, select: 'payload.system' }),
    ).toEqual([
      {
        ref: { turnId: 'turn-1', capturedAt: '2026-06-09T00:00:01.000Z' },
        value: 'final one',
      },
    ]);
    expect(queryIntrospectionCaptures(store, { find: { turnId: 'missing' } })).toEqual([]);
  });

  it('finds captures by nth-from-end', () => {
    const store = seededStore();

    expect(queryIntrospectionCaptures(store, { find: { nth: 2 }, select: 'payload.system' })[0]?.value).toBe(
      'final one',
    );
  });

  it('truncates large payloads with temp-file spillover and respects maxBytes', async () => {
    const store = createInMemoryBrunchIntrospectionStore();
    const large = 'x'.repeat(200);
    store.recordPassiveCapture({
      turnId: 'turn-big',
      capturedAt: '2026-06-09T00:00:03.000Z',
      event: 'before_provider_request',
      payload: { system: large },
    });
    const tool = createBrunchIntrospectQueryTool(store);

    const result = await tool.execute(
      'query-1',
      { select: 'payload.system', maxBytes: 80 },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.content[0]?.type).toBe('text');
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Output truncated');
    expect(result.details?.truncation?.truncated).toBe(true);
    expect(result.details?.truncation?.outputBytes).toBeLessThanOrEqual(80);
    expect(await readFile(result.details!.fullOutputPath!, 'utf8')).toContain(large);
  });

  it('reads a real before_provider_request capture recorded by the introspection tap', async () => {
    const store = createInMemoryBrunchIntrospectionStore();
    const handlers: Record<string, Array<(event: unknown, ctx: unknown) => unknown>> = {};
    const tools: Array<{ name: string; execute: (...args: any[]) => Promise<any> }> = [];
    const api = {
      on(eventName: string, handler: (event: unknown, ctx: unknown) => unknown) {
        handlers[eventName] ??= [];
        handlers[eventName].push(handler);
      },
      registerCommand() {},
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<any> }) {
        tools.push(tool);
      },
    };

    registerBrunchIntrospection(api as never, { store, clock: () => new Date('2026-06-09T00:00:04.000Z') });
    registerBrunchIntrospectQuery(api as never, { store });

    for (const handler of handlers.before_agent_start ?? []) await handler({}, {});
    for (const handler of handlers.before_provider_request ?? []) {
      await handler({ payload: { system: 'VERBATIM FINAL SYSTEM', tools: [{ name: 'read' }] } }, {});
    }
    const tool = tools.find((candidate) => candidate.name === BRUNCH_INTROSPECT_QUERY_TOOL);
    if (!tool) throw new Error('brunch_introspect_query tool not registered');

    const result = await tool.execute('query-1', { select: 'payload.system' }, undefined, undefined, {});

    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('VERBATIM FINAL SYSTEM') }),
    );
  });

  it('registers the tool through the extension registrar', () => {
    const store = createInMemoryBrunchIntrospectionStore();
    const tools: Array<{ name: string }> = [];
    registerBrunchIntrospectQuery({ registerTool: (tool: { name: string }) => tools.push(tool) } as never, {
      store,
    });
    expect(tools.map((tool) => tool.name)).toEqual([BRUNCH_INTROSPECT_QUERY_TOOL]);
  });

  it('registers parameters through the shared Zod adapter without changing the emitted schema', () => {
    expect(createBrunchIntrospectQueryTool(createInMemoryBrunchIntrospectionStore()).parameters).toEqual(
      toolParameters(zBrunchIntrospectQueryParams),
    );
  });

  it('advertises a JSON Schema draft 2020-12 parameter schema (no draft-07 tuple form)', () => {
    const schema = createBrunchIntrospectQueryTool(createInMemoryBrunchIntrospectionStore())
      .parameters as Record<string, unknown>;
    expect(schema.$schema).toContain('draft/2020-12');
    expect(draft07TupleSmells(schema)).toEqual([]);
  });
});

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

function seededStore(): BrunchIntrospectionStore {
  const store = createInMemoryBrunchIntrospectionStore();
  store.recordPassiveCapture({
    turnId: 'turn-1',
    capturedAt: '2026-06-09T00:00:01.000Z',
    event: 'before_provider_request',
    payload: { system: 'final one', tools: [{ name: 'read' }], messages: [{ role: 'user' }] },
  });
  store.recordPassiveCapture({
    turnId: 'turn-2',
    capturedAt: '2026-06-09T00:00:02.000Z',
    event: 'before_provider_request',
    payload: { system: 'final two', tools: [{ name: 'brunch_session_query' }], messages: [{ role: 'user' }] },
  });
  store.recordBaseReport({
    reportedAt: '2026-06-09T00:00:02.500Z',
    command: 'introspect',
    baseSystemPromptOptions: { cwd: '/tmp/brunch', selectedTools: ['read'] },
    latestPassiveCapture: store.latestPassiveCapture(),
  });
  return store;
}
