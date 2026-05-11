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
