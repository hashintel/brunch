import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { changeLog, elicitationGaps, graphClock, specs } from '../../db/schema.js';
import { GROUNDING_FLOOR_KINDS } from '../schema/elicitation-gap-fixtures.js';
import { openWorkspaceGraphRuntime } from '../workspace-store.js';

describe('openWorkspaceGraphRuntime', () => {
  it('repairs legacy specs missing seeded grounding gaps before readers run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-store-'));
    const brunchDir = join(cwd, '.brunch');
    const dbPath = join(brunchDir, 'data.db');

    try {
      await mkdir(brunchDir, { recursive: true });
      const db = createDb(dbPath);
      const spec = db
        .insert(specs)
        .values({ name: 'Legacy spec without gaps', slug: 'legacy-spec-without-gaps' })
        .returning({ id: specs.id })
        .get()!;
      db.insert(graphClock).values({ spec_id: spec.id, lsn: 1 }).run();
      db.insert(changeLog)
        .values({
          spec_id: spec.id,
          lsn: 1,
          operation: 'create_spec',
          payload: JSON.stringify({ specId: spec.id, name: 'Legacy spec without gaps' }),
        })
        .run();

      const runtime = await openWorkspaceGraphRuntime(cwd);
      const gapKinds = new Set(
        runtime
          .forSpec(spec.id)
          .getElicitationGaps()
          .map((gap) => gap.refersTo),
      );

      for (const kind of GROUNDING_FLOOR_KINDS) {
        expect(gapKinds.has(kind)).toBe(true);
      }

      const repaired = createDb(dbPath);
      expect(
        repaired
          .select({ operation: changeLog.operation })
          .from(changeLog)
          .where(eq(changeLog.spec_id, spec.id))
          .orderBy(asc(changeLog.lsn))
          .all()
          .map((row) => row.operation),
      ).toEqual(['create_spec', 'repair_seeded_elicitation_gaps']);
      expect(
        repaired
          .select({ lsn: graphClock.lsn })
          .from(graphClock)
          .where(eq(graphClock.spec_id, spec.id))
          .get(),
      ).toEqual({
        lsn: 2,
      });

      await openWorkspaceGraphRuntime(cwd);
      expect(
        repaired
          .select({ operation: changeLog.operation })
          .from(changeLog)
          .where(eq(changeLog.spec_id, spec.id))
          .all()
          .filter((row) => row.operation === 'repair_seeded_elicitation_gaps'),
      ).toHaveLength(1);
      expect(
        repaired.select().from(elicitationGaps).where(eq(elicitationGaps.spec_id, spec.id)).all(),
      ).toHaveLength(7);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
