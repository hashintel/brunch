/**
 * Frontier closure oracle (Card 6, elicitation-gap-guidance).
 *
 * SPEC: D45-L, D65-L, D75-L, I31-L. The persisted spec-global `elicitation_gaps`
 * register, its count-based coverage/readiness helpers, and the old tool
 * surface must never reappear. This grep-level negative oracle proves absence
 * across the whole source tree rather than trusting that no test happens to
 * exercise them.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCE_ROOT = 'src';
const SELF = 'src/graph/__tests__/elicitation-gap-guidance-closure.test.ts';

// The retirement is explained by name in a design comment; that mention is
// documentation, not a live reference, so it is excluded from the scan.
const ALLOWED_MENTIONS: Record<string, true> = {
  'src/session/elicitation-scratchpad.ts': true,
};

const BANNED_IDENTIFIERS = [
  'getElicitationGaps',
  'derivePresenceCoverage',
  'readinessEstimate',
  'renderSoftReadinessEstimate',
  'elicitation-driver',
  'SEEDED_ELICITATION_GAPS',
  'read_elicitation_gaps',
  'update_elicitation_gaps',
  "action: 'spawn'",
  'spawn_gap',
  'ranked elicitation gaps',
];

function sourceFilesUnder(path: string): string[] {
  const full = join(ROOT, path);
  const entries = readdirSync(full);
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(full, entry);
    const relativePath = relative(ROOT, absolute);
    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFilesUnder(relativePath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

describe('elicitation-gap-guidance frontier closure', () => {
  it('has no surviving reference to the retired gap register, its coverage math, or its tool surface', () => {
    const offenders: string[] = [];
    for (const file of sourceFilesUnder(SOURCE_ROOT)) {
      if (file === SELF || ALLOWED_MENTIONS[file]) continue;
      const contents = readFileSync(join(ROOT, file), 'utf8');
      for (const identifier of BANNED_IDENTIFIERS) {
        if (contents.includes(identifier)) offenders.push(`${file}: ${identifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
