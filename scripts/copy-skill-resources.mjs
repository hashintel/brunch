// Copies each first-level live Brunch skill's SKILL.md into dist/ during `npm run build`.
//
// The skill ids come from the compiled registry (not a duplicated list here) so this
// script cannot drift from LIVE_BRUNCH_SKILL_IDS in src/agents/skills/registry.ts.
//
// dist/agents/skills/registry.js (and its .d.ts/.map siblings) are tsc output, already
// emitted by the time this script runs — only the per-skill markdown subdirectories are
// this script's to manage, so retired-skill cleanup below only removes those.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

import { LIVE_BRUNCH_SKILL_IDS } from '../dist/agents/skills/registry.js';

const distSkillsDir = 'dist/agents/skills';
const liveIds = new Set(LIVE_BRUNCH_SKILL_IDS);

for (const entry of readdirSync(distSkillsDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !liveIds.has(entry.name)) {
    rmSync(`${distSkillsDir}/${entry.name}`, { recursive: true, force: true });
  }
}

for (const id of LIVE_BRUNCH_SKILL_IDS) {
  mkdirSync(`${distSkillsDir}/${id}`, { recursive: true });
  copyFileSync(`src/agents/skills/${id}/SKILL.md`, `${distSkillsDir}/${id}/SKILL.md`);
}
