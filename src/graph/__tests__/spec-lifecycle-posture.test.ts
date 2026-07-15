/**
 * Spec lifecycle and posture command coverage at the real SQLite boundary.
 *
 * SPEC: D20-L, D89-L, D118-L
 */

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { changeLog, graphClock, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

describe('CommandExecutor spec lifecycle and posture', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;

  beforeEach(() => {
    db = createDb(':memory:');
    executor = new CommandExecutor(db);
  });

  describe('specs', () => {
    it('creates a spec row and returns an integer id', () => {
      const result = executor.createSpec({
        name: 'Brunch POC',
        slug: 'brunch-poc',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.specId).toBeTypeOf('number');
      expect(result.lsn).toBe(1);

      const row = db.select().from(specs).where(eq(specs.id, result.specId)).get()!;
      expect(row.id).toBe(result.specId);
      expect(row.name).toBe('Brunch POC');
      expect(row.slug).toBe('brunch-poc');
    });

    it('defaults spec kind to product when omitted (D89-L)', () => {
      const result = executor.createSpec({ name: 'Default Scope', slug: 'default-scope' });
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');

      expect(executor.getSpec(result.specId)?.kind).toBe('product');
    });

    it('persists and reads an explicit spec kind (D89-L)', () => {
      const created = executor.createSpec({ name: 'Focused Lib', slug: 'focused-lib', kind: 'function' });
      expect(created.status).toBe('success');
      if (created.status !== 'success') throw new Error('unreachable');

      const row = db.select().from(specs).where(eq(specs.id, created.specId)).get()!;
      expect(row.kind).toBe('function');
      expect(executor.getSpec(created.specId)?.kind).toBe('function');
    });

    it('creates exactly one graph clock row for a new spec at LSN 1', () => {
      const result = executor.createSpec({ name: 'Clocked Spec', slug: 'clocked-spec' });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(
        db
          .select({ specId: graphClock.spec_id, lsn: graphClock.lsn })
          .from(graphClock)
          .where(eq(graphClock.spec_id, result.specId))
          .all(),
      ).toEqual([{ specId: result.specId, lsn: 1 }]);
    });

    it('scopes create_spec audit LSNs to the newly created spec', () => {
      const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
      if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

      expect(specA.lsn).toBe(1);
      expect(specB.lsn).toBe(1);
      expect(graphClockLsn(db, specA.specId)).toBe(1);
      expect(graphClockLsn(db, specB.specId)).toBe(1);
      expect(
        db
          .select({ specId: changeLog.spec_id, lsn: changeLog.lsn, operation: changeLog.operation })
          .from(changeLog)
          .all(),
      ).toEqual([
        { specId: specA.specId, lsn: 1, operation: 'create_spec' },
        { specId: specB.specId, lsn: 1, operation: 'create_spec' },
      ]);
    });

    it('mutating one spec does not advance sibling spec clocks', () => {
      const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
      if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

      const result = executor.createNode({
        specId: specA.specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Spec A goal',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.lsn).toBe(2);
      expect(graphClockLsn(db, specA.specId)).toBe(2);
      expect(graphClockLsn(db, specB.specId)).toBe(1);
    });

    it('reads a spec row by integer id', () => {
      const created = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      if (created.status !== 'success') throw new Error('unreachable');

      const spec = executor.getSpec(created.specId);

      expect(spec).toEqual({
        id: created.specId,
        name: 'Spec A',
        slug: 'spec-a',
        kind: 'product',
        origin: null,
        relatesToSpecId: null,
      });
    });

    it('leaves posture unestablished (origin null) when omitted at creation (D118-L)', () => {
      const created = executor.createSpec({ name: 'Posture-unestablished', slug: 'posture-unestablished' });
      if (created.status !== 'success') throw new Error('unreachable');

      expect(executor.getSpec(created.specId)?.origin).toBeNull();
      expect(executor.getSpec(created.specId)?.relatesToSpecId).toBeNull();
    });

    it('persists posture — origin, confirmed kind, and an optional relates-to-spec reference (D118-L, A41-L)', () => {
      const root = executor.createSpec({ name: 'Root spec', slug: 'root-spec', kind: 'product' });
      if (root.status !== 'success') throw new Error('unreachable');

      const feature = executor.createSpec({
        name: 'Feature spec',
        slug: 'feature-spec',
        kind: 'feature',
        origin: 'brownfield',
        relatesToSpecId: root.specId,
      });
      expect(feature.status).toBe('success');
      if (feature.status !== 'success') throw new Error('unreachable');

      expect(executor.getSpec(feature.specId)).toEqual({
        id: feature.specId,
        name: 'Feature spec',
        slug: 'feature-spec',
        kind: 'feature',
        origin: 'brownfield',
        relatesToSpecId: root.specId,
      });
    });

    it('establishes posture once on an unestablished spec (D118-L resume establishment)', () => {
      const created = executor.createSpec({ name: 'Seeded spec', slug: 'seeded-spec' });
      if (created.status !== 'success') throw new Error('unreachable');

      const result = executor.establishSpecPosture({
        specId: created.specId,
        kind: 'feature',
        origin: 'brownfield',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.lsn).toBe(2);
      expect(executor.getSpec(created.specId)).toMatchObject({
        kind: 'feature',
        origin: 'brownfield',
      });
      expect(
        db
          .select({ operation: changeLog.operation, lsn: changeLog.lsn })
          .from(changeLog)
          .where(eq(changeLog.spec_id, created.specId))
          .all(),
      ).toEqual([
        { operation: 'create_spec', lsn: 1 },
        { operation: 'establish_spec_posture', lsn: 2 },
      ]);
    });

    it('keeps the stored kind when establishment confirms origin only', () => {
      const created = executor.createSpec({ name: 'Kinded spec', slug: 'kinded-spec', kind: 'function' });
      if (created.status !== 'success') throw new Error('unreachable');

      const result = executor.establishSpecPosture({ specId: created.specId, origin: 'greenfield' });

      expect(result.status).toBe('success');
      expect(executor.getSpec(created.specId)).toMatchObject({ kind: 'function', origin: 'greenfield' });
    });

    it('refuses to re-establish posture on an already-established spec (establish-once)', () => {
      const created = executor.createSpec({
        name: 'Established spec',
        slug: 'established-spec',
        origin: 'greenfield',
      });
      if (created.status !== 'success') throw new Error('unreachable');

      const result = executor.establishSpecPosture({
        specId: created.specId,
        kind: 'feature',
        origin: 'brownfield',
      });

      expect(result.status).toBe('structural_illegal');
      expect(executor.getSpec(created.specId)).toMatchObject({ kind: 'product', origin: 'greenfield' });
    });

    it('refuses to establish posture on a missing spec', () => {
      const result = executor.establishSpecPosture({ specId: 999, origin: 'greenfield' });
      expect(result.status).toBe('structural_illegal');
    });

    it('fails loud when an existing spec is missing its graph clock row', () => {
      const created = executor.createSpec({ name: 'Corrupt Spec', slug: 'corrupt-spec' });
      if (created.status !== 'success') throw new Error('unreachable');
      db.delete(graphClock).where(eq(graphClock.spec_id, created.specId)).run();

      expect(() =>
        executor.createNode({
          specId: created.specId,
          plane: 'intent',
          kind: 'goal',
          title: 'This mutation should not repair storage',
        }),
      ).toThrow(/graph_clock invariant failed/);
    });
  });
});
