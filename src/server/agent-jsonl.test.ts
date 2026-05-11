import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import { runAgentJsonlSession } from './agent-jsonl.js';
import { createDb, type DB } from './db.js';

describe('agent JSONL session', () => {
  const tempDirs: string[] = [];
  let db: DB | null = null;

  afterEach(() => {
    db?.$client.close();
    db = null;
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDb(): DB {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-agent-jsonl-'));
    tempDirs.push(dir);
    db = createDb(join(dir, 'brunch.db'));
    return db;
  }

  async function runSession(lines: string[]) {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(chunk.toString()));

    const session = runAgentJsonlSession({ db: createTempDb(), input, output });
    for (const line of lines) {
      input.write(`${line}\n`);
    }
    input.end();
    await session;

    return chunks
      .join('')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
  }

  it('creates and reads a real specification over JSONL without ambient selection', async () => {
    const responses = await runSession([
      JSON.stringify({ id: 'create-1', capability: 'spec.create', input: { name: 'JSONL spec' } }),
      JSON.stringify({ id: 'read-1', capability: 'spec.getStatus', input: { specId: 1 } }),
    ]);

    expect(responses).toEqual([
      expect.objectContaining({
        id: 'create-1',
        ok: true,
        output: expect.objectContaining({ specId: 1 }),
      }),
      expect.objectContaining({
        id: 'read-1',
        ok: true,
        output: expect.objectContaining({
          specification: expect.objectContaining({ id: 1, name: 'JSONL spec' }),
        }),
      }),
    ]);
  });

  it('creates and reads the primary chat projection over JSONL using explicit ids', async () => {
    const responses = await runSession([
      JSON.stringify({ id: 'create-1', capability: 'spec.create', input: { name: 'JSONL chat spec' } }),
      JSON.stringify({ id: 'primary-1', capability: 'chat.getPrimary', input: { specId: 1 } }),
      JSON.stringify({ id: 'chat-1', capability: 'chat.read', input: { chatId: 1 } }),
    ]);

    expect(responses).toEqual([
      expect.objectContaining({ id: 'create-1', ok: true, output: expect.objectContaining({ specId: 1 }) }),
      expect.objectContaining({
        id: 'primary-1',
        ok: true,
        output: { specId: 1, chatId: 1, kind: 'interview', activeTurnId: null },
      }),
      expect.objectContaining({
        id: 'chat-1',
        ok: true,
        output: expect.objectContaining({
          specification: { id: 1, name: 'JSONL chat spec', mode: 'greenfield' },
          chat: { id: 1, specificationId: 1, kind: 'interview', activeTurnId: null },
          frontier: { state: 'idle_no_frontier', phase: 'grounding', turnId: null },
          nextCommands: [{ capability: 'chat.ensureReady', input: { chatId: 1 } }],
        }),
      }),
    ]);
  });

  it('returns typed chat read errors without crashing the session', async () => {
    const responses = await runSession([
      JSON.stringify({ id: 'missing-chat', capability: 'chat.read', input: { chatId: 999 } }),
      JSON.stringify({ id: 'invalid-chat', capability: 'chat.read', input: { chatId: 0 } }),
      JSON.stringify({
        id: 'create-after-chat-errors',
        capability: 'spec.create',
        input: { name: 'Still works' },
      }),
    ]);

    expect(responses).toEqual([
      expect.objectContaining({
        id: 'missing-chat',
        ok: false,
        error: expect.objectContaining({ code: 'handler_failed' }),
      }),
      expect.objectContaining({
        id: 'invalid-chat',
        ok: false,
        error: expect.objectContaining({ code: 'invalid_input' }),
      }),
      expect.objectContaining({
        id: 'create-after-chat-errors',
        ok: true,
        output: expect.objectContaining({ specId: 1 }),
      }),
    ]);
  });

  it('returns typed error envelopes and keeps processing after recoverable errors', async () => {
    const responses = await runSession([
      '{not json',
      JSON.stringify({ id: 'unknown-1', capability: 'spec.delete', input: {} }),
      JSON.stringify({ id: 'invalid-1', capability: 'spec.create', input: { name: '' } }),
      JSON.stringify({ id: 'create-2', capability: 'spec.create', input: { name: 'Still works' } }),
    ]);

    expect(responses).toEqual([
      expect.objectContaining({
        id: null,
        ok: false,
        error: expect.objectContaining({ code: 'invalid_json' }),
      }),
      expect.objectContaining({
        id: 'unknown-1',
        ok: false,
        error: expect.objectContaining({ code: 'unknown_capability' }),
      }),
      expect.objectContaining({
        id: 'invalid-1',
        ok: false,
        error: expect.objectContaining({ code: 'invalid_input' }),
      }),
      expect.objectContaining({ id: 'create-2', ok: true, output: expect.objectContaining({ specId: 1 }) }),
    ]);
  });
});
