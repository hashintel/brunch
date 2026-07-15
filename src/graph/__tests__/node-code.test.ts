import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatGraphNodeCode, type NodeKind } from '../schema/nodes.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('formatGraphNodeCode', () => {
  it('formats a known kind as label + ordinal', () => {
    expect(formatGraphNodeCode('goal', 3)).toMatch(/^[A-Z]+3$/);
  });

  it('fails loudly with the reseed remedy for a persisted out-of-enum kind', () => {
    // Persisted rows can carry kinds retired from the schema (e.g. `slice`,
    // dropped by D103-L). No migration bridge under prototype posture — the
    // contract is a descriptive error, not a raw TypeError.
    expect(() => formatGraphNodeCode('slice' as NodeKind, 1)).toThrow(
      /unknown graph node kind "slice".*reseed/i,
    );
  });

  it('keeps graph-facing agent guidance on scope/SCP while reserving slice for execution', () => {
    const dataModel = readRepoFile('src/agents/references/data-model.md');
    const readiness = readRepoFile('src/agents/references/readiness-bands.md');
    const ingest = readRepoFile('src/agents/skills/ingest/SKILL.md');
    const neighborhoods = readRepoFile('src/agents/references/node-neighbourhoods.md');
    const mapEdges = readRepoFile('src/agents/skills/map/references/map-edges.md');

    expect(dataModel).toContain('| `scope`     | SCP');
    expect(dataModel).toContain('Runtime `slice`s are executor-derived');
    expect(dataModel).not.toMatch(/\| `slice`\s+\| S\s+\|/);

    expect(readiness).toContain('| `scope`         | SCP  | commitment');
    expect(readiness).not.toMatch(/\| `slice`\s+\| S\s+\|/);
    expect(ingest).toContain('`criterion`, `milestone`, `frontier`, `scope`');
    expect(neighborhoods).toContain('requirement → scope');
    expect(mapEdges).toContain('whole: F1        part: SCP1');
  });
});
