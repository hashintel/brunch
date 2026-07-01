import { fileURLToPath } from 'node:url';

import { loadSkills, type Skill } from '@earendil-works/pi-coding-agent';

export const LIVE_BRUNCH_SKILL_IDS = [
  'analyze',
  'elicit',
  'ingest',
  'map',
  'project',
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

let cachedManifestEntries: readonly BrunchSkillManifestEntry[] | undefined;

export function loadLiveBrunchSkillManifestEntries(): readonly BrunchSkillManifestEntry[] {
  // Skill metadata is fixed at build time, so load once and reuse for the process lifetime
  // rather than reparsing SKILL.md files on every prompt composition.
  if (cachedManifestEntries) return cachedManifestEntries;

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
  cachedManifestEntries = LIVE_BRUNCH_SKILL_IDS.map((id) => skillToManifestEntry(id, byName.get(id)));
  return cachedManifestEntries;
}

export function renderBrunchSkills(entries = loadLiveBrunchSkillManifestEntries()): string {
  if (entries.length === 0) return '';
  return [
    '[Brunch live skills]',
    "- Each `<location>` below is an absolute path to that skill's SKILL.md; these are the only live Brunch prompt resources.",
    '- Use the read tool to load a listed skill at its given location when the current move matches its description.',
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
  if (skill.name !== expectedId) {
    throw new Error(
      `Brunch live skill ${expectedId} must have matching frontmatter name; got ${skill.name}.`,
    );
  }
  return {
    name: skill.name,
    description: skill.description,
    location: skill.filePath,
  };
}

const XML_TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeXml(value: string): string {
  return value.replace(/[&"<>]/g, (char) => XML_TEXT_ESCAPES[char] ?? char);
}
