import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { dispatchCapability } from './capabilities.js';
import { createDb, listSpecifications, type DB } from './db.js';

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

  it('rejects schema-invalid capability input before calling handlers', async () => {
    await expect(
      dispatchCapability({
        db: createTempDb(),
        capability: 'spec.create',
        input: { name: '' },
      }),
    ).rejects.toThrow('Invalid input for capability spec.create');
  });
});
