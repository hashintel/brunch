import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { dispatchCapability } from './capabilities.js';
import {
  advanceHead,
  createDb,
  createTurn,
  getActivePath,
  getSpecification,
  listSpecifications,
  type DB,
} from './db.js';

describe('agent capabilities', () => {
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
    const dir = mkdtempSync(join(tmpdir(), 'brunch-capabilities-'));
    tempDirs.push(dir);
    db = createDb(join(dir, 'brunch.db'));
    return db;
  }

  it('dispatches spec.create through a Brunch-owned handler', async () => {
    const result = await dispatchCapability({
      db: createTempDb(),
      capability: 'spec.create',
      input: { name: 'Agent-made spec' },
    });

    expect(result).toMatchObject({
      specId: expect.any(Number),
      specification: expect.objectContaining({ name: 'Agent-made spec' }),
    });
    expect(listSpecifications(db!)).toHaveLength(1);
  });

  it('dispatches spec.getStatus using an explicit spec id', async () => {
    const activeDb = createTempDb();
    const created = await dispatchCapability({
      db: activeDb,
      capability: 'spec.create',
      input: { name: 'Readable spec' },
    });

    const result = await dispatchCapability({
      db: activeDb,
      capability: 'spec.getStatus',
      input: { specId: created.specId },
    });

    expect(result).toMatchObject({
      specification: expect.objectContaining({ id: created.specId, name: 'Readable spec' }),
      workflow: expect.objectContaining({
        phases: expect.objectContaining({ grounding: expect.any(Object) }),
      }),
    });
  });

  it('dispatches chat.getPrimary for an explicit spec id', async () => {
    const activeDb = createTempDb();
    const created = await dispatchCapability({
      db: activeDb,
      capability: 'spec.create',
      input: { name: 'Chat owner' },
    });

    const result = await dispatchCapability({
      db: activeDb,
      capability: 'chat.getPrimary',
      input: { specId: created.specId },
    });

    expect(result).toEqual({
      specId: created.specId,
      chatId: expect.any(Number),
      kind: 'interview',
      activeTurnId: null,
    });
  });

  it('dispatches chat.read as a compact agent-facing projection with next-command hints', async () => {
    const activeDb = createTempDb();
    const created = await dispatchCapability({
      db: activeDb,
      capability: 'spec.create',
      input: { name: 'Chat readable' },
    });
    const turn = createTurn(activeDb, created.specId, {
      parent_turn_id: null,
      phase: 'grounding',
      question: 'What are you trying to build?',
      answer: null,
      assistant_parts: null,
      user_parts: null,
    });
    advanceHead(activeDb, created.specId, turn.id);
    const primary = await dispatchCapability({
      db: activeDb,
      capability: 'chat.getPrimary',
      input: { specId: created.specId },
    });

    const result = await dispatchCapability({
      db: activeDb,
      capability: 'chat.read',
      input: { chatId: primary.chatId },
    });

    expect(result).toEqual({
      specification: { id: created.specId, name: 'Chat readable', mode: 'greenfield' },
      chat: {
        id: primary.chatId,
        specificationId: created.specId,
        kind: 'interview',
        activeTurnId: turn.id,
      },
      frontier: { state: 'awaiting_response', phase: 'grounding', turnId: turn.id },
      turns: [
        {
          id: turn.id,
          phase: 'grounding',
          kind: 'question',
          question: 'What are you trying to build?',
          answer: null,
          isResolution: false,
          options: [],
          capturedItems: [],
        },
      ],
      nextCommands: [
        { capability: 'turn.submitResponse', input: { chatId: primary.chatId, turnId: turn.id } },
      ],
    });
  });

  it('dispatches chat.ensureReady by generating an answerable frontier', async () => {
    const activeDb = createTempDb();
    const generateAnswerableFrontier = vi.fn(async () => ({
      question: 'What are you trying to build?',
      assistantParts: [{ type: 'text' as const, text: 'What are you trying to build?' }],
    }));
    const created = await dispatchCapability({
      db: activeDb,
      capability: 'spec.create',
      input: { name: 'Ready spec' },
    });
    const primary = await dispatchCapability({
      db: activeDb,
      capability: 'chat.getPrimary',
      input: { specId: created.specId },
    });

    const result = await dispatchCapability({
      db: activeDb,
      capability: 'chat.ensureReady',
      input: { chatId: primary.chatId },
      generateAnswerableFrontier,
    });
    const activePath = getActivePath(activeDb, created.specId);

    expect(result).toEqual({
      chatId: primary.chatId,
      specId: created.specId,
      state: 'awaiting_response',
      turnId: expect.any(Number),
      nextCommands: [{ capability: 'chat.read', input: { chatId: primary.chatId } }],
    });
    expect(generateAnswerableFrontier).toHaveBeenCalledOnce();
    expect(activePath).toHaveLength(1);
    expect(activePath[0]).toMatchObject({
      id: result.turnId,
      phase: 'grounding',
      question: 'What are you trying to build?',
      answer: null,
    });
    expect(activePath[0]?.assistant_parts).toBe(
      JSON.stringify([{ type: 'text', text: 'What are you trying to build?' }]),
    );
    expect(getSpecification(activeDb, created.specId)?.active_turn_id).toBe(result.turnId);
    expect(
      await dispatchCapability({
        db: activeDb,
        capability: 'chat.read',
        input: { chatId: primary.chatId },
      }),
    ).toMatchObject({
      frontier: { state: 'awaiting_response', phase: 'grounding', turnId: result.turnId },
      turns: [expect.objectContaining({ question: 'What are you trying to build?' })],
      nextCommands: [
        { capability: 'turn.submitResponse', input: { chatId: primary.chatId, turnId: result.turnId } },
      ],
    });
  });

  it('keeps chat.ensureReady idempotent when an answerable frontier already exists', async () => {
    const activeDb = createTempDb();
    const generateAnswerableFrontier = vi.fn(async () => ({
      question: 'What should we clarify first?',
      assistantParts: [{ type: 'text' as const, text: 'What should we clarify first?' }],
    }));
    const created = await dispatchCapability({
      db: activeDb,
      capability: 'spec.create',
      input: { name: 'Idempotent readiness' },
    });
    const primary = await dispatchCapability({
      db: activeDb,
      capability: 'chat.getPrimary',
      input: { specId: created.specId },
    });

    const first = await dispatchCapability({
      db: activeDb,
      capability: 'chat.ensureReady',
      input: { chatId: primary.chatId },
      generateAnswerableFrontier,
    });
    const second = await dispatchCapability({
      db: activeDb,
      capability: 'chat.ensureReady',
      input: { chatId: primary.chatId },
      generateAnswerableFrontier,
    });

    expect(second).toEqual(first);
    expect(second.state).toBe('awaiting_response');
    expect(generateAnswerableFrontier).toHaveBeenCalledOnce();
    expect(getActivePath(activeDb, created.specId)).toHaveLength(1);
  });

  it('rejects unknown chat ids and schema-invalid capability input before calling handlers', async () => {
    const activeDb = createTempDb();
    await expect(
      dispatchCapability({
        db: activeDb,
        capability: 'chat.read',
        input: { chatId: 999 },
      }),
    ).rejects.toThrow('Chat 999 not found');

    await expect(
      dispatchCapability({
        db: activeDb,
        capability: 'chat.ensureReady',
        input: { chatId: 999 },
      }),
    ).rejects.toThrow('Chat 999 not found');

    await expect(
      dispatchCapability({
        db: activeDb,
        capability: 'spec.create',
        input: { name: '' },
      }),
    ).rejects.toThrow('Invalid input for capability spec.create');
  });
});
