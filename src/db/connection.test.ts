import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDb } from './connection.js';
import { graphClock, specs } from './schema.js';

describe('createDb', () => {
  it('creates a missing database file and can reopen it idempotently', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-db-'));
    const dbPath = join(dir, 'data.db');

    try {
      const db = createDb(dbPath);
      db.insert(specs)
        .values({ name: 'Spec A', slug: 'spec-a', readiness_grade: 'grounding_onboarding' })
        .run();

      expect((await stat(dbPath)).isFile()).toBe(true);

      const reopened = createDb(dbPath);
      expect(reopened.select().from(specs).all()).toHaveLength(1);
      expect(reopened.select().from(graphClock).all()[0]!.lsn).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
