import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from './connection.js';
import { edges, nodes, specs } from './schema.js';

describe('specs row schema — posture round-trip (D118-L, A41-L)', () => {
  it('round-trips a nullable origin and a nullable self-referencing relatesToSpecId', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-row-schemas-'));
    const dbPath = join(dir, 'test.db');

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

describe('edges row schema — acknowledged-LSN watermark round-trip (reconciliation-derivation)', () => {
  it('defaults acknowledged_lsn to null and round-trips a bumped watermark', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-row-schemas-'));
    const dbPath = join(dir, 'test.db');

    try {
      const db = createDb(dbPath);
      const spec = db.insert(specs).values({ name: 'Spec', slug: 'spec' }).returning().get()!;
      const [source, target] = db
        .insert(nodes)
        .values([
          {
            spec_id: spec.id,
            plane: 'intent',
            kind: 'requirement',
            kind_ordinal: 1,
            title: 'R1',
            created_at_lsn: 1,
            updated_at_lsn: 1,
          },
          {
            spec_id: spec.id,
            plane: 'intent',
            kind: 'assumption',
            kind_ordinal: 1,
            title: 'A1',
            created_at_lsn: 1,
            updated_at_lsn: 1,
          },
        ])
        .returning()
        .all();

      const edge = db
        .insert(edges)
        .values({
          spec_id: spec.id,
          category: 'dependency',
          source_id: source!.id,
          target_id: target!.id,
          created_at_lsn: 1,
          updated_at_lsn: 1,
        })
        .returning()
        .get()!;
      expect(edge.acknowledged_lsn).toBeNull();

      const acknowledged = db
        .update(edges)
        .set({ acknowledged_lsn: 7 })
        .where(eq(edges.id, edge.id))
        .returning()
        .get()!;
      expect(acknowledged.acknowledged_lsn).toBe(7);

      const reread = db.select().from(edges).where(eq(edges.id, edge.id)).get()!;
      expect(reread.acknowledged_lsn).toBe(7);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
