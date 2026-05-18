import { and, eq, inArray } from 'drizzle-orm';

import {
  knowledgeKindRegistry,
  type KnowledgeKind,
  type KnowledgeKindRegistryEntry,
} from '@/shared/knowledge.js';

import type { DB, KnowledgeItem } from './db.js';
import * as schema from './schema.js';

export interface ParsedIntentItemReference {
  /** The full token as written, minus the leading `#` (e.g. `R12`, `CTX3`). */
  code: string;
  kind: KnowledgeKind;
  ordinal: number;
}

/**
 * Pre-sorted by prefix length descending so longest-match wins (e.g. `CTX`
 * before `C…`-style overlaps). The registry currently has no overlapping
 * prefixes today, but stable ordering avoids future regressions.
 */
const prefixesByLengthDesc: readonly KnowledgeKindRegistryEntry[] = [...knowledgeKindRegistry].sort(
  (a, b) => b.referenceCodePrefix.length - a.referenceCodePrefix.length,
);

const REFERENCE_TOKEN_REGEX = (() => {
  const alternation = prefixesByLengthDesc.map((entry) => entry.referenceCodePrefix).join('|');
  // (?<![A-Za-z0-9_]) ensures `#R1` after `foo` matches but `abc#R1` after a
  // word boundary still resolves; the `#` is the anchor. We don't restrict
  // what precedes the `#` because mentions can appear adjacent to punctuation.
  return new RegExp(`#(${alternation})(\\d+)(?![A-Za-z0-9])`, 'g');
})();

/**
 * Extract unique `#PREFIX<digits>` mentions from free-form text. Returned in
 * first-occurrence order; duplicates collapse so downstream resolution stays
 * O(unique mentions) regardless of how many times the user typed the same
 * code.
 */
export function parseIntentItemReferences(text: string): ParsedIntentItemReference[] {
  const seen = new Set<string>();
  const results: ParsedIntentItemReference[] = [];
  for (const match of text.matchAll(REFERENCE_TOKEN_REGEX)) {
    const prefix = match[1];
    const ordinalText = match[2];
    if (!prefix || !ordinalText) continue;
    const ordinal = Number.parseInt(ordinalText, 10);
    if (!Number.isInteger(ordinal) || ordinal <= 0) continue;
    const entry = prefixesByLengthDesc.find((candidate) => candidate.referenceCodePrefix === prefix);
    if (!entry) continue;
    const code = `${prefix}${ordinal}`;
    if (seen.has(code)) continue;
    seen.add(code);
    results.push({ code, kind: entry.kind, ordinal });
  }
  return results;
}

export interface ResolvedIntentItemReference {
  code: string;
  item: KnowledgeItem;
}

export interface IntentItemReferenceResolution {
  matched: readonly ResolvedIntentItemReference[];
  /**
   * Codes whose prefix parsed but whose (kind, ordinal) does not exist in the
   * specification's `knowledge_item` rows. The reference-code structure is
   * unambiguous within a spec — `(kind, kind_ordinal)` is unique per the
   * insert path in `intent-graph-store.ts` — so resolution has no "ambiguous"
   * bucket; missing is the only failure mode at this layer.
   */
  missing: readonly string[];
}

/**
 * Resolve a list of parsed references against one specification's knowledge
 * items in a single query. Order of `matched` follows the `references` input
 * so callers can render snapshots in the order the user mentioned them.
 */
export function resolveIntentItemReferences(
  db: DB,
  specificationId: number,
  references: readonly ParsedIntentItemReference[],
): IntentItemReferenceResolution {
  if (references.length === 0) {
    return { matched: [], missing: [] };
  }

  const kinds = Array.from(new Set(references.map((reference) => reference.kind)));
  const ordinals = Array.from(new Set(references.map((reference) => reference.ordinal)));

  const rows = db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        inArray(schema.knowledgeItem.kind, kinds),
        inArray(schema.knowledgeItem.kind_ordinal, ordinals),
      ),
    )
    .all() as KnowledgeItem[];

  const byKey = new Map<string, KnowledgeItem>(rows.map((row) => [`${row.kind}:${row.kind_ordinal}`, row]));

  const matched: ResolvedIntentItemReference[] = [];
  const missing: string[] = [];
  for (const reference of references) {
    const item = byKey.get(`${reference.kind}:${reference.ordinal}`);
    if (item) {
      matched.push({ code: reference.code, item });
    } else {
      missing.push(reference.code);
    }
  }
  return { matched, missing };
}

/**
 * Render the matched references as a compact prompt context block. Empty
 * resolutions return `null` so callers can skip the section entirely instead
 * of injecting an empty heading.
 */
export function formatMentionedItemsContextBlock(
  matched: readonly ResolvedIntentItemReference[],
): string | null {
  if (matched.length === 0) return null;
  const lines = ['Mentioned items (from `#` references in the user message):'];
  for (const entry of matched) {
    lines.push(`- [${entry.code}] (${entry.item.kind}) ${entry.item.content}`);
    if (entry.item.rationale) {
      lines.push(`  Rationale: ${entry.item.rationale}`);
    }
  }
  return lines.join('\n');
}
