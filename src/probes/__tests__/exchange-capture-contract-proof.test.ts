import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// CC-14 closure oracle (FE-1135): the five governing capture invariants must
// stay stated in the model-facing conduct homes that perform capture/ingest/
// elicitation. This checks invariant presence across the combined homes, not
// exact sentence wording per row — prose may be reworded as long as each
// invariant remains named somewhere the model reads it.
describe('exchange capture contract proof', () => {
  it('keeps the five governing invariants in model-facing conduct homes', async () => {
    const ingest = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    const elicit = await readFile(join(process.cwd(), 'src/agents/skills/elicit/SKILL.md'), 'utf8');
    const routing = await readFile(
      join(process.cwd(), 'src/agents/skills/map/references/routing.md'),
      'utf8',
    );
    const conduct = [ingest, elicit, routing].join('\n');

    expect(conduct).toContain('Cancel demotes to scratchpad');
    expect(conduct).toContain('Reject kills the offer');
    expect(conduct).toContain('Accepted terminal only');
    expect(conduct).toContain('offer-scoped');
    expect(conduct).toContain('per-turn/watermark-shaped');
  });

  it('keeps present_digest ingest guidance in the model-facing conduct homes', async () => {
    const ingest = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    const routing = await readFile(
      join(process.cwd(), 'src/agents/skills/map/references/routing.md'),
      'utf8',
    );
    const readiness = await readFile(join(process.cwd(), 'src/agents/references/readiness-bands.md'), 'utf8');

    expect(ingest).toContain('present_digest');
    expect(ingest).toContain('accepted_abstract');
    expect(routing).toContain('Accepted `present_digest` material is source-derived review input');
    expect(readiness).toContain('assistant-authored digest via present_digest');
    expect(readiness).toContain('maps advisory until harmonized');
  });
});
