import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from './connection.js';
import { specs } from './schema.js';

describe('specs row schema — posture round-trip (D118-L, A41-L)', () => {
  it('round-trips a nullable origin and a nullable self-referencing relatesToSpecId', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-row-schemas-'));
    const dbPath = join(dir, 'data.db');

    try {
      const db = createDb(dbPath);

      const root = db
        .insert(specs)
        .values({ name: 'Root spec', slug: 'root-spec', kind: 'product' })
        .returning()
        .get()!;
      expect(root.origin).toBeNull();
      expect(root.relates_to_spec_id).toBeNull();

      const established = db
        .update(specs)
        .set({ origin: 'greenfield' })
        .where(eq(specs.id, root.id))
        .returning()
        .get()!;
      expect(established.origin).toBe('greenfield');

      const related = db
        .insert(specs)
        .values({
          name: 'Feature spec',
          slug: 'feature-spec',
          kind: 'feature',
          origin: 'brownfield',
          relates_to_spec_id: root.id,
        })
        .returning()
        .get()!;

      expect(related.origin).toBe('brownfield');
      expect(related.relates_to_spec_id).toBe(root.id);

      const reread = db.select().from(specs).where(eq(specs.id, related.id)).get()!;
      expect(reread.origin).toBe('brownfield');
      expect(reread.relates_to_spec_id).toBe(root.id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
