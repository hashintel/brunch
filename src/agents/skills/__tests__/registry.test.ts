import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LIVE_BRUNCH_SKILL_IDS,
  loadLiveBrunchSkillManifestEntries,
  renderBrunchSkills,
} from '../registry.js';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const distSkillsDir = join(repoRoot, 'dist/agents/skills');

describe('live skill resource packaging', () => {
  it('has a source SKILL.md for every registered live skill', () => {
    for (const id of LIVE_BRUNCH_SKILL_IDS) {
      const sourcePath = join(repoRoot, 'src/agents/skills', id, 'SKILL.md');
      expect(existsSync(sourcePath), sourcePath).toBe(true);
    }
  });

  it.skipIf(!existsSync(distSkillsDir))(
    'has a packaged dist SKILL.md for every registered live skill after the build asset step',
    () => {
      for (const id of LIVE_BRUNCH_SKILL_IDS) {
        const distPath = join(distSkillsDir, id, 'SKILL.md');
        expect(existsSync(distPath), distPath).toBe(true);
      }
    },
  );
});

describe('live skill manifest rendering', () => {
  it('escapes XML-significant characters in names, descriptions, and locations', () => {
    const rendered = renderBrunchSkills([
      {
        name: 'a & b',
        description: 'use <read> when "matching" > threshold',
        location: 'src/agents/skills/a&b/SKILL.md',
      },
    ]);

    expect(rendered).toContain('<name>a &amp; b</name>');
    expect(rendered).toContain(
      '<description>use &lt;read&gt; when &quot;matching&quot; &gt; threshold</description>',
    );
    expect(rendered).toContain('<location>src/agents/skills/a&amp;b/SKILL.md</location>');
    expect(rendered).not.toContain('<read>');
  });

  it('reuses the same loaded manifest entries across repeated default calls', () => {
    expect(loadLiveBrunchSkillManifestEntries()).toBe(loadLiveBrunchSkillManifestEntries());
  });

  it('gives every entry an absolute, existing location ending in agents/skills/<id>/SKILL.md', () => {
    const entries = loadLiveBrunchSkillManifestEntries();

    for (const [index, id] of LIVE_BRUNCH_SKILL_IDS.entries()) {
      const entry = entries[index];
      expect(entry?.location, id).toBeDefined();
      if (!entry) continue;
      expect(isAbsolute(entry.location), entry.location).toBe(true);
      expect(existsSync(entry.location), entry.location).toBe(true);
      expect(entry.location.endsWith(`agents/skills/${id}/SKILL.md`), entry.location).toBe(true);
    }
  });

  it('resolves manifest locations when the process cwd is unrelated to the repo checkout', async () => {
    const entries = loadLiveBrunchSkillManifestEntries();
    const originalCwd = process.cwd();
    const unrelatedCwd = await mkdtemp(join(tmpdir(), 'brunch-manifest-cwd-'));

    process.chdir(unrelatedCwd);
    try {
      for (const entry of entries) {
        expect(readFileSync(entry.location, 'utf8').length, entry.location).toBeGreaterThan(0);
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('exposes ingest and its routed map reference through the live manifest entry', () => {
    const ingest = loadLiveBrunchSkillManifestEntries().find((entry) => entry.name === 'ingest');

    expect(ingest).toBeDefined();
    expect(ingest?.location.endsWith('agents/skills/ingest/SKILL.md')).toBe(true);
    const ingestBody = readFileSync(ingest!.location, 'utf8');
    expect(ingestBody).toContain('../map/references/routing.md');
    expect(ingestBody).toContain(
      'Default after digest approval: map the accepted_abstract directly into advisory graph mutations',
    );
    expect(ingestBody).toContain('multi-pass extraction: entities, relations, then narrative obligations');
    expect(ingestBody).toContain(
      'Do not treat digest approval as a reason to ask a broad follow-up before mapping',
    );
  });
});
