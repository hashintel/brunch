import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { acquireSessionWriter, sessionWriterLockPath } from '../session-writer-guard.js';

const target = { specId: 7, sessionId: 'session-a' };

describe('session writer guard', () => {
  it('fails closed for a same-target rival and keeps distinct targets independent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-writer-'));
    const first = await acquireSessionWriter({ cwd, target });
    await expect(acquireSessionWriter({ cwd, target })).rejects.toThrow('already has a writer');
    const other = await acquireSessionWriter({ cwd, target: { ...target, sessionId: 'session-b' } });
    await other.release();
    await first.release();
  });

  it('releases authority normally and after construction failure', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-writer-'));
    const first = await acquireSessionWriter({ cwd, target });
    await first.release();
    const second = await acquireSessionWriter({ cwd, target });
    await second.release();

    await expect(
      acquireSessionWriter({ cwd, target }).then(async (authority) => {
        try {
          throw new Error('construction failed');
        } finally {
          await authority.release();
        }
      }),
    ).rejects.toThrow('construction failed');
    await expect(
      acquireSessionWriter({ cwd, target }).then((authority) => authority.release()),
    ).resolves.toBeUndefined();
  });

  it('never steals an existing or stale-looking lock', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-writer-'));
    const lockPath = sessionWriterLockPath(cwd, target);
    await mkdir(lockPath, { recursive: true });
    await expect(acquireSessionWriter({ cwd, target })).rejects.toThrow('already has a writer');
  });
});
