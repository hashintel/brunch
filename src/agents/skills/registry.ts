import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSkills, type Skill } from '@earendil-works/pi-coding-agent';

export const LIVE_BRUNCH_SKILL_IDS = [
  'analyze',
  'elicit',
  'ingest',
  'map',
  'propose',
  'review',
  'tutorial',
] as const;

export type LiveBrunchSkillId = (typeof LIVE_BRUNCH_SKILL_IDS)[number];

export interface BrunchSkillManifestEntry {
  readonly name: string;
  readonly description: string;
  readonly location: string;
}

export function loadLiveBrunchSkillManifestEntries(): readonly BrunchSkillManifestEntry[] {
  const skillPaths = LIVE_BRUNCH_SKILL_IDS.map((id) => liveBrunchSkillLocation(id));
  const result = loadSkills({
    cwd: process.cwd(),
    agentDir: liveBrunchSkillAgentDir(),
    skillPaths,
    includeDefaults: false,
  });

  const warnings = result.diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`);
  if (warnings.length > 0) {
    throw new Error(`Invalid Brunch live skill metadata:\n${warnings.join('\n')}`);
  }

  const byName = new Map(result.skills.map((skill) => [skill.name, skill]));
  return LIVE_BRUNCH_SKILL_IDS.map((id) => skillToManifestEntry(id, byName.get(id)));
}

export function renderBrunchSkills(entries = loadLiveBrunchSkillManifestEntries()): string {
  if (entries.length === 0) return '';
  return [
    '[Brunch live skills]',
    '- These first-level `src/agents/skills/*/SKILL.md` homes are the only live Brunch prompt resources.',
    '- Use the read tool to load a listed skill when the current move matches its description.',
    '- Do not infer additional skills from nested references, fixtures, or the filesystem beyond this block.',
    '',
    '<brunch-skills>',
    ...entries.flatMap((entry) => [
      '  <skill>',
      `    <name>${escapeXml(entry.name)}</name>`,
      `    <description>${escapeXml(entry.description)}</description>`,
      `    <location>${escapeXml(entry.location)}</location>`,
      '  </skill>',
    ]),
    '</brunch-skills>',
  ].join('\n');
}

function liveBrunchSkillAgentDir(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

function liveBrunchSkillLocation(id: LiveBrunchSkillId): string {
  return fileURLToPath(new URL(`./${id}/SKILL.md`, import.meta.url));
}

function skillToManifestEntry(
  expectedId: LiveBrunchSkillId,
  skill: Skill | undefined,
): BrunchSkillManifestEntry {
  if (!skill) {
    throw new Error(`Missing Brunch live skill metadata for ${expectedId}.`);
  }
  const parentDir = basename(dirname(skill.filePath));
  if (skill.name !== expectedId || parentDir !== expectedId) {
    throw new Error(
      `Brunch live skill ${expectedId} must have name == parent directory; got name=${skill.name}, dir=${parentDir}.`,
    );
  }
  return {
    name: skill.name,
    description: skill.description,
    location: skill.filePath,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
