import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('walkthrough remediation conduct contract', () => {
  it('pins ask and present tool prompt guidance for user-visible continuation conduct', async () => {
    const askTool = await readFile(join(process.cwd(), 'src/.pi/extensions/exchanges/ask.ts'), 'utf8');
    const presentDigestTool = await readFile(
      join(process.cwd(), 'src/.pi/extensions/exchanges/present-digest.ts'),
      'utf8',
    );
    const toolGuidance = [askTool, presentDigestTool].join('\n');

    expect(toolGuidance).toContain(
      'Never author a listed option that duplicates the built-in Other affordance',
    );
    expect(toolGuidance).toContain('large pretext or digest body in the continuing ask body');
    expect(toolGuidance).toContain(
      'For the declared review continuation, ask only for approve / request changes / reject',
    );
  });

  it('pins digest approval and extraction conduct in model-facing skill homes', async () => {
    const ingest = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    const routing = await readFile(
      join(process.cwd(), 'src/agents/skills/map/references/routing.md'),
      'utf8',
    );
    const conduct = [ingest, routing].join('\n');

    expect(conduct).toContain(
      'Default after digest approval: map the accepted_abstract directly into advisory graph mutations',
    );
    expect(conduct).toContain('multi-pass extraction: entities, relations, then narrative obligations');
    expect(conduct).toContain(
      'Do not treat digest approval as a reason to ask a broad follow-up before mapping',
    );
  });
});
