import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LIVE_BRUNCH_SKILL_IDS } from '../registry.js';

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
