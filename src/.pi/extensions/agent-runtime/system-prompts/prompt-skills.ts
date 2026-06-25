import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSkills, type Skill } from '@earendil-works/pi-coding-agent';

type PromptResourceFamily = 'strategies' | 'lenses' | 'methods';

export interface PromptResourceManifestEntry {
  name: string;
  description: string;
  location: string;
}

export interface PromptManifests {
  strategies: readonly PromptResourceManifestEntry[];
  lenses: readonly PromptResourceManifestEntry[];
  methods: readonly PromptResourceManifestEntry[];
}

export function renderBrunchSkills(manifests: PromptManifests): string {
  const entries = [
    ...manifests.strategies.map((entry) => ({ kind: 'strategy', entry })),
    ...manifests.lenses.map((entry) => ({ kind: 'lens', entry })),
    ...manifests.methods.map((entry) => ({ kind: 'method', entry })),
  ] as const;
  if (entries.length === 0) return '';
  return [
    'The following Brunch skills provide specialized instructions for prompt-resource posture.',
    "Use the read tool to load a skill's file when the selected strategy, lens, or method matches its description.",
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.',
    '',
    '<brunch-skills>',
    ...entries.flatMap(({ kind, entry }) => [
      '  <skill>',
      `    <kind>${kind}</kind>`,
      `    <name>${escapeXml(entry.name)}</name>`,
      `    <description>${escapeXml(entry.description)}</description>`,
      `    <location>${escapeXml(entry.location)}</location>`,
      '  </skill>',
    ]),
    '</brunch-skills>',
  ].join('\n');
}

export function loadPromptResourceManifestEntries<TId extends string>(
  family: PromptResourceFamily,
  ids: readonly TId[],
): Record<TId, PromptResourceManifestEntry> {
  const skillPaths = ids.map((id) => promptResourceLocation(family, id));
  const result = loadSkills({
    cwd: process.cwd(),
    agentDir: fileURLToPath(new URL('../../', import.meta.url)),
    skillPaths,
    includeDefaults: false,
  });

  const warnings = result.diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`);
  if (warnings.length > 0) {
    throw new Error(`Invalid Brunch prompt-resource skill metadata:\n${warnings.join('\n')}`);
  }

  const byName = new Map(result.skills.map((skill) => [skill.name, skill]));
  return Object.fromEntries(
    ids.map((id) => [id, skillToPromptResourceManifestEntry(family, id, byName.get(id))]),
  ) as Record<TId, PromptResourceManifestEntry>;
}

export function skillToPromptResourceManifestEntry(
  family: PromptResourceFamily,
  expectedId: string,
  skill: Skill | undefined,
): PromptResourceManifestEntry {
  if (!skill) {
    throw new Error(`Missing Brunch prompt-resource skill metadata for ${family}/${expectedId}.`);
  }
  const parentDir = basename(dirname(skill.filePath));
  if (skill.name !== expectedId || parentDir !== expectedId) {
    throw new Error(
      `Brunch prompt-resource skill ${family}/${expectedId} must have name == parent directory; got name=${skill.name}, dir=${parentDir}.`,
    );
  }
  return {
    name: skill.name,
    description: skill.description,
    location: skill.filePath,
  };
}

function promptResourceLocation(family: PromptResourceFamily, id: string): string {
  return fileURLToPath(new URL(`../../../skills/${family}/${id}/SKILL.md`, import.meta.url));
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
