import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createDb,
  createKnowledgeItem,
  createSpecification,
  getOrCreateSpecification,
  type DB,
} from './db.js';
import {
  formatMentionedItemsContextBlock,
  parseIntentItemReferences,
  resolveIntentItemReferences,
} from './intent-item-resolver.js';

describe('parseIntentItemReferences', () => {
  it('extracts a single reference token from prose', () => {
    expect(parseIntentItemReferences('please explain #R1 in plain language')).toEqual([
      { code: 'R1', kind: 'requirement', ordinal: 1 },
    ]);
  });

  it('extracts multiple references in source order', () => {
    expect(parseIntentItemReferences('compare #G2 and #CTX5 against #A12')).toEqual([
      { code: 'G2', kind: 'goal', ordinal: 2 },
      { code: 'CTX5', kind: 'context', ordinal: 5 },
      { code: 'A12', kind: 'assumption', ordinal: 12 },
    ]);
  });

  it('deduplicates repeated references but preserves first-occurrence order', () => {
    const result = parseIntentItemReferences('#R1 again #R1 then #G1 then #R1');
    expect(result.map((reference) => reference.code)).toEqual(['R1', 'G1']);
  });

  it('rejects malformed prefixes (unknown letters, suffixed letters)', () => {
    expect(parseIntentItemReferences('skip #X1 and #R1abc but keep #R2')).toEqual([
      { code: 'R2', kind: 'requirement', ordinal: 2 },
    ]);
  });

  it('rejects zero ordinals', () => {
    // Ordinals are 1-based per `intent-graph-store.ts`. `#R0` has no possible match.
    expect(parseIntentItemReferences('#R0 should be dropped')).toEqual([]);
  });

  it('returns empty for text without any references', () => {
    expect(parseIntentItemReferences('no mentions here at all')).toEqual([]);
  });

  it('handles all kind prefixes from the registry', () => {
    const result = parseIntentItemReferences('#G1 #T1 #CTX1 #CON1 #R1 #AC1 #D1 #A1');
    expect(result.map((reference) => reference.kind)).toEqual([
      'goal',
      'term',
      'context',
      'constraint',
      'requirement',
      'criterion',
      'decision',
      'assumption',
    ]);
  });
});

describe('resolveIntentItemReferences', () => {
  let db: DB;

  beforeEach(() => {
    db = createDb();
  });

  afterEach(() => {
    db.$client.close();
  });

  it('returns empty matched/missing for an empty input', () => {
    const spec = getOrCreateSpecification(db);
    expect(resolveIntentItemReferences(db, spec.id, [])).toEqual({ matched: [], missing: [] });
  });

  it('matches references that exist in the specification', () => {
    const spec = getOrCreateSpecification(db);
    const requirement = createKnowledgeItem(db, spec.id, 'requirement', 'Export markdown');
    const goal = createKnowledgeItem(db, spec.id, 'goal', 'Ship the spec');

    const result = resolveIntentItemReferences(db, spec.id, [
      { code: 'R1', kind: 'requirement', ordinal: requirement.kind_ordinal },
      { code: `G${goal.kind_ordinal}`, kind: 'goal', ordinal: goal.kind_ordinal },
    ]);

    expect(result.missing).toEqual([]);
    expect(result.matched).toHaveLength(2);
    expect(result.matched[0]?.item.id).toBe(requirement.id);
    expect(result.matched[1]?.item.id).toBe(goal.id);
  });

  it('reports missing codes whose (kind, ordinal) does not exist', () => {
    const spec = getOrCreateSpecification(db);
    createKnowledgeItem(db, spec.id, 'requirement', 'Only requirement');

    const result = resolveIntentItemReferences(db, spec.id, [
      { code: 'R1', kind: 'requirement', ordinal: 1 },
      { code: 'R99', kind: 'requirement', ordinal: 99 },
      { code: 'D7', kind: 'decision', ordinal: 7 },
    ]);

    expect(result.matched.map((entry) => entry.code)).toEqual(['R1']);
    expect(result.missing).toEqual(['R99', 'D7']);
  });

  it('does not match items from a sibling specification', () => {
    const specA = createSpecification(db, 'spec-a');
    const specB = createSpecification(db, 'spec-b');
    createKnowledgeItem(db, specA.id, 'requirement', 'A-side requirement');

    const result = resolveIntentItemReferences(db, specB.id, [
      { code: 'R1', kind: 'requirement', ordinal: 1 },
    ]);

    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual(['R1']);
  });
});

describe('formatMentionedItemsContextBlock', () => {
  it('returns null when nothing matched (caller should skip the section)', () => {
    expect(formatMentionedItemsContextBlock([])).toBeNull();
  });

  it('renders matched items with kind and content', () => {
    const block = formatMentionedItemsContextBlock([
      {
        code: 'R1',
        item: {
          id: 1,
          specification_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Export markdown',
          rationale: null,
          kind_ordinal: 1,
        },
      },
    ]);
    expect(block).toContain('[R1]');
    expect(block).toContain('(requirement)');
    expect(block).toContain('Export markdown');
  });

  it('includes rationale when present', () => {
    const block = formatMentionedItemsContextBlock([
      {
        code: 'D1',
        item: {
          id: 2,
          specification_id: 1,
          kind: 'decision',
          subtype: null,
          content: 'Use SQLite',
          rationale: 'Local-first storage',
          kind_ordinal: 1,
        },
      },
    ]);
    expect(block).toContain('Rationale: Local-first storage');
  });
});
